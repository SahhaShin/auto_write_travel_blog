package com.shincha.naverblog.model.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class NaverCredentials {
    private Integer id;
    private String encryptedId;
    private String encryptedPassword;
    private String blogId;
    private LocalDateTime updatedAt;
}
