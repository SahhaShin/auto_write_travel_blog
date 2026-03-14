package com.shincha.naverblog.model.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shincha.naverblog.model.dao.TravelDao;
import com.shincha.naverblog.model.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TravelServiceImpl {

    private final TravelDao travelDao;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    @Value("${gemini.api.model:gemini-2.5-flash}")
    private String geminiModel;

    // ── Trip CRUD ───────────────────────────────────────────────────────────

    public TravelTrip createTrip(TravelTrip trip, Long userId) {
        trip.setUserId(userId);
        if (trip.getStatus() == null) trip.setStatus("PLANNING");
        travelDao.insertTrip(trip);
        return trip;
    }

    public List<TravelTrip> getTrips(Long userId) {
        return travelDao.findTripsByUserId(userId);
    }

    public TravelTrip getTrip(Long id, Long userId) {
        TravelTrip trip = travelDao.findTripById(id, userId);
        if (trip == null) return null;
        trip.setItinerary(travelDao.findItineraryByTripId(id));
        trip.setChecklist(travelDao.findChecklistByTripId(id));
        trip.setExpenses(travelDao.findExpensesByTripId(id));
        return trip;
    }

    public void updateTrip(TravelTrip trip, Long userId) {
        trip.setUserId(userId);
        travelDao.updateTrip(trip);
    }

    public void deleteTrip(Long id, Long userId) {
        travelDao.deleteTrip(id, userId);
    }

    // ── Itinerary CRUD ──────────────────────────────────────────────────────

    public TravelItinerary addItinerary(TravelItinerary item) {
        if (item.getDisplayOrder() == null) item.setDisplayOrder(0);
        travelDao.insertItinerary(item);
        return item;
    }

    public void updateItinerary(TravelItinerary item) {
        travelDao.updateItinerary(item);
    }

    public void deleteItinerary(Long id) {
        travelDao.deleteItinerary(id);
    }

    // ── Checklist CRUD ──────────────────────────────────────────────────────

    public TravelChecklist addChecklist(TravelChecklist item) {
        if (item.getStatus() == null) item.setStatus("NOT_STARTED");
        if (item.getDisplayOrder() == null) item.setDisplayOrder(0);
        travelDao.insertChecklist(item);
        return item;
    }

    public void updateChecklistStatus(Long id, String status) {
        travelDao.updateChecklistStatus(id, status);
    }

    public void updateChecklistItem(TravelChecklist item) {
        travelDao.updateChecklistItem(item);
    }

    public void deleteChecklist(Long id) {
        travelDao.deleteChecklist(id);
    }

    // ── Expense CRUD ────────────────────────────────────────────────────────

    public TravelExpense addExpense(TravelExpense expense) {
        if (expense.getSettled() == null) expense.setSettled(false);
        // 1인 기준 자동 계산
        recalcPerPerson(expense);
        travelDao.insertExpense(expense);
        return expense;
    }

    public void updateExpense(TravelExpense expense) {
        recalcPerPerson(expense);
        travelDao.updateExpense(expense);
    }

    public void deleteExpense(Long id) {
        travelDao.deleteExpense(id);
    }

    private void recalcPerPerson(TravelExpense expense) {
        // travelers 정보가 없으면 1인 = 전체로 그냥 넘어감 (컨트롤러에서 세팅)
    }

    // ── AI 여행 계획 생성 ────────────────────────────────────────────────────

    public Map<String, Object> generatePlan(Long tripId, Long userId) {
        TravelTrip trip = travelDao.findTripById(tripId, userId);
        if (trip == null) throw new RuntimeException("여행을 찾을 수 없습니다.");

        int nights = calculateNights(trip.getStartDate(), trip.getEndDate());
        int days = nights + 1;

        String prompt = buildGeneratePlanPrompt(trip, nights, days);
        String jsonResponse = callGemini(prompt);

        return parseAndSaveGeneratedPlan(trip, jsonResponse);
    }

    public List<TravelItinerary> fillGaps(Long tripId, Long userId) {
        TravelTrip trip = travelDao.findTripById(tripId, userId);
        if (trip == null) throw new RuntimeException("여행을 찾을 수 없습니다.");

        List<TravelItinerary> existing = travelDao.findItineraryByTripId(tripId);
        String prompt = buildFillGapsPrompt(trip, existing);
        String jsonResponse = callGemini(prompt);

        return parseAndSaveNewItems(tripId, jsonResponse);
    }

    public Map<String, Object> completePlan(Long tripId, String existingPlanText,
                                             List<Map<String, String>> images, Long userId) {
        TravelTrip trip = travelDao.findTripById(tripId, userId);
        if (trip == null) throw new RuntimeException("여행을 찾을 수 없습니다.");

        int nights = calculateNights(trip.getStartDate(), trip.getEndDate());
        int days = nights + 1;

        String prompt = buildCompletePlanPrompt(trip, existingPlanText, days);
        String jsonResponse = (images != null && !images.isEmpty())
                ? callGeminiMultimodal(prompt, images)
                : callGemini(prompt);

        return parseAndSaveGeneratedPlan(trip, jsonResponse);
    }

    // ── 프롬프트 빌더 ────────────────────────────────────────────────────────

    private String buildGeneratePlanPrompt(TravelTrip trip, int nights, int days) {
        return String.format("""
            당신은 전문 여행 플래너입니다. 아래 정보를 바탕으로 상세한 여행 계획을 JSON으로 생성해주세요.

            여행 정보:
            - 여행지: %s
            - 기간: %d박 %d일 (%s ~ %s)
            - 인원: %d명
            - 여행 스타일: %s
            - 1인 예산: %s

            다음 JSON 형식으로 응답해주세요. JSON 외 다른 텍스트는 절대 포함하지 마세요:
            {
              "itinerary": [
                {
                  "dayNumber": 1,
                  "timeStart": "09:00",
                  "timeEnd": "11:00",
                  "activity": "활동명",
                  "category": "교통|식사|활동|항공|숙소|기타",
                  "cost": 0,
                  "memo": "메모"
                }
              ],
              "checklist": {
                "prePrepItems": ["비자 발급", "항공권 예매", "숙소 예약", "여행자 보험 가입", "유심 구매", "환전하기", "에티켓 알아두기", "일기예보 확인"],
                "documentsItems": ["여권", "여권 사본", "항공권 E-ticket", "해외여행자보험 가입증명서", "숙소 바우처", "투어 바우처"],
                "packingItems": ["여권", "여권지갑", "트래블 카드", "이어폰", "보조배터리", "멀티 어댑터", "상비약", "선크림"]
              },
              "info": [
                {"title": "입국 정보", "content": "..."},
                {"title": "환율 정보", "content": "..."},
                {"title": "시차 정보", "content": "..."},
                {"title": "현지 교통", "content": "..."},
                {"title": "에티켓", "content": "..."}
              ]
            }
            """,
                trip.getDestination(), nights, days,
                trip.getStartDate() != null ? trip.getStartDate().toString() : "미정",
                trip.getEndDate() != null ? trip.getEndDate().toString() : "미정",
                trip.getTravelers() != null ? trip.getTravelers() : 1,
                trip.getTravelStyle() != null ? trip.getTravelStyle() : "일반",
                trip.getBudgetPerPerson() != null ? trip.getBudgetPerPerson() + "원" : "미정"
        );
    }

    private String buildFillGapsPrompt(TravelTrip trip, List<TravelItinerary> existing) {
        StringBuilder existingStr = new StringBuilder();
        for (TravelItinerary item : existing) {
            existingStr.append(String.format("  %d일차 %s~%s: %s (%s)\n",
                    item.getDayNumber(),
                    item.getTimeStart() != null ? item.getTimeStart() : "?",
                    item.getTimeEnd() != null ? item.getTimeEnd() : "?",
                    item.getActivity(),
                    item.getCategory() != null ? item.getCategory() : "기타"));
        }

        return String.format("""
            당신은 전문 여행 플래너입니다. 아래 기존 여행 일정의 빈 시간대를 채워주세요.

            여행지: %s
            여행 스타일: %s

            기존 일정:
            %s

            빈 시간대에 추가할 활동만 JSON 배열로 응답해주세요. JSON 외 다른 텍스트는 절대 포함하지 마세요:
            {
              "newItems": [
                {
                  "dayNumber": 1,
                  "timeStart": "14:00",
                  "timeEnd": "16:00",
                  "activity": "추천 활동",
                  "category": "활동",
                  "cost": 0,
                  "memo": "메모"
                }
              ]
            }
            """,
                trip.getDestination(),
                trip.getTravelStyle() != null ? trip.getTravelStyle() : "일반",
                existingStr.toString()
        );
    }

    private String buildCompletePlanPrompt(TravelTrip trip, String existingPlan, int days) {
        return String.format("""
            당신은 전문 여행 플래너입니다. 아래 기존 여행 계획을 기반으로 완성된 여행 계획을 JSON으로 생성해주세요.

            여행 정보:
            - 여행지: %s
            - 기간: %d일
            - 여행 스타일: %s

            사용자의 기존 계획:
            %s

            위 계획을 반영하되 빠진 부분을 채워서 완성된 계획을 아래 JSON 형식으로 응답해주세요. JSON 외 다른 텍스트는 절대 포함하지 마세요:
            {
              "itinerary": [...],
              "checklist": {
                "prePrepItems": [...],
                "documentsItems": [...],
                "packingItems": [...]
              },
              "info": [...]
            }
            """,
                trip.getDestination(), days,
                trip.getTravelStyle() != null ? trip.getTravelStyle() : "일반",
                existingPlan
        );
    }

    // ── Gemini API 호출 ──────────────────────────────────────────────────────

    private String callGemini(String prompt) {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + geminiModel + ":generateContent?key=" + geminiApiKey;

        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of(
                        "role", "user",
                        "parts", List.of(Map.of("text", prompt))
                )),
                "generationConfig", Map.of(
                        "temperature", 0.7,
                        "maxOutputTokens", 8192
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            Map<String, Object> resp = response.getBody();
            List<Map> candidates = (List<Map>) resp.get("candidates");
            Map content = (Map) candidates.get(0).get("content");
            List<Map> parts = (List<Map>) content.get("parts");
            return (String) parts.get(0).get("text");
        } catch (Exception e) {
            log.error("Gemini API 호출 실패: {}", e.getMessage());
            throw new RuntimeException("AI 여행 계획 생성에 실패했습니다: " + e.getMessage());
        }
    }

    private String callGeminiMultimodal(String prompt, List<Map<String, String>> images) {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + geminiModel + ":generateContent?key=" + geminiApiKey;

        List<Map<String, Object>> parts = new ArrayList<>();
        for (Map<String, String> img : images) {
            parts.add(Map.of("inlineData", Map.of(
                    "mimeType", img.getOrDefault("mimeType", "image/jpeg"),
                    "data", img.get("data")
            )));
        }
        parts.add(Map.of("text", prompt));

        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("role", "user", "parts", parts)),
                "generationConfig", Map.of("temperature", 0.7, "maxOutputTokens", 8192)
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            Map<String, Object> resp = response.getBody();
            List<Map> candidates = (List<Map>) resp.get("candidates");
            Map content = (Map) candidates.get(0).get("content");
            List<Map> responseParts = (List<Map>) content.get("parts");
            return (String) responseParts.get(0).get("text");
        } catch (Exception e) {
            log.error("Gemini 멀티모달 API 호출 실패: {}", e.getMessage(), e);
            throw new RuntimeException("AI 이미지 분석에 실패했습니다: " + e.getMessage());
        }
    }

    // ── JSON 파싱 및 저장 ────────────────────────────────────────────────────

    private Map<String, Object> parseAndSaveGeneratedPlan(TravelTrip trip, String jsonText) {
        try {
            String cleanJson = extractJson(jsonText);
            JsonNode root = objectMapper.readTree(cleanJson);

            // 기존 일정 삭제 후 새로 저장
            travelDao.deleteItineraryByTripId(trip.getId());

            // 일정 파싱 및 저장
            List<TravelItinerary> itineraryList = new ArrayList<>();
            JsonNode itineraryNode = root.get("itinerary");
            if (itineraryNode != null && itineraryNode.isArray()) {
                int order = 0;
                for (JsonNode node : itineraryNode) {
                    TravelItinerary item = new TravelItinerary();
                    item.setTripId(trip.getId());
                    item.setDayNumber(node.has("dayNumber") ? node.get("dayNumber").asInt() : 1);
                    item.setTimeStart(node.has("timeStart") ? node.get("timeStart").asText(null) : null);
                    item.setTimeEnd(node.has("timeEnd") ? node.get("timeEnd").asText(null) : null);
                    item.setActivity(node.has("activity") ? node.get("activity").asText() : "");
                    item.setCategory(node.has("category") ? node.get("category").asText("기타") : "기타");
                    item.setCost(node.has("cost") ? new BigDecimal(node.get("cost").asText("0")) : BigDecimal.ZERO);
                    item.setMemo(node.has("memo") ? node.get("memo").asText(null) : null);
                    item.setDisplayOrder(order++);

                    // 날짜 계산
                    if (trip.getStartDate() != null) {
                        item.setDate(trip.getStartDate().plusDays(item.getDayNumber() - 1));
                    }
                    itineraryList.add(item);
                }
                if (!itineraryList.isEmpty()) {
                    travelDao.insertItineraryBatch(itineraryList);
                }
            }

            // 체크리스트 파싱 및 저장 (기존 삭제 후 저장)
            List<TravelChecklist> checklistItems = new ArrayList<>();
            JsonNode checklistNode = root.get("checklist");
            if (checklistNode != null) {
                addChecklistItems(checklistItems, trip.getId(), "PRE_PREP",
                        checklistNode.get("prePrepItems"));
                addChecklistItems(checklistItems, trip.getId(), "DOCUMENTS",
                        checklistNode.get("documentsItems"));
                addChecklistItems(checklistItems, trip.getId(), "PACKING",
                        checklistNode.get("packingItems"));
            }
            if (!checklistItems.isEmpty()) {
                // 기존 체크리스트가 없을 때만 저장
                List<TravelChecklist> existing = travelDao.findChecklistByTripId(trip.getId());
                if (existing.isEmpty()) {
                    travelDao.insertChecklistBatch(checklistItems);
                }
            }

            // 각종 정보 파싱 및 저장
            JsonNode infoNode = root.get("info");
            if (infoNode != null && infoNode.isArray()) {
                List<Map<String, String>> infoList = new ArrayList<>();
                for (JsonNode node : infoNode) {
                    Map<String, String> infoItem = new HashMap<>();
                    infoItem.put("title", node.has("title") ? node.get("title").asText() : "");
                    infoItem.put("content", node.has("content") ? node.get("content").asText() : "");
                    infoList.add(infoItem);
                }
                TravelTrip update = new TravelTrip();
                update.setId(trip.getId());
                update.setUserId(trip.getUserId());
                update.setInfoContent(objectMapper.writeValueAsString(infoList));
                travelDao.updateTrip(update);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("itinerary", itineraryList);
            result.put("checklistCount", checklistItems.size());
            return result;

        } catch (Exception e) {
            log.error("AI 응답 파싱 실패: {}", e.getMessage());
            log.debug("Raw response: {}", jsonText);
            throw new RuntimeException("AI 응답 파싱 실패: " + e.getMessage());
        }
    }

    private List<TravelItinerary> parseAndSaveNewItems(Long tripId, String jsonText) {
        try {
            String cleanJson = extractJson(jsonText);
            JsonNode root = objectMapper.readTree(cleanJson);

            List<TravelItinerary> newItems = new ArrayList<>();
            JsonNode itemsNode = root.get("newItems");
            if (itemsNode != null && itemsNode.isArray()) {
                int order = 1000;
                for (JsonNode node : itemsNode) {
                    TravelItinerary item = new TravelItinerary();
                    item.setTripId(tripId);
                    item.setDayNumber(node.has("dayNumber") ? node.get("dayNumber").asInt() : 1);
                    item.setTimeStart(node.has("timeStart") ? node.get("timeStart").asText(null) : null);
                    item.setTimeEnd(node.has("timeEnd") ? node.get("timeEnd").asText(null) : null);
                    item.setActivity(node.has("activity") ? node.get("activity").asText() : "");
                    item.setCategory(node.has("category") ? node.get("category").asText("기타") : "기타");
                    item.setCost(node.has("cost") ? new BigDecimal(node.get("cost").asText("0")) : BigDecimal.ZERO);
                    item.setMemo(node.has("memo") ? node.get("memo").asText(null) : null);
                    item.setDisplayOrder(order++);
                    newItems.add(item);
                }
                if (!newItems.isEmpty()) {
                    travelDao.insertItineraryBatch(newItems);
                }
            }
            return newItems;
        } catch (Exception e) {
            log.error("빈 시간 채우기 파싱 실패: {}", e.getMessage());
            throw new RuntimeException("AI 응답 파싱 실패: " + e.getMessage());
        }
    }

    private void addChecklistItems(List<TravelChecklist> list, Long tripId,
                                    String category, JsonNode arrayNode) {
        if (arrayNode == null || !arrayNode.isArray()) return;
        int order = 0;
        for (JsonNode node : arrayNode) {
            TravelChecklist item = new TravelChecklist();
            item.setTripId(tripId);
            item.setCategory(category);
            item.setItem(node.asText());
            item.setStatus("NOT_STARTED");
            item.setDisplayOrder(order++);
            list.add(item);
        }
    }

    private String extractJson(String text) {
        // ```json ... ``` 블록 제거
        text = text.trim();
        if (text.startsWith("```")) {
            int start = text.indexOf('\n');
            int end = text.lastIndexOf("```");
            if (start >= 0 && end > start) {
                text = text.substring(start + 1, end).trim();
            }
        }
        // { 로 시작하는 부분 찾기
        int jsonStart = text.indexOf('{');
        int jsonEnd = text.lastIndexOf('}');
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
            text = text.substring(jsonStart, jsonEnd + 1);
        }
        return text;
    }

    private int calculateNights(LocalDate start, LocalDate end) {
        if (start == null || end == null) return 6;
        return (int) java.time.temporal.ChronoUnit.DAYS.between(start, end);
    }
}
