package com.shincha.naverblog.model.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class PostHistory {
    private Long id;
    private Long draftId;
    private String naverPostUrl;
    private String title;
    private String contentSnapshot;
    private String category;
    private int imageCount;
    private LocalDateTime postedAt;
    private String automationLog;
}
