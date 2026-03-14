package com.shincha.naverblog.model.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class TravelTrip {
    private Long id;
    private Long userId;
    private String title;
    private String destination;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer travelers;
    private BigDecimal budgetPerPerson;
    private String travelStyle;
    private String currency;        // 현지 통화 코드 예: AUD, JPY
    private BigDecimal exchangeRate; // 현지통화 1단위 → 원화
    private String status;          // PLANNING, CONFIRMED, COMPLETED
    private String infoContent;     // JSON text: 각종 정보
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // 비DB 조회용
    private List<TravelItinerary> itinerary;
    private List<TravelChecklist> checklist;
    private List<TravelExpense> expenses;
}
