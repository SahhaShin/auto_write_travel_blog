package com.shincha.naverblog.model.service;

import com.shincha.naverblog.model.dto.BlogImage;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

public interface ImageService {
    List<BlogImage> uploadImages(MultipartFile[] files, Long draftId);
    List<BlogImage> getByDraftId(Long draftId);
    void updateOrder(Long imageId, int displayOrder);
    void delete(Long imageId);
    void linkToDraft(Long imageId, Long draftId);
}
