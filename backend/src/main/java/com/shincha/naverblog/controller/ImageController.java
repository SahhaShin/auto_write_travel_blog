package com.shincha.naverblog.controller;

import com.shincha.naverblog.model.dto.BlogImage;
import com.shincha.naverblog.model.service.ImageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/images")
@RequiredArgsConstructor
public class ImageController {

    private final ImageService imageService;

    @PostMapping("/upload")
    public ResponseEntity<List<BlogImage>> upload(
            @RequestParam("files") MultipartFile[] files,
            @RequestParam(value = "draftId", required = false) Long draftId) {
        List<BlogImage> images = imageService.uploadImages(files, draftId);
        return ResponseEntity.ok(images);
    }

    @GetMapping("/draft/{draftId}")
    public ResponseEntity<List<BlogImage>> getByDraft(@PathVariable Long draftId) {
        return ResponseEntity.ok(imageService.getByDraftId(draftId));
    }

    @PutMapping("/{id}/order")
    public ResponseEntity<Void> updateOrder(
            @PathVariable Long id,
            @RequestBody Map<String, Integer> body) {
        imageService.updateOrder(id, body.get("displayOrder"));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        imageService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
