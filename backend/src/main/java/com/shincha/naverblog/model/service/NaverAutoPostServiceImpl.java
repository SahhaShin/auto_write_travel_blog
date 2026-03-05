package com.shincha.naverblog.model.service;

import com.shincha.naverblog.model.dao.DraftDao;
import com.shincha.naverblog.model.dao.ImageDao;
import com.shincha.naverblog.model.dao.NaverCredentialsDao;
import com.shincha.naverblog.model.dao.PostHistoryDao;
import com.shincha.naverblog.model.dto.BlogDraft;
import com.shincha.naverblog.model.dto.BlogImage;
import com.shincha.naverblog.model.dto.NaverCredentials;
import com.shincha.naverblog.model.dto.PostHistory;
import com.shincha.naverblog.util.EncryptionUtil;
import io.github.bonigarcia.wdm.WebDriverManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class NaverAutoPostServiceImpl implements NaverAutoPostService {

    private final DraftDao draftDao;
    private final ImageDao imageDao;
    private final NaverCredentialsDao credentialsDao;
    private final PostHistoryDao postHistoryDao;
    private final EncryptionUtil encryptionUtil;

    // 발행 상태 추적 (draftId -> status)
    private final Map<Long, String> statusMap = new ConcurrentHashMap<>();

    private static final Random RANDOM = new Random();

    @Override
    @Async
    public void postAsync(Long draftId) {
        statusMap.put(draftId, "PENDING");
        WebDriver driver = null;

        try {
            BlogDraft draft = draftDao.findById(draftId);
            if (draft == null) throw new RuntimeException("Draft 없음: " + draftId);

            NaverCredentials creds = credentialsDao.find();
            if (creds == null) throw new RuntimeException("네이버 로그인 정보가 설정되지 않았습니다.");

            List<BlogImage> images = imageDao.findByDraftId(draftId);
            String finalTitle = draft.getFinalTitle() != null ? draft.getFinalTitle() : draft.getGeneratedTitle();
            String finalContent = draft.getFinalContent() != null ? draft.getFinalContent() : draft.getGeneratedContent();

            // Chrome 드라이버 설정
            WebDriverManager.chromedriver().setup();
            ChromeOptions options = buildChromeOptions();
            driver = new ChromeDriver(options);

            WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(30));
            JavascriptExecutor js = (JavascriptExecutor) driver;

            // navigator.webdriver 감지 우회
            ((JavascriptExecutor) driver).executeScript(
                    "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            );

            // Step 1: 네이버 로그인
            statusMap.put(draftId, "LOGGING_IN");
            String naverId = encryptionUtil.decrypt(creds.getEncryptedId());
            String naverPassword = encryptionUtil.decrypt(creds.getEncryptedPassword());
            naverLogin(driver, wait, naverId, naverPassword);
            log.info("네이버 로그인 완료 - draftId: {}", draftId);

            // Step 2: 블로그 글쓰기 페이지 이동
            statusMap.put(draftId, "NAVIGATING");
            String blogId = creds.getBlogId();
            driver.get("https://blog.naver.com/" + blogId + "/postwrite");
            Thread.sleep(3000);

            // Step 3: 메인 프레임으로 전환
            try {
                wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt("mainFrame"));
            } catch (Exception e) {
                log.warn("mainFrame 전환 실패, 직접 시도: {}", e.getMessage());
            }

            // Step 4: 제목 입력
            statusMap.put(draftId, "SETTING_TITLE");
            setTitle(driver, wait, finalTitle);

            // Step 5: 본문 내용 입력
            statusMap.put(draftId, "SETTING_CONTENT");
            setContent(driver, js, finalContent, images);

            // Step 6: 이미지 업로드
            statusMap.put(draftId, "UPLOADING_IMAGES");
            // 이미지는 setContent에서 플레이스홀더로 처리됨

            // Step 7: 발행
            statusMap.put(draftId, "PUBLISHING");
            String postUrl = publish(driver, wait);

            // Step 8: 결과 저장
            draftDao.updateNaverPostUrl(draftId, postUrl);

            PostHistory history = new PostHistory();
            history.setDraftId(draftId);
            history.setNaverPostUrl(postUrl);
            history.setTitle(finalTitle);
            history.setContentSnapshot(finalContent != null ? finalContent.substring(0, Math.min(finalContent.length(), 5000)) : "");
            history.setCategory(draft.getCategory());
            history.setImageCount(images.size());
            history.setAutomationLog("SUCCESS");
            postHistoryDao.insert(history);

            statusMap.put(draftId, "SUCCESS:" + postUrl);
            log.info("네이버 포스팅 완료 - draftId: {}, url: {}", draftId, postUrl);

        } catch (Exception e) {
            log.error("네이버 자동 포스팅 실패 - draftId: {}", draftId, e);
            draftDao.updateStatus(draftId, "FAILED");
            statusMap.put(draftId, "FAILED:" + e.getMessage());
        } finally {
            if (driver != null) {
                driver.quit();
            }
        }
    }

    @Override
    public String getStatus(Long draftId) {
        return statusMap.getOrDefault(draftId, "UNKNOWN");
    }

    private ChromeOptions buildChromeOptions() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless=new");
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--disable-gpu");
        options.addArguments("--window-size=1920,1080");
        options.addArguments("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");
        options.setExperimentalOption("excludeSwitches", List.of("enable-automation"));
        options.setExperimentalOption("useAutomationExtension", false);
        return options;
    }

    private void naverLogin(WebDriver driver, WebDriverWait wait, String naverId, String naverPassword) throws InterruptedException {
        driver.get("https://nid.naver.com/nidlogin.login?mode=form&url=https://www.naver.com/");
        Thread.sleep(2000);

        WebElement idInput = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("id")));
        slowType(idInput, naverId);
        Thread.sleep(500);

        WebElement pwInput = driver.findElement(By.id("pw"));
        slowType(pwInput, naverPassword);
        Thread.sleep(500);

        driver.findElement(By.id("log.login")).click();
        Thread.sleep(3000);

        // 로그인 성공 확인
        String currentUrl = driver.getCurrentUrl();
        if (currentUrl.contains("nidlogin") || currentUrl.contains("ndoself")) {
            throw new RuntimeException("네이버 로그인 실패. 아이디/비밀번호를 확인하거나 2차 인증을 비활성화하세요.");
        }
    }

    private void setTitle(WebDriver driver, WebDriverWait wait, String title) throws InterruptedException {
        // SmartEditor ONE 제목 입력
        try {
            WebElement titleInput = wait.until(
                    ExpectedConditions.presenceOfElementLocated(
                            By.cssSelector(".se-title-input, .se-ff-nanumbarungothic, [contenteditable='true'].title")
                    )
            );
            titleInput.click();
            titleInput.clear();
            titleInput.sendKeys(title);
        } catch (Exception e) {
            log.warn("제목 입력 실패, 다른 방법 시도: {}", e.getMessage());
            // 다른 방법으로 제목 입력
            try {
                WebElement titleInput = driver.findElement(By.className("se-title-input"));
                ((JavascriptExecutor) driver).executeScript(
                        "arguments[0].textContent = arguments[1]", titleInput, title
                );
            } catch (Exception ex) {
                log.error("제목 입력 최종 실패", ex);
            }
        }
        Thread.sleep(500);
    }

    private void setContent(WebDriver driver, JavascriptExecutor js, String htmlContent, List<BlogImage> images) throws InterruptedException {
        // 이미지 플레이스홀더를 실제 img 태그로 교체
        if (htmlContent != null && images != null) {
            for (int i = 0; i < images.size(); i++) {
                BlogImage img = images.get(i);
                String placeholder = "[IMAGE_" + (i + 1) + "]";
                String imgTag = "<img src='http://localhost:8080" + img.getPublicUrl() + "' alt='" + img.getOriginalName() + "'/>";
                htmlContent = htmlContent.replace(placeholder, imgTag);
            }
        }

        Thread.sleep(2000);

        // SmartEditor ONE 콘텐츠 영역에 HTML 주입
        try {
            String content = htmlContent;
            js.executeScript(
                    "var editor = document.querySelector('.se-content, .se-main-container, [role=\"textbox\"]');" +
                    "if (editor) { editor.innerHTML = arguments[0]; }",
                    content
            );
        } catch (Exception e) {
            log.warn("JavaScript HTML 주입 실패: {}", e.getMessage());
            // 텍스트만 입력
            try {
                WebElement contentArea = driver.findElement(
                        By.cssSelector(".se-content, [contenteditable='true']")
                );
                contentArea.click();
                contentArea.sendKeys(htmlContent != null ? htmlContent.replaceAll("<[^>]+>", "") : "");
            } catch (Exception ex) {
                log.error("본문 입력 최종 실패", ex);
            }
        }
        Thread.sleep(1000);
    }

    private String publish(WebDriver driver, WebDriverWait wait) throws InterruptedException {
        // 발행 버튼 클릭
        try {
            WebElement publishBtn = wait.until(
                    ExpectedConditions.elementToBeClickable(
                            By.cssSelector(".publish_btn, .se-publishBtn, button[data-type='publish']")
                    )
            );
            publishBtn.click();
            Thread.sleep(2000);

            // 최종 확인 버튼 (모달)
            try {
                WebElement confirmBtn = wait.until(
                        ExpectedConditions.elementToBeClickable(
                                By.cssSelector(".btn_confirm, .layer_btn .btn_blue")
                        )
                );
                confirmBtn.click();
                Thread.sleep(3000);
            } catch (Exception e) {
                log.debug("발행 확인 모달 없음 - 바로 발행됨");
            }

        } catch (Exception e) {
            log.warn("발행 버튼 클릭 실패: {}", e.getMessage());
        }

        return driver.getCurrentUrl();
    }

    private void slowType(WebElement element, String text) throws InterruptedException {
        element.click();
        element.clear();
        for (char c : text.toCharArray()) {
            element.sendKeys(String.valueOf(c));
            Thread.sleep(100 + RANDOM.nextInt(150));
        }
    }
}
