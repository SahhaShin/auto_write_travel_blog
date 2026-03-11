package com.shincha.naverblog.model.service;

import com.shincha.naverblog.model.dto.BlogDraft;
import java.util.List;

public interface ClaudeService {
    BlogDraft generateContent(Long draftId, List<Long> styleSampleIds, Long userId);
    BlogDraft regenerateContent(Long draftId, List<Long> styleSampleIds, String customInstructions, Long userId);
}
