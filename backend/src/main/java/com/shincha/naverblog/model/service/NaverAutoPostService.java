package com.shincha.naverblog.model.service;

public interface NaverAutoPostService {
    void postAsync(Long draftId);
    String getStatus(Long draftId);
}
