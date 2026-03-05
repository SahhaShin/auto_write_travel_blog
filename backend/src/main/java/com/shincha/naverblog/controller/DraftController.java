package com.shincha.naverblog.controller;

import com.shincha.naverblog.model.dto.BlogDraft;
import com.shincha.naverblog.model.service.DraftService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/drafts")
@RequiredArgsConstructor
public class DraftController {

    private final DraftService draftService;

    @GetMapping
    public ResponseEntity<List<BlogDraft>> getAll() {
        return ResponseEntity.ok(draftService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<BlogDraft> getById(@PathVariable Long id) {
        BlogDraft draft = draftService.getById(id);
        if (draft == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(draft);
    }

    @PostMapping
    public ResponseEntity<BlogDraft> create(@RequestBody BlogDraft draft) {
        BlogDraft created = draftService.create(draft);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<BlogDraft> update(@PathVariable Long id, @RequestBody BlogDraft draft) {
        draft.setId(id);
        return ResponseEntity.ok(draftService.update(draft));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        draftService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
