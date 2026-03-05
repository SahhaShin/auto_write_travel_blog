package com.shincha.naverblog.controller;

import com.shincha.naverblog.model.dto.BlogDraft;
import com.shincha.naverblog.model.service.ClaudeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/generate")
@RequiredArgsConstructor
public class GenerateController {

    private final ClaudeService claudeService;

    @PostMapping("/{draftId}")
    public ResponseEntity<?> generate(
            @PathVariable Long draftId,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            List<Long> styleSampleIds = null;
            if (body != null && body.containsKey("styleSampleIds")) {
                List<?> rawList = (List<?>) body.get("styleSampleIds");
                styleSampleIds = rawList.stream()
                        .map(v -> Long.parseLong(v.toString()))
                        .toList();
            }
            BlogDraft result = claudeService.generateContent(draftId, styleSampleIds);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{draftId}/regenerate")
    public ResponseEntity<?> regenerate(
            @PathVariable Long draftId,
            @RequestBody Map<String, Object> body) {
        try {
            List<Long> styleSampleIds = null;
            if (body.containsKey("styleSampleIds")) {
                List<?> rawList = (List<?>) body.get("styleSampleIds");
                styleSampleIds = rawList.stream()
                        .map(v -> Long.parseLong(v.toString()))
                        .toList();
            }
            String customInstructions = (String) body.get("customInstructions");
            BlogDraft result = claudeService.regenerateContent(draftId, styleSampleIds, customInstructions);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
