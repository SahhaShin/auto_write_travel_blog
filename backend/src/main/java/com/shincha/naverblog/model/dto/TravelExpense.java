package com.shincha.naverblog.model.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class TravelExpense {
    private Long id;
    private Long tripId;
    private LocalDate expenseDate;
    private String item;
    private String category;          // 교통, 식사, 활동, 쇼핑, 기타
    private String paymentMethod;     // 카드, 현금
    private BigDecimal amount;        // 현지 통화 (합계)
    private BigDecimal amountKrw;     // 원화 (합계)
    private BigDecimal amountPerPerson;    // 1인 현지 통화
    private BigDecimal amountKrwPerPerson; // 1인 원화
    private String memo;
    private Boolean settled;
    private LocalDateTime createdAt;
}
