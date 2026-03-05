package com.shincha.naverblog.model.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shincha.naverblog.model.dao.DraftDao;
import com.shincha.naverblog.model.dao.ImageDao;
import com.shincha.naverblog.model.dao.StyleDao;
import com.shincha.naverblog.model.dto.BlogDraft;
import com.shincha.naverblog.model.dto.BlogImage;
import com.shincha.naverblog.model.dto.BlogStyleSample;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClaudeServiceImpl implements ClaudeService {

    private final DraftDao draftDao;
    private final ImageDao imageDao;
    private final StyleDao styleDao;

    @Value("${claude.api.key}")
    private String claudeApiKey;

    @Value("${claude.api.model:claude-sonnet-4-6}")
    private String claudeModel;

    @Value("${claude.api.max-tokens:4096}")
    private int maxTokens;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    @Override
    public BlogDraft generateContent(Long draftId, List<Long> styleSampleIds) {
        return generate(draftId, styleSampleIds, null);
    }

    @Override
    public BlogDraft regenerateContent(Long draftId, List<Long> styleSampleIds, String customInstructions) {
        return generate(draftId, styleSampleIds, customInstructions);
    }

    private BlogDraft generate(Long draftId, List<Long> styleSampleIds, String customInstructions) {
        BlogDraft draft = draftDao.findById(draftId);
        if (draft == null) {
            throw new RuntimeException("Draft를 찾을 수 없습니다: " + draftId);
        }

        List<BlogImage> images = imageDao.findByDraftId(draftId);
        List<BlogStyleSample> styleSamples = styleSampleIds != null && !styleSampleIds.isEmpty()
                ? styleSampleIds.stream().map(styleDao::findById).collect(Collectors.toList())
                : styleDao.findAll().stream().limit(3).collect(Collectors.toList());

        String systemPrompt = buildSystemPrompt(styleSamples);
        String userPrompt = buildUserPrompt(draft, images, customInstructions);

        try {
            String requestBody = buildClaudeRequest(systemPrompt, userPrompt);
            log.debug("Claude API 요청 시작 - draftId: {}", draftId);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.anthropic.com/v1/messages"))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", claudeApiKey)
                    .header("anthropic-version", "2023-06-01")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(120))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Claude API 오류: {} - {}", response.statusCode(), response.body());
                throw new RuntimeException("Claude API 오류: " + response.statusCode());
            }

            JsonNode responseJson = objectMapper.readTree(response.body());
            String generatedText = responseJson.path("content").get(0).path("text").asText();
            int inputTokens = responseJson.path("usage").path("input_tokens").asInt();
            int outputTokens = responseJson.path("usage").path("output_tokens").asInt();

            // 제목과 본문 분리 (생성된 텍스트에서 첫 줄을 제목으로 사용)
            String[] parts = generatedText.split("\n", 2);
            String title = extractTitle(parts[0]);
            String content = parts.length > 1 ? parts[1].trim() : generatedText;

            // DB에 저장
            draftDao.updateGenerated(draftId, title, content, claudeModel, inputTokens + outputTokens);

            log.info("Claude 글 생성 완료 - draftId: {}, tokens: {}", draftId, inputTokens + outputTokens);
            return draftDao.findById(draftId);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Claude API 요청이 중단되었습니다");
        } catch (Exception e) {
            log.error("Claude API 호출 실패", e);
            throw new RuntimeException("AI 글 생성에 실패했습니다: " + e.getMessage());
        }
    }

    private String buildSystemPrompt(List<BlogStyleSample> styleSamples) {
        StringBuilder sb = new StringBuilder();
        sb.append("당신은 한국 네이버 블로그 여행 포스트 전문 작가입니다.\n");
        sb.append("아래 참고 글들의 문체, 어조, 이모지 사용 패턴, 문장 길이, 구성 방식을 분석하고 ");
        sb.append("동일한 개성과 스타일로 새 여행 블로그 포스트를 작성하세요.\n\n");

        if (!styleSamples.isEmpty()) {
            sb.append("=== 참고 스타일 글들 ===\n\n");
            for (int i = 0; i < styleSamples.size(); i++) {
                BlogStyleSample sample = styleSamples.get(i);
                if (sample == null) continue;
                sb.append("[참고 ").append(i + 1).append("] ").append(sample.getTitle()).append("\n");
                // 너무 길면 첫 1000자만 사용
                String content = sample.getContent();
                if (content.length() > 1000) {
                    content = content.substring(0, 1000) + "...";
                }
                sb.append(content).append("\n\n");
            }
        }

        sb.append("=== 작성 규칙 ===\n");
        sb.append("1. 응답의 첫 줄은 반드시 블로그 제목 (예: # 제주도 3박4일 완벽 여행기)\n");
        sb.append("2. 본문은 HTML 형식으로 작성: <h2>, <p>, <br>, <strong> 태그만 사용\n");
        sb.append("3. 이미지 삽입 위치는 [IMAGE_1], [IMAGE_2] 등의 플레이스홀더로 표시\n");
        sb.append("4. 한국어로 작성, 참고 글의 이모지 사용 패턴 유지\n");
        sb.append("5. 네이버 블로그 독자를 위한 친근하고 읽기 쉬운 문체 유지\n");

        return sb.toString();
    }

    private String buildUserPrompt(BlogDraft draft, List<BlogImage> images, String customInstructions) {
        StringBuilder sb = new StringBuilder();
        sb.append("아래 여행 정보를 바탕으로 블로그 포스트를 작성해주세요:\n\n");
        sb.append("여행지: ").append(draft.getDestination()).append("\n");

        if (draft.getTravelDates() != null) {
            sb.append("여행 날짜: ").append(draft.getTravelDates()).append("\n");
        }
        if (draft.getItinerary() != null) {
            sb.append("일정 개요:\n").append(draft.getItinerary()).append("\n");
        }
        if (draft.getKeyPoints() != null) {
            sb.append("강조할 포인트:\n").append(draft.getKeyPoints()).append("\n");
        }
        sb.append("카테고리: ").append(draft.getCategory()).append("\n");

        if (!images.isEmpty()) {
            sb.append("\n업로드된 이미지 목록 (순서대로 [IMAGE_N] 플레이스홀더 사용):\n");
            for (int i = 0; i < images.size(); i++) {
                BlogImage img = images.get(i);
                sb.append("[IMAGE_").append(i + 1).append("] - ").append(img.getOriginalName());
                if (img.getAiDescription() != null) {
                    sb.append(" (").append(img.getAiDescription()).append(")");
                }
                sb.append("\n");
            }
        }

        if (customInstructions != null && !customInstructions.isBlank()) {
            sb.append("\n추가 요청사항: ").append(customInstructions).append("\n");
        }

        return sb.toString();
    }

    private String buildClaudeRequest(String systemPrompt, String userPrompt) throws Exception {
        var requestMap = new java.util.HashMap<String, Object>();
        requestMap.put("model", claudeModel);
        requestMap.put("max_tokens", maxTokens);
        requestMap.put("system", systemPrompt);
        requestMap.put("messages", List.of(
                java.util.Map.of("role", "user", "content", userPrompt)
        ));
        return objectMapper.writeValueAsString(requestMap);
    }

    private String extractTitle(String firstLine) {
        // "# 제목" 형태에서 #와 공백 제거
        return firstLine.replaceAll("^#+\\s*", "").trim();
    }
}
