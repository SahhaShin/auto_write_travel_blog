package com.shincha.naverblog.model.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class TravelItinerary {
    private Long id;
    private Long tripId;
    private Integer dayNumber;
    private LocalDate date;
    private String timeStart;
    private String timeEnd;
    private String activity;
    private String address;    // 미사용 (하위 호환)
    private Double lat;        // 위도 (구글 지도 좌표)
    private Double lng;        // 경도 (구글 지도 좌표)
    private String category;   // 교통, 식사, 활동, 항공, 숙소, 기타
    private BigDecimal cost;   // 현지 통화
    private String memo;
    private Integer displayOrder;
    private LocalDateTime createdAt;
}
