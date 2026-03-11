package com.shincha.naverblog.controller;

import com.shincha.naverblog.model.dto.BlogStyleSample;
import com.shincha.naverblog.model.service.StyleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/styles")
@RequiredArgsConstructor
public class StyleController {

    private final StyleService styleService;

    @GetMapping
    public ResponseEntity<List<BlogStyleSample>> getAll() {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(styleService.getAll(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BlogStyleSample> getById(@PathVariable Long id) {
        BlogStyleSample sample = styleService.getById(id);
        if (sample == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(sample);
    }

    @PostMapping
    public ResponseEntity<BlogStyleSample> addFromText(@RequestBody BlogStyleSample sample) {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        sample.setUserId(userId);
        return ResponseEntity.ok(styleService.addFromText(sample));
    }

    @PostMapping("/from-url")
    public ResponseEntity<?> addFromUrl(@RequestBody Map<String, String> body) {
        try {
            Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            String url = body.get("url");
            String category = body.get("category");
            if (url == null || url.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "URL이 필요합니다."));
            }
            BlogStyleSample saved = styleService.addFromUrl(url, category, userId);
            return ResponseEntity.ok(saved);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        styleService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
