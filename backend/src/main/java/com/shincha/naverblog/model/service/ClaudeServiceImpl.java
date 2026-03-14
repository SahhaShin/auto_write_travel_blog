package com.shincha.naverblog.model.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shincha.naverblog.model.dao.DraftDao;
import com.shincha.naverblog.model.dao.ImageDao;
import com.shincha.naverblog.model.dao.StyleDao;
import com.shincha.naverblog.model.dao.TravelDao;
import com.shincha.naverblog.model.dto.BlogDraft;
import com.shincha.naverblog.model.dto.BlogImage;
import com.shincha.naverblog.model.dto.BlogStyleSample;
import com.shincha.naverblog.model.dto.TravelChecklist;
import com.shincha.naverblog.model.dto.TravelExpense;
import com.shincha.naverblog.model.dto.TravelItinerary;
import com.shincha.naverblog.model.dto.TravelTrip;
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
    private final TravelDao travelDao;

    @Value("${claude.api.key}")
    private String claudeApiKey;

    @Value("${claude.api.model:claude-sonnet-4-6}")
    private String claudeModel;

    @Value("${claude.api.max-tokens:4096}")
    private int maxTokens;

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    @Value("${gemini.api.model:gemini-2.0-flash}")
    private String geminiModel;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    @Override
    public BlogDraft generateContent(Long draftId, List<Long> styleSampleIds, Long userId) {
        return generate(draftId, styleSampleIds, null, userId);
    }

    @Override
    public BlogDraft regenerateContent(Long draftId, List<Long> styleSampleIds, String customInstructions, Long userId) {
        return generate(draftId, styleSampleIds, customInstructions, userId);
    }

    private BlogDraft generate(Long draftId, List<Long> styleSampleIds, String customInstructions, Long userId) {
        BlogDraft draft = draftDao.findById(draftId);
        if (draft == null) {
            throw new RuntimeException("Draft를 찾을 수 없습니다: " + draftId);
        }

        List<BlogImage> images = imageDao.findByDraftId(draftId);
        List<BlogStyleSample> styleSamples = styleSampleIds != null && !styleSampleIds.isEmpty()
                ? styleSampleIds.stream().map(styleDao::findById).collect(Collectors.toList())
                : styleDao.findAllByUserId(userId).stream().limit(3).collect(Collectors.toList());

        String systemPrompt = buildSystemPrompt(styleSamples);
        String userPrompt = buildUserPrompt(draft, images, customInstructions);

        try {
            String generatedText = callClaude(systemPrompt, userPrompt);
            return saveGenerated(draftId, generatedText, claudeModel);

        } catch (CreditExhaustedException e) {
            log.warn("Claude 크레딧 소진 → Gemini fallback 시도 - draftId: {}", draftId);
            if (geminiApiKey == null || geminiApiKey.isBlank() || geminiApiKey.equals("여기에_Gemini_API_키_입력")) {
                throw new RuntimeException("Claude 크레딧이 소진됐고, Gemini API 키도 설정되지 않았습니다.");
            }
            try {
                String generatedText = callGemini(systemPrompt, userPrompt);
                return saveGenerated(draftId, generatedText, geminiModel);
            } catch (Exception geminiEx) {
                log.error("Gemini API 호출 실패", geminiEx);
                throw new RuntimeException("Gemini AI 글 생성에 실패했습니다: " + geminiEx.getMessage());
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Claude API 요청이 중단되었습니다");
        } catch (Exception e) {
            log.error("Claude API 호출 실패", e);
            throw new RuntimeException("AI 글 생성에 실패했습니다: " + e.getMessage());
        }
    }

    // Claude 크레딧 소진 감지용 내부 예외
    private static class CreditExhaustedException extends RuntimeException {
        CreditExhaustedException(String msg) { super(msg); }
    }

    private String callClaude(String systemPrompt, String userPrompt) throws Exception {
        String requestBody = buildClaudeRequest(systemPrompt, userPrompt);
        log.debug("Claude API 요청 시작");

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
            if (response.body().contains("credit balance is too low") || response.body().contains("insufficient_quota")) {
                throw new CreditExhaustedException("Claude 크레딧 부족");
            }
            throw new RuntimeException("Claude API 오류: " + response.statusCode());
        }

        JsonNode json = objectMapper.readTree(response.body());
        log.info("Claude 글 생성 완료 - tokens: {}", json.path("usage").path("input_tokens").asInt() + json.path("usage").path("output_tokens").asInt());
        return json.path("content").get(0).path("text").asText();
    }

    private String callGemini(String systemPrompt, String userPrompt) throws Exception {
        log.debug("Gemini API 요청 시작");

        // Gemini: system + user 를 하나의 contents로 구성
        var requestMap = new java.util.HashMap<String, Object>();
        requestMap.put("system_instruction", java.util.Map.of(
                "parts", List.of(java.util.Map.of("text", systemPrompt))
        ));
        requestMap.put("contents", List.of(java.util.Map.of(
                "parts", List.of(java.util.Map.of("text", userPrompt))
        )));
        requestMap.put("generationConfig", java.util.Map.of("maxOutputTokens", maxTokens));

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + geminiModel + ":generateContent?key=" + geminiApiKey;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestMap)))
                .timeout(Duration.ofSeconds(120))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("Gemini API 오류: {} - {}", response.statusCode(), response.body());
            throw new RuntimeException("Gemini API 오류: " + response.statusCode() + " - " + response.body());
        }

        JsonNode json = objectMapper.readTree(response.body());
        String text = json.path("candidates").get(0)
                .path("content").path("parts").get(0)
                .path("text").asText();
        log.info("Gemini 글 생성 완료");
        return text;
    }

    private BlogDraft saveGenerated(Long draftId, String generatedText, String model) {
        String[] parts = generatedText.split("\n", 2);
        String title = extractTitle(parts[0]);
        String content = parts.length > 1 ? parts[1].trim() : generatedText;
        draftDao.updateGenerated(draftId, title, content, model, 0);
        return draftDao.findById(draftId);
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

        // 연결된 여행 계획이 있으면 상세 데이터 추가
        if (draft.getTripId() != null) {
            try {
                TravelTrip trip = travelDao.findTripById(draft.getTripId(), draft.getUserId());
                if (trip != null) {
                    List<TravelItinerary> itinerary = travelDao.findItineraryByTripId(trip.getId());
                    List<TravelExpense> expenses = travelDao.findExpensesByTripId(trip.getId());
                    sb.append(buildTripDataSection(trip, itinerary, expenses));
                }
            } catch (Exception e) {
                log.warn("여행 계획 데이터 로딩 실패 (tripId={}): {}", draft.getTripId(), e.getMessage());
            }
        }

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

    private String buildTripDataSection(TravelTrip trip, List<TravelItinerary> itinerary, List<TravelExpense> expenses) {
        StringBuilder sb = new StringBuilder();
        sb.append("\n=== 상세 여행 계획 데이터 (이 내용을 블로그에 풍부하게 녹여서 작성하세요) ===\n");

        // 기간/인원/스타일
        if (trip.getStartDate() != null && trip.getEndDate() != null) {
            long nights = java.time.temporal.ChronoUnit.DAYS.between(trip.getStartDate(), trip.getEndDate());
            sb.append(String.format("기간: %s ~ %s (%d박 %d일)\n", trip.getStartDate(), trip.getEndDate(), nights, nights + 1));
        }
        if (trip.getTravelers() != null) {
            sb.append("인원: ").append(trip.getTravelers()).append("명\n");
        }
        if (trip.getTravelStyle() != null) {
            sb.append("여행 스타일: ").append(trip.getTravelStyle()).append("\n");
        }

        // 날짜별 일정
        if (!itinerary.isEmpty()) {
            sb.append("\n[날짜별 일정]\n");
            int currentDay = -1;
            for (TravelItinerary item : itinerary) {
                if (item.getDayNumber() != currentDay) {
                    currentDay = item.getDayNumber();
                    String dateStr = item.getDate() != null
                        ? String.format(" (%s)", item.getDate())
                        : "";
                    sb.append(String.format("%d일차%s:\n", currentDay, dateStr));
                }
                String time = (item.getTimeStart() != null ? item.getTimeStart() : "")
                    + (item.getTimeEnd() != null ? "~" + item.getTimeEnd() : "");
                sb.append(String.format("  %s | %s | %s",
                    time.isEmpty() ? "-" : time,
                    item.getCategory() != null ? item.getCategory() : "기타",
                    item.getActivity()));
                if (item.getMemo() != null && !item.getMemo().isBlank()) {
                    sb.append(" (").append(item.getMemo()).append(")");
                }
                sb.append("\n");
            }
        }

        // 경비 요약
        if (!expenses.isEmpty()) {
            String currency = trip.getCurrency() != null ? trip.getCurrency() : "현지";
            double totalLocal = expenses.stream().mapToDouble(e -> e.getAmount() != null ? e.getAmount().doubleValue() : 0).sum();
            double totalKrw = expenses.stream().mapToDouble(e -> e.getAmountKrw() != null ? e.getAmountKrw().doubleValue() : 0).sum();
            double perPersonLocal = expenses.stream().mapToDouble(e -> e.getAmountPerPerson() != null ? e.getAmountPerPerson().doubleValue() : 0).sum();
            double perPersonKrw = expenses.stream().mapToDouble(e -> e.getAmountKrwPerPerson() != null ? e.getAmountKrwPerPerson().doubleValue() : 0).sum();

            sb.append(String.format("\n[경비 요약]\n총 %s %.2f", currency, totalLocal));
            if (totalKrw > 0) sb.append(String.format(" (약 ₩%,.0f)", totalKrw));
            sb.append("\n");
            if (perPersonLocal > 0) {
                sb.append(String.format("1인 기준: %s %.2f", currency, perPersonLocal));
                if (perPersonKrw > 0) sb.append(String.format(" (약 ₩%,.0f)", perPersonKrw));
                sb.append("\n");
            }

            // 카테고리별 주요 지출 (식사 위주로 구체적 내역)
            sb.append("\n[주요 지출 내역 - 블로그에 구체적으로 언급할 것]\n");
            for (TravelExpense e : expenses) {
                if (e.getItem() != null) {
                    sb.append(String.format("  - %s", e.getItem()));
                    if (e.getCategory() != null) sb.append(String.format(" [%s]", e.getCategory()));
                    if (e.getAmount() != null && e.getAmount().doubleValue() > 0) {
                        sb.append(String.format(" %s %.2f", currency, e.getAmount().doubleValue()));
                    }
                    if (e.getMemo() != null && !e.getMemo().isBlank()) sb.append(": ").append(e.getMemo());
                    sb.append("\n");
                }
            }
        }

        // 각종 정보 요약 (있을 경우)
        if (trip.getInfoContent() != null && !trip.getInfoContent().isBlank()) {
            try {
                ObjectMapper om = new ObjectMapper();
                var infoList = om.readTree(trip.getInfoContent());
                if (infoList.isArray() && infoList.size() > 0) {
                    sb.append("\n[현지 여행 정보 - 블로그 팁으로 활용]\n");
                    for (var node : infoList) {
                        String title = node.path("title").asText("");
                        String content = node.path("content").asText("");
                        if (!title.isBlank()) {
                            sb.append("▶ ").append(title).append("\n");
                            if (!content.isBlank()) {
                                // 너무 길면 200자만
                                sb.append(content.length() > 200 ? content.substring(0, 200) + "..." : content).append("\n");
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        sb.append("=== 여행 계획 데이터 끝 ===\n");
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
