package com.shincha.naverblog.controller;

import com.shincha.naverblog.model.dao.UserDao;
import com.shincha.naverblog.model.dto.User;
import com.shincha.naverblog.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtUtil jwtUtil;
    private final UserDao userDao;
    private final BCryptPasswordEncoder passwordEncoder;
    private final RestTemplate restTemplate;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        if (username == null || username.isBlank() || password == null || password.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "아이디와 비밀번호(6자 이상)를 입력해주세요."));
        }
        if (userDao.findByUsername(username) != null) {
            return ResponseEntity.badRequest().body(Map.of("error", "이미 사용 중인 아이디입니다."));
        }

        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(password));
        userDao.insert(user);

        String token = jwtUtil.generate(user.getId(), username);
        return ResponseEntity.ok(Map.of("token", token, "username", username));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        User user = userDao.findByUsername(username);
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            return ResponseEntity.status(401).body(Map.of("error", "아이디 또는 비밀번호가 올바르지 않습니다."));
        }

        String token = jwtUtil.generate(user.getId(), username);
        return ResponseEntity.ok(Map.of("token", token, "username", username));
    }

    @PostMapping("/google")
    public ResponseEntity<?> googleLogin(@RequestBody Map<String, String> body) {
        String idToken = body.get("idToken");
        if (idToken == null || idToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "idToken이 필요합니다."));
        }

        // Google tokeninfo endpoint로 검증
        String verifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken;
        Map<?, ?> tokenInfo;
        try {
            tokenInfo = restTemplate.getForObject(verifyUrl, Map.class);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Google 토큰 검증 실패"));
        }

        if (tokenInfo == null || tokenInfo.get("sub") == null) {
            return ResponseEntity.status(401).body(Map.of("error", "유효하지 않은 Google 토큰"));
        }

        String googleId = tokenInfo.get("sub").toString();
        String email = tokenInfo.containsKey("email") ? tokenInfo.get("email").toString() : googleId;
        String name = tokenInfo.containsKey("name") ? tokenInfo.get("name").toString() : email;

        // 기존 Google 연동 계정 조회
        User user = userDao.findByGoogleId(googleId);
        if (user == null) {
            // 이메일로 기존 계정 조회 후 연동
            user = userDao.findByUsername(email);
            if (user == null) {
                // 신규 가입
                user = new User();
                user.setUsername(email);
                user.setGoogleId(googleId);
                userDao.insert(user);
            } else {
                // 이메일 일치 계정에 googleId 연동
                userDao.updateGoogleId(user.getId(), googleId);
                user.setGoogleId(googleId);
            }
        }

        String token = jwtUtil.generate(user.getId(), user.getUsername());
        return ResponseEntity.ok(Map.of("token", token, "username", user.getUsername()));
    }
}
