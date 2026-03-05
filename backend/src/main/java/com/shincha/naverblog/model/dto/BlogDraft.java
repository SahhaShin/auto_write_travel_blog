package com.shincha.naverblog.model.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class BlogDraft {
    private Long id;

    // 여행 입력 정보
    private String destination;
    private String travelDates;
    private String itinerary;
    private String keyPoints;
    private String category;

    // AI 생성 및 최종 편집 내용
    private String generatedTitle;
    private String finalTitle;
    private String generatedContent;    // AI가 생성한 HTML
    private String finalContent;        // 사용자가 편집한 HTML

    // 메타데이터
    private String styleSampleIds;      // JSON 배열: 사용된 스타일 샘플 ID들
    private String claudeModel;
    private Integer generationTokens;

    // 상태
    private String status;              // DRAFT, GENERATED, EDITING, READY, POSTED, FAILED
    private String naverPostUrl;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // 조회 시 연결된 이미지 목록 (JOIN)
    private List<BlogImage> images;
}
