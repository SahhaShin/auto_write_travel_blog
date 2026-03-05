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
            Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
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

    private String extractNaverBlogContent(Document doc) {
        // 네이버 블로그 SmartEditor ONE 본문 영역 시도
        String[] selectors = {
                ".se-main-container",
                ".post_ct",
                "#postViewArea",
                ".se_doc_viewer",
                "div.se-component"
        };

        for (String selector : selectors) {
            Element element = doc.selectFirst(selector);
            if (element != null) {
                return element.text();
            }
        }

        // iframe 내 콘텐츠 시도 (네이버 블로그는 iframe 구조)
        // 일반 스크래핑으로는 iframe 내부에 접근 불가 → body 전체에서 추출
        return doc.body().text();
    }

    @Override
    public void delete(Long id) {
        styleDao.softDelete(id);
    }
}
