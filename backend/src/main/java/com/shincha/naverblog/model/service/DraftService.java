package com.shincha.naverblog.model.service;

import com.shincha.naverblog.model.dto.BlogDraft;
import java.util.List;

public interface DraftService {
    List<BlogDraft> getAll(Long userId);
    BlogDraft getById(Long id);
    BlogDraft create(BlogDraft draft);
    BlogDraft update(BlogDraft draft);
    void delete(Long id);
}
