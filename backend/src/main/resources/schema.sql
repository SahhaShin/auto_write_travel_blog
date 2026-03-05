-- ============================================================
-- DATABASE: naver_blog_auto
-- ============================================================
CREATE DATABASE IF NOT EXISTS naver_blog_auto
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE naver_blog_auto;

-- ============================================================
-- TABLE 1: blog_style_samples - 스타일 참고 글
-- ============================================================
CREATE TABLE IF NOT EXISTS blog_style_samples (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    title      VARCHAR(500)  NOT NULL COMMENT '참고 포스트 제목',
    source_url VARCHAR(1000) NULL     COMMENT '네이버 블로그 원본 URL',
    content    LONGTEXT      NOT NULL COMMENT '참고용 본문 텍스트',
    category   VARCHAR(100)  NULL     COMMENT '카테고리 (맛집/여행/숙소 등)',
    style_tags VARCHAR(500)  NULL     COMMENT 'JSON 배열: ["반말", "이모지많음"]',
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active  TINYINT(1)    NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='글쓰기 스타일 참고 포스트';

-- ============================================================
-- TABLE 2: blog_drafts - 초안 (핵심 테이블)
-- ============================================================
CREATE TABLE IF NOT EXISTS blog_drafts (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    destination       VARCHAR(500)  NOT NULL COMMENT '여행지',
    travel_dates      VARCHAR(200)  NULL     COMMENT '여행 날짜',
    itinerary         TEXT          NULL     COMMENT '일정 개요',
    key_points        TEXT          NULL     COMMENT '강조할 포인트',
    category          VARCHAR(100)  NOT NULL DEFAULT '여행',
    generated_title   VARCHAR(500)  NULL     COMMENT 'AI 생성 제목',
    final_title       VARCHAR(500)  NULL     COMMENT '최종 편집 제목',
    generated_content LONGTEXT      NULL     COMMENT 'AI 생성 본문 (HTML)',
    final_content     LONGTEXT      NULL     COMMENT '최종 편집 본문 (HTML)',
    style_sample_ids  VARCHAR(500)  NULL     COMMENT '사용된 스타일 샘플 ID들 (JSON)',
    claude_model      VARCHAR(100)  NOT NULL DEFAULT 'claude-sonnet-4-6',
    generation_tokens INT           NULL,
    status            ENUM('DRAFT','GENERATED','EDITING','READY','POSTED','FAILED') NOT NULL DEFAULT 'DRAFT',
    naver_post_url    VARCHAR(1000) NULL,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='블로그 초안';

-- ============================================================
-- TABLE 3: blog_images - 업로드 이미지
-- ============================================================
CREATE TABLE IF NOT EXISTS blog_images (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    draft_id       BIGINT        NULL,
    original_name  VARCHAR(500)  NOT NULL,
    stored_path    VARCHAR(1000) NOT NULL,
    public_url     VARCHAR(1000) NULL,
    file_size      BIGINT        NOT NULL DEFAULT 0,
    mime_type      VARCHAR(100)  NOT NULL DEFAULT 'image/jpeg',
    ai_description TEXT          NULL     COMMENT 'Claude Vision 이미지 설명',
    display_order  INT           NOT NULL DEFAULT 0,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_images_draft FOREIGN KEY (draft_id) REFERENCES blog_drafts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='업로드된 이미지';

-- ============================================================
-- TABLE 4: post_history - 발행 히스토리
-- ============================================================
CREATE TABLE IF NOT EXISTS post_history (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    draft_id         BIGINT        NOT NULL,
    naver_post_url   VARCHAR(1000) NOT NULL,
    title            VARCHAR(500)  NOT NULL,
    content_snapshot LONGTEXT      NOT NULL,
    category         VARCHAR(100)  NOT NULL,
    image_count      INT           NOT NULL DEFAULT 0,
    posted_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    automation_log   TEXT          NULL,
    CONSTRAINT fk_history_draft FOREIGN KEY (draft_id) REFERENCES blog_drafts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='발행 히스토리';

-- ============================================================
-- TABLE 5: naver_credentials - 네이버 로그인 정보 (암호화)
-- ============================================================
CREATE TABLE IF NOT EXISTS naver_credentials (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    encrypted_id       VARCHAR(500) NOT NULL,
    encrypted_password VARCHAR(500) NOT NULL,
    blog_id            VARCHAR(200) NULL,
    updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='네이버 로그인 정보 (암호화)';

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_drafts_status   ON blog_drafts(status);
CREATE INDEX idx_drafts_created  ON blog_drafts(created_at);
CREATE INDEX idx_images_draft_id ON blog_images(draft_id);
CREATE INDEX idx_history_posted  ON post_history(posted_at);
