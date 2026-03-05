package com.shincha.naverblog.model.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class BlogImage {
    private Long id;
    private Long draftId;
    private String originalName;
    private String storedPath;
    private String publicUrl;
    private Long fileSize;
    private String mimeType;
    private String aiDescription;   // Claude Vision 이미지 설명
    private int displayOrder;
    private LocalDateTime createdAt;
}
