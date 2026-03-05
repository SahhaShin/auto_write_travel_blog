package com.shincha.naverblog.model.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class BlogStyleSample {
    private Long id;
    private String title;
    private String sourceUrl;
    private String content;
    private String category;
    private String styleTags;       // JSON 배열 문자열: ["반말", "이모지많음"]
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean isActive;
}
