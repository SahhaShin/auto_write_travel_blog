package com.shincha.naverblog.controller;

import com.shincha.naverblog.model.dao.NaverCredentialsDao;
import com.shincha.naverblog.model.dao.PostHistoryDao;
import com.shincha.naverblog.model.dto.NaverCredentials;
import com.shincha.naverblog.model.dto.PostHistory;
import com.shincha.naverblog.model.service.NaverAutoPostService;
import com.shincha.naverblog.util.EncryptionUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class PostController {

    private final NaverAutoPostService naverAutoPostService;
    private final NaverCredentialsDao credentialsDao;
    private final PostHistoryDao postHistoryDao;
    private final EncryptionUtil encryptionUtil;

    // 자동 포스팅 시작 (비동기)
    @PostMapping("/api/post/{draftId}")
    public ResponseEntity<Map<String, String>> startPost(@PathVariable Long draftId) {
        naverAutoPostService.postAsync(draftId);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(Map.of("message", "포스팅을 시작했습니다.", "draftId", draftId.toString()));
    }

    // 포스팅 상태 조회 (폴링용)
    @GetMapping("/api/post/status/{draftId}")
    public ResponseEntity<Map<String, String>> getStatus(@PathVariable Long draftId) {
        String status = naverAutoPostService.getStatus(draftId);
        return ResponseEntity.ok(Map.of("status", status, "draftId", draftId.toString()));
    }

    // 2차 인증 OTP 제출
    @PostMapping("/api/post/otp/{draftId}")
    public ResponseEntity<Map<String, String>> submitOtp(
            @PathVariable Long draftId,
            @RequestBody Map<String, String> body) {
        String otp = body.get("otp");
        if (otp == null || otp.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "OTP를 입력해주세요."));
        }
        naverAutoPostService.submitOtp(draftId, otp);
        return ResponseEntity.ok(Map.of("message", "OTP가 제출되었습니다."));
    }

    // 네이버 자격증명 저장/업데이트
    @PutMapping("/api/credentials")
    public ResponseEntity<?> saveCredentials(@RequestBody Map<String, String> body) {
        try {
            String naverId = body.get("naverId");
            String naverPassword = body.get("naverPassword");
            String blogId = body.get("blogId");

            if (naverId == null || naverPassword == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "아이디와 비밀번호는 필수입니다."));
            }

            NaverCredentials creds = new NaverCredentials();
            creds.setEncryptedId(encryptionUtil.encrypt(naverId));
            creds.setEncryptedPassword(encryptionUtil.encrypt(naverPassword));
            creds.setBlogId(blogId);

            credentialsDao.upsert(creds);
            return ResponseEntity.ok(Map.of("message", "로그인 정보가 저장되었습니다."));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // 발행 히스토리 목록
    @GetMapping("/api/history")
    public ResponseEntity<List<PostHistory>> getHistory() {
        return ResponseEntity.ok(postHistoryDao.findAll());
    }

    // 발행 히스토리 상세
    @GetMapping("/api/history/{id}")
    public ResponseEntity<PostHistory> getHistoryById(@PathVariable Long id) {
        PostHistory history = postHistoryDao.findById(id);
        if (history == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(history);
    }
}
