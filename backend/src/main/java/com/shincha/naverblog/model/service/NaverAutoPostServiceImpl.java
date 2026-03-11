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
import org.springframework.beans.factory.annotation.Value;
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

    // 2차 인증 OTP 대기 (draftId -> otp)
    private final Map<Long, String> otpMap = new ConcurrentHashMap<>();

    private static final Random RANDOM = new Random();

    @Value("${chrome.bin:}")
    private String chromeBin;

    @Value("${chromedriver.path:}")
    private String chromedriverPath;

    @Override
    public void submitOtp(Long draftId, String otp) {
        otpMap.put(draftId, otp);
    }

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
            if (chromedriverPath != null && !chromedriverPath.isEmpty()) {
                System.setProperty("webdriver.chrome.driver", chromedriverPath);
            } else {
                WebDriverManager.chromedriver().setup();
            }
            ChromeOptions options = buildChromeOptions();
            driver = new ChromeDriver(options);

            WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(30));
            JavascriptExecutor js = (JavascriptExecutor) driver;

            // navigator.webdriver 감지 우회
            ((JavascriptExecutor) driver).executeScript(
                    "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            );

            // Step 1: 로그인 (저장된 쿠키 먼저 시도 → 실패 시 일반 로그인)
            statusMap.put(draftId, "LOGGING_IN");
            boolean loggedIn = tryLoginWithCookies(driver, creds);
            if (loggedIn) {
                log.info("쿠키 세션으로 로그인 성공 - draftId: {}", draftId);
            } else {
                log.info("쿠키 없음 또는 만료 → 일반 로그인 시도 - draftId: {}", draftId);
                String naverId = encryptionUtil.decrypt(creds.getEncryptedId());
                String naverPassword = encryptionUtil.decrypt(creds.getEncryptedPassword());
                naverLogin(driver, wait, naverId, naverPassword, draftId);
                saveCookies(driver, creds);
                log.info("로그인 완료 및 쿠키 저장 - draftId: {}", draftId);
            }

            // Step 2: 블로그 글쓰기 페이지 이동
            statusMap.put(draftId, "NAVIGATING");
            String blogId = creds.getBlogId();
            driver.get("https://blog.naver.com/" + blogId + "/postwrite");
            Thread.sleep(5000);
            takeScreenshot(driver, "01_write_page");

            // Step 3: iframe 탐색
            log.info("현재 URL: {}", driver.getCurrentUrl());
            log.info("iframe 목록: {}", driver.findElements(By.tagName("iframe")).stream()
                    .map(f -> f.getAttribute("id") + "/" + f.getAttribute("name")).toList());

            boolean switched = false;
            for (String frameName : List.of("mainFrame", "se2_iframe", "nhn_write")) {
                try {
                    driver.switchTo().defaultContent();
                    wait.until(ExpectedConditions.frameToBeAvailableAndSwitchToIt(frameName));
                    log.info("iframe 전환 성공: {}", frameName);
                    switched = true;
                    break;
                } catch (Exception ignored) {}
            }
            if (!switched) {
                log.warn("모든 iframe 전환 실패 - 기본 컨텍스트 유지");
            }
            Thread.sleep(3000);
            takeScreenshot(driver, "02_after_iframe");

            // Step 4: 제목 입력
            statusMap.put(draftId, "SETTING_TITLE");
            setTitle(driver, wait, js, finalTitle);
            takeScreenshot(driver, "03_after_title");

            // Step 5: 본문 내용 입력
            statusMap.put(draftId, "SETTING_CONTENT");
            setContent(driver, js, finalContent, images);
            takeScreenshot(driver, "04_after_content");

            // Step 6: 이미지 업로드
            statusMap.put(draftId, "UPLOADING_IMAGES");
            // 이미지는 setContent에서 플레이스홀더로 처리됨

            // Step 7: 발행
            statusMap.put(draftId, "PUBLISHING");
            takeScreenshot(driver, "05_before_publish");
            String postUrl = publish(driver, wait);
            takeScreenshot(driver, "06_after_publish");

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
        // 서버 환경(Render)에서는 headless 필수 (디스플레이 없음)
        options.addArguments("--headless=new");
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--disable-gpu");
        options.addArguments("--window-size=1920,1080");
        options.addArguments("--disable-blink-features=AutomationControlled");
        options.addArguments("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");
        options.setExperimentalOption("excludeSwitches", List.of("enable-automation"));
        options.setExperimentalOption("useAutomationExtension", false);
        if (chromeBin != null && !chromeBin.isEmpty()) {
            options.setBinary(chromeBin);
        }
        return options;
    }

    private void naverLogin(WebDriver driver, WebDriverWait wait, String naverId, String naverPassword, Long draftId) throws InterruptedException {
        driver.get("https://nid.naver.com/nidlogin.login?mode=form&url=https://www.naver.com/");
        Thread.sleep(2000);

        WebElement idInput = wait.until(ExpectedConditions.presenceOfElementLocated(By.id("id")));
        slowType(idInput, naverId);
        Thread.sleep(500);

        WebElement pwInput = driver.findElement(By.id("pw"));
        slowType(pwInput, naverPassword);
        Thread.sleep(500);

        driver.findElement(By.id("log.login")).click();

        // 로그인 완료 대기 (캡차/2FA 포함해서 최대 3분간 사용자 처리 대기)
        statusMap.put(draftId, "LOGGING_IN");
        log.info("로그인 진행 중 - 캡차가 뜨면 브라우저 창에서 직접 해결해주세요.");
        String currentUrl = waitForLoginComplete(driver, draftId, 180);

        log.info("로그인 후 URL: {}", currentUrl);

        // 2차 인증 화면 감지
        if (is2FAPage(driver, currentUrl)) {
            log.info("2차 인증 화면 감지 - draftId: {}", draftId);
            statusMap.put(draftId, "WAITING_2FA");
            otpMap.remove(draftId);

            // 최대 5분 대기
            String otp = waitForOtp(draftId, 300);
            if (otp == null) {
                throw new RuntimeException("2차 인증 시간 초과 (5분). 다시 시도해주세요.");
            }

            // OTP 입력
            try {
                WebElement otpInput = wait.until(ExpectedConditions.presenceOfElementLocated(
                        By.cssSelector("#otp, #secondAuthValue, input[name='otp'], input[name='code'], .input_otp")
                ));
                otpInput.clear();
                otpInput.sendKeys(otp);
                Thread.sleep(500);

                // 확인 버튼 클릭
                WebElement confirmBtn = driver.findElement(
                        By.cssSelector(".btn_login, button[type='submit'], #submit_btn")
                );
                confirmBtn.click();
                Thread.sleep(3000);
                log.info("2차 인증 완료 - draftId: {}", draftId);
            } catch (Exception e) {
                throw new RuntimeException("2차 인증 입력 실패: " + e.getMessage());
            }

            currentUrl = driver.getCurrentUrl();
        }

        // 최종 로그인 성공 여부 확인
        if (currentUrl.contains("nidlogin") || currentUrl.contains("ndoself") || is2FAPage(driver, currentUrl)) {
            throw new RuntimeException("네이버 로그인 실패. 아이디/비밀번호를 확인하거나 OTP를 다시 시도해주세요.");
        }
    }

    // 저장된 쿠키로 로그인 시도 → 성공 여부 반환
    private boolean tryLoginWithCookies(WebDriver driver, NaverCredentials creds) {
        if (creds.getSessionCookies() == null || creds.getSessionCookies().isBlank()) {
            return false;
        }
        try {
            String cookieJson = encryptionUtil.decrypt(creds.getSessionCookies());
            // 쿠키 세팅을 위해 먼저 naver.com 도메인 접근
            driver.get("https://www.naver.com");
            Thread.sleep(1000);

            // 쿠키 파싱 후 로드
            com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode arr = om.readTree(cookieJson);
            for (com.fasterxml.jackson.databind.JsonNode c : arr) {
                try {
                    org.openqa.selenium.Cookie cookie = new org.openqa.selenium.Cookie.Builder(
                            c.get("name").asText(), c.get("value").asText())
                            .domain(c.has("domain") ? c.get("domain").asText() : ".naver.com")
                            .path(c.has("path") ? c.get("path").asText() : "/")
                            .isSecure(c.has("secure") && c.get("secure").asBoolean())
                            .build();
                    driver.manage().addCookie(cookie);
                } catch (Exception ignored) {}
            }

            // 쿠키 적용 후 로그인 상태 확인
            driver.get("https://www.naver.com");
            Thread.sleep(2000);
            boolean isLoggedIn = !driver.findElements(
                    By.cssSelector(".MyView-module__link_login___HpHMW, .link_login, [data-clk='login']")
            ).isEmpty() == false
                    && driver.findElements(By.cssSelector(".MyView-module__btn_my___EJSaB, .gnb_my_image, .MyView-module__user_img___FvFOp")).size() > 0;

            log.info("쿠키 로그인 검증 결과: {}", isLoggedIn);
            return isLoggedIn;
        } catch (Exception e) {
            log.warn("쿠키 로그인 실패, 일반 로그인으로 전환: {}", e.getMessage());
            return false;
        }
    }

    // 로그인 성공 후 쿠키를 암호화해서 DB에 저장
    private void saveCookies(WebDriver driver, NaverCredentials creds) {
        try {
            java.util.Set<org.openqa.selenium.Cookie> cookies = driver.manage().getCookies();
            com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
            java.util.List<java.util.Map<String, Object>> cookieList = new java.util.ArrayList<>();
            for (org.openqa.selenium.Cookie c : cookies) {
                java.util.Map<String, Object> map = new java.util.HashMap<>();
                map.put("name", c.getName());
                map.put("value", c.getValue());
                map.put("domain", c.getDomain());
                map.put("path", c.getPath());
                map.put("secure", c.isSecure());
                cookieList.add(map);
            }
            String cookieJson = om.writeValueAsString(cookieList);
            String encrypted = encryptionUtil.encrypt(cookieJson);
            credentialsDao.updateCookies(encrypted);
            log.info("쿠키 저장 완료 - {}개", cookieList.size());
        } catch (Exception e) {
            log.warn("쿠키 저장 실패 (로그인은 유지됨): {}", e.getMessage());
        }
    }

    // 로그인 페이지를 벗어날 때까지 대기 (캡차/2FA 사용자 직접 처리 시간 포함)
    private String waitForLoginComplete(WebDriver driver, Long draftId, int timeoutSeconds) throws InterruptedException {
        int elapsed = 0;
        while (elapsed < timeoutSeconds) {
            String url = driver.getCurrentUrl();
            // 로그인 페이지를 벗어나면 완료
            if (!url.contains("nidlogin.login") && !url.contains("nid.naver.com/nidlogin")) {
                return url;
            }
            // 캡차 감지 시 상태 업데이트
            boolean hasCaptcha = !driver.findElements(By.cssSelector(".captcha_wrap, #captcha, .g-recaptcha")).isEmpty();
            if (hasCaptcha && !statusMap.get(draftId).equals("WAITING_CAPTCHA")) {
                statusMap.put(draftId, "WAITING_CAPTCHA");
                log.info("캡차 감지 - 브라우저 창에서 직접 해결해주세요. draftId: {}", draftId);
            }
            Thread.sleep(2000);
            elapsed += 2;
        }
        return driver.getCurrentUrl();
    }

    private boolean is2FAPage(WebDriver driver, String url) {
        if (url.contains("2fa") || url.contains("twofactor") || url.contains("OTP") || url.contains("secondauth")) {
            return true;
        }
        try {
            return !driver.findElements(By.cssSelector(
                    "#otp, #secondAuthValue, .otp_wrap, .wrap_2step, input[name='otp']"
            )).isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    private String waitForOtp(Long draftId, int timeoutSeconds) throws InterruptedException {
        int elapsed = 0;
        while (elapsed < timeoutSeconds) {
            String otp = otpMap.get(draftId);
            if (otp != null) {
                otpMap.remove(draftId);
                return otp;
            }
            Thread.sleep(2000);
            elapsed += 2;
        }
        return null;
    }

    private void setTitle(WebDriver driver, WebDriverWait wait, JavascriptExecutor js, String title) throws InterruptedException {
        // 제목 영역: 스크린샷 확인 결과 contenteditable div (.se-title-input 또는 첫번째 contenteditable)
        String[] titleSelectors = {
            ".se-title-input",
            "div.se-component.se-title",
            "[contenteditable='true'].se-title-input",
            "div[contenteditable='true']:first-of-type"
        };
        boolean done = false;
        for (String sel : titleSelectors) {
            try {
                List<WebElement> els = driver.findElements(By.cssSelector(sel));
                if (!els.isEmpty()) {
                    WebElement el = els.get(0);
                    log.info("제목 셀렉터 매칭: {}", sel);
                    el.click();
                    Thread.sleep(500);
                    js.executeScript("arguments[0].focus(); arguments[0].textContent = '';", el);
                    el.sendKeys(title);
                    done = true;
                    break;
                }
            } catch (Exception ignored) {}
        }
        if (!done) {
            // XPath fallback: placeholder 텍스트 "제목" 가진 요소
            try {
                WebElement el = driver.findElement(By.xpath("//*[@data-placeholder='제목' or @placeholder='제목']"));
                log.info("XPath로 제목 입력 요소 발견");
                el.click();
                Thread.sleep(300);
                js.executeScript("arguments[0].textContent = '';", el);
                el.sendKeys(title);
                done = true;
            } catch (Exception ignored) {}
        }
        if (!done) {
            log.warn("제목 셀렉터 모두 실패 → JS 강제 주입");
            js.executeScript(
                "var all = document.querySelectorAll('[contenteditable=true]');" +
                "if(all.length > 0){ all[0].focus(); all[0].textContent = arguments[0];" +
                "all[0].dispatchEvent(new Event('input',{bubbles:true})); }", title
            );
        }
        Thread.sleep(500);
    }

    private void takeScreenshot(WebDriver driver, String name) {
        try {
            byte[] shot = ((org.openqa.selenium.TakesScreenshot) driver)
                    .getScreenshotAs(org.openqa.selenium.OutputType.BYTES);
            java.nio.file.Files.write(java.nio.file.Path.of("/tmp/naver_" + name + ".png"), shot);
            log.info("스크린샷: /tmp/naver_{}.png", name);
        } catch (Exception e) {
            log.warn("스크린샷 실패: {}", e.getMessage());
        }
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
        JavascriptExecutor js = (JavascriptExecutor) driver;

        // iframe 밖으로 나오기 (발행 버튼은 상위 컨텍스트에 있을 수 있음)
        try { driver.switchTo().defaultContent(); } catch (Exception ignored) {}

        // 우측 도움말/사이드 패널 닫기 (X 버튼)
        try {
            List<WebElement> closeButtons = driver.findElements(By.xpath(
                "//*[contains(@class,'close') or contains(@class,'Close')]//button | " +
                "//button[contains(@aria-label,'닫기') or contains(@title,'닫기') or contains(@class,'btn_close')]"
            ));
            for (WebElement btn : closeButtons) {
                if (btn.isDisplayed()) {
                    btn.click();
                    log.info("사이드 패널 닫기 버튼 클릭");
                    Thread.sleep(500);
                    break;
                }
            }
        } catch (Exception ignored) {}

        // ESC로 열려있는 패널/모달 닫기
        try {
            driver.findElement(By.tagName("body")).sendKeys(Keys.ESCAPE);
            Thread.sleep(500);
        } catch (Exception ignored) {}

        takeScreenshot(driver, "05b_publish_btn_search");

        WebElement publishBtn = null;

        // 1. JS로 정확히 '발행' 텍스트인 버튼 찾기 (예약 포함 버튼 제외)
        try {
            publishBtn = (WebElement) js.executeScript(
                "var btns = document.querySelectorAll('button');" +
                "for (var i = 0; i < btns.length; i++) {" +
                "  var txt = btns[i].innerText ? btns[i].innerText.trim() : btns[i].textContent.trim();" +
                "  if ((txt === '발행' || txt === '발행 ') && !txt.includes('예약') && btns[i].offsetParent !== null) {" +
                "    return btns[i];" +
                "  }" +
                "}" +
                "return null;"
            );
            if (publishBtn != null) log.info("JS 정확 텍스트로 발행 버튼 발견");
        } catch (Exception ignored) {}

        // 2. XPath - 정확히 '발행' 텍스트, 예약 제외
        if (publishBtn == null) {
            String[] xpaths = {
                "//button[normalize-space(text())='발행' and not(contains(.,'예약'))]",
                "//button[normalize-space(.)='발행']",
                "//span[normalize-space(text())='발행']/parent::button[not(contains(.,'예약'))]",
            };
            for (String xpath : xpaths) {
                try {
                    List<WebElement> btns = driver.findElements(By.xpath(xpath));
                    for (WebElement btn : btns) {
                        if (btn.isDisplayed() && !btn.getText().contains("예약")) {
                            publishBtn = btn;
                            log.info("XPath 발행 버튼 발견: {} (텍스트: {})", xpath, btn.getText());
                            break;
                        }
                    }
                    if (publishBtn != null) break;
                } catch (Exception ignored) {}
            }
        }

        // 3. CSS - 마지막 수단으로 contains 사용하되 예약 필터링
        if (publishBtn == null) {
            try {
                List<WebElement> btns = driver.findElements(By.xpath("//button[contains(text(),'발행')]"));
                for (WebElement btn : btns) {
                    String text = btn.getText().trim();
                    if (!text.contains("예약") && btn.isDisplayed()) {
                        publishBtn = btn;
                        log.info("Fallback 발행 버튼 발견 (텍스트: {})", text);
                        break;
                    }
                }
            } catch (Exception ignored) {}
        }

        if (publishBtn == null) {
            // 모든 버튼 텍스트 로깅
            try {
                String btnTexts = (String) js.executeScript(
                    "return Array.from(document.querySelectorAll('button')).map(b => b.innerText || b.textContent).join(' | ');"
                );
                log.warn("발행 버튼 찾기 실패. 현재 버튼 목록: {}", btnTexts);
            } catch (Exception ignored) {}
            return driver.getCurrentUrl();
        }

        // 발행 버튼 클릭 (일반 클릭 시도 후 JS 폴백)
        try {
            publishBtn.click();
        } catch (Exception e) {
            js.executeScript("arguments[0].click();", publishBtn);
        }
        log.info("발행 버튼 클릭 완료");
        Thread.sleep(3000);
        takeScreenshot(driver, "05c_after_publish_click");

        // 발행 설정 패널에서 "발행하기" 버튼 찾기 (최대 15초 대기)
        // 패널 내 모든 버튼 텍스트 로깅
        try {
            String allBtnTexts = (String) js.executeScript(
                "return Array.from(document.querySelectorAll('button')).map(b => '\"' + (b.innerText||b.textContent).trim() + '\"').join(', ');"
            );
            log.info("발행 패널 열린 후 버튼 목록: {}", allBtnTexts);
        } catch (Exception ignored) {}

        // 버튼 목록 확인 결과: 패널 내 확인 버튼은 "발행하기"가 아니라 "발행"
        // "발행 설정 닫기" 버튼 이후에 오는 "발행" 버튼이 패널 내 확인 버튼
        WebElement confirmBtn = null;
        for (int attempt = 0; attempt < 15 && confirmBtn == null; attempt++) {
            Thread.sleep(1000);
            try {
                confirmBtn = (WebElement) js.executeScript(
                    "var btns = Array.from(document.querySelectorAll('button'));" +
                    // "발행 설정 닫기" 이후의 "발행" 버튼 (패널 내 확인 버튼)
                    "var closeIdx = btns.findIndex(b => (b.innerText||b.textContent).includes('발행 설정 닫기'));" +
                    "if (closeIdx >= 0) {" +
                    "  for (var i = closeIdx + 1; i < btns.length; i++) {" +
                    "    var t = (btns[i].innerText||btns[i].textContent).trim();" +
                    "    if (t === '발행' && btns[i].offsetParent !== null) return btns[i];" +
                    "  }" +
                    "}" +
                    // fallback: 두 번째 "발행" 버튼
                    "var publishBtns = btns.filter(b => (b.innerText||b.textContent).trim() === '발행' && b.offsetParent !== null);" +
                    "return publishBtns.length >= 2 ? publishBtns[publishBtns.length - 1] : null;"
                );
                if (confirmBtn != null) {
                    log.info("패널 내 발행 확인 버튼 발견 ({}초 후)", attempt + 1);
                }
            } catch (Exception ignored) {}
        }

        if (confirmBtn != null) {
            // 버튼이 화면에 안 보일 수 있으므로 스크롤 후 클릭
            js.executeScript("arguments[0].scrollIntoView({block:'center'});", confirmBtn);
            Thread.sleep(500);
            try {
                confirmBtn.click();
            } catch (Exception e) {
                js.executeScript("arguments[0].click();", confirmBtn);
            }
            log.info("발행하기 클릭 완료");
            Thread.sleep(3000);
        } else {
            log.warn("발행하기 버튼을 15초 내에 찾지 못함");
        }

        takeScreenshot(driver, "06_after_publish");

        // URL이 postwrite에서 바뀔 때까지 최대 15초 대기
        String finalUrl = driver.getCurrentUrl();
        for (int i = 0; i < 15; i++) {
            Thread.sleep(1000);
            finalUrl = driver.getCurrentUrl();
            if (!finalUrl.contains("postwrite")) {
                log.info("발행 완료 URL: {}", finalUrl);
                break;
            }
        }
        return finalUrl;
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
