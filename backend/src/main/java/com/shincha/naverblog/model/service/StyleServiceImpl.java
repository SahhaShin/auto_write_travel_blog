package com.shincha.naverblog.model.service;

import com.shincha.naverblog.model.dao.StyleDao;
import com.shincha.naverblog.model.dto.BlogStyleSample;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class StyleServiceImpl implements StyleService {

    private final StyleDao styleDao;

    @Override
    public List<BlogStyleSample> getAll() {
        return styleDao.findAll();
    }

    @Override
    public BlogStyleSample getById(Long id) {
        return styleDao.findById(id);
    }

    @Override
    public BlogStyleSample addFromText(BlogStyleSample sample) {
        styleDao.insert(sample);
        return styleDao.findById(sample.getId());
    }

    @Override
    public BlogStyleSample addFromUrl(String url, String category) {
        try {
            // 네이버 블로그는 iframe 구조 → 모바일 URL로 변환하면 본문 직접 접근 가능
            String fetchUrl = toMobileNaverUrl(url);
            log.info("스크래핑 URL: {}", fetchUrl);

            Document doc = Jsoup.connect(fetchUrl)
                    .userAgent("Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")
                    .referrer("https://m.blog.naver.com")
                    .timeout(10000)
                    .get();

            // 네이버 블로그 본문 추출 (SmartEditor 컨텐츠 영역)
            String title = doc.title();
            String content = extractNaverBlogContent(doc);

            if (content.isBlank()) {
                throw new RuntimeException("블로그 본문을 추출할 수 없습니다. URL을 확인해주세요.");
            }

            BlogStyleSample sample = new BlogStyleSample();
            sample.setTitle(title);
            sample.setSourceUrl(url);
            sample.setContent(content);
            sample.setCategory(category != null ? category : "여행");
            sample.setActive(true);

            styleDao.insert(sample);
            return styleDao.findById(sample.getId());

        } catch (IOException e) {
            log.error("네이버 블로그 URL 스크래핑 실패: {}", url, e);
            throw new RuntimeException("URL 접근에 실패했습니다: " + e.getMessage());
        }
    }

    /**
     * 네이버 블로그 PC URL을 모바일 URL로 변환
     * https://blog.naver.com/id/postNo → https://m.blog.naver.com/id/postNo
     */
    private String toMobileNaverUrl(String url) {
        if (url.contains("blog.naver.com") && !url.contains("m.blog.naver.com")) {
            return url.replace("blog.naver.com", "m.blog.naver.com");
        }
        return url;
    }

    private String extractNaverBlogContent(Document doc) {
        // 네이버 모바일 블로그 SmartEditor ONE 본문 영역 시도
        String[] selectors = {
                ".se-main-container",
                "#postViewArea",
                ".post_ct",
                ".se_doc_viewer",
                "div.se-component",
                "article"
        };

        for (String selector : selectors) {
            Element element = doc.selectFirst(selector);
            if (element != null) {
                String text = element.text().trim();
                if (!text.isBlank()) {
                    log.info("본문 추출 성공 (selector: {}), 글자수: {}", selector, text.length());
                    return text;
                }
            }
        }

        // 최후 수단: body 전체 텍스트
        String bodyText = doc.body().text().trim();
        log.warn("셀렉터 매칭 실패, body 전체 텍스트 사용, 글자수: {}", bodyText.length());
        return bodyText;
    }

    @Override
    public void delete(Long id) {
        styleDao.softDelete(id);
    }
}
