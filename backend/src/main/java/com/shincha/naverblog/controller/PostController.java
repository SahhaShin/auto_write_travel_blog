package com.shincha.naverblog.controller;

import com.shincha.naverblog.model.dao.PostHistoryDao;
import com.shincha.naverblog.model.dto.PostHistory;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class PostController {

    private final PostHistoryDao postHistoryDao;

    @GetMapping("/api/history")
    public ResponseEntity<List<PostHistory>> getHistory() {
        return ResponseEntity.ok(postHistoryDao.findAll());
    }

    @GetMapping("/api/history/{id}")
    public ResponseEntity<PostHistory> getHistoryById(@PathVariable Long id) {
        PostHistory history = postHistoryDao.findById(id);
        if (history == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(history);
    }
}
