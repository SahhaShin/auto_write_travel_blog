package com.shincha.naverblog.model.service;

import com.shincha.naverblog.model.dto.BlogStyleSample;
import java.util.List;

public interface StyleService {
    List<BlogStyleSample> getAll(Long userId);
    BlogStyleSample getById(Long id);
    BlogStyleSample addFromText(BlogStyleSample sample);
    BlogStyleSample addFromUrl(String url, String category, Long userId);
    void delete(Long id);
}
