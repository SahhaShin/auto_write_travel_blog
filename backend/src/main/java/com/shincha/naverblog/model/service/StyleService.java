package com.shincha.naverblog.model.service;

import com.shincha.naverblog.model.dto.BlogStyleSample;
import java.util.List;

public interface StyleService {
    List<BlogStyleSample> getAll();
    BlogStyleSample getById(Long id);
    BlogStyleSample addFromText(BlogStyleSample sample);
    BlogStyleSample addFromUrl(String url, String category);
    void delete(Long id);
}
