package com.shincha.naverblog.model.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class TravelChecklist {
    private Long id;
    private Long tripId;
    private String category;   // PRE_PREP, DOCUMENTS, PACKING
    private String item;
    private String status;     // NOT_STARTED, IN_PROGRESS, DONE
    private Integer displayOrder;
    private LocalDateTime createdAt;
}
