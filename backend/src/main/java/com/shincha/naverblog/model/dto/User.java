package com.shincha.naverblog.model.dto;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class User {
    private Long id;
    private String username;
    private String passwordHash;
    private String googleId;
    private LocalDateTime createdAt;
}
