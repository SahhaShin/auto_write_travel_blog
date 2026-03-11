package com.shincha.naverblog.controller;

import com.shincha.naverblog.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtUtil jwtUtil;

    @Value("${admin.username}")
    private String adminUsername;

    @Value("${admin.password}")
    private String adminPassword;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        if (adminUsername.equals(username) && adminPassword.equals(password)) {
            String token = jwtUtil.generate(username);
            return ResponseEntity.ok(Map.of("token", token, "username", username));
        }
        return ResponseEntity.status(401).body(Map.of("error", "아이디 또는 비밀번호가 올바르지 않습니다."));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        if (jwtUtil.isValid(token)) {
            return ResponseEntity.ok(Map.of("username", jwtUtil.extractUsername(token)));
        }
        return ResponseEntity.status(401).body(Map.of("error", "유효하지 않은 토큰입니다."));
    }
}
