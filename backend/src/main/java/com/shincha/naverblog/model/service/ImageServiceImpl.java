package com.shincha.naverblog.model.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.shincha.naverblog.model.dao.ImageDao;
import com.shincha.naverblog.model.dto.BlogImage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImageServiceImpl implements ImageService {

    private final ImageDao imageDao;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    @Value("${cloudinary.cloud-name:}")
    private String cloudinaryCloudName;

    @Value("${cloudinary.api-key:}")
    private String cloudinaryApiKey;

    @Value("${cloudinary.api-secret:}")
    private String cloudinaryApiSecret;

    private boolean isCloudinaryConfigured() {
        return cloudinaryCloudName != null && !cloudinaryCloudName.isEmpty()
                && cloudinaryApiKey != null && !cloudinaryApiKey.isEmpty()
                && cloudinaryApiSecret != null && !cloudinaryApiSecret.isEmpty();
    }

    private Cloudinary getCloudinary() {
        return new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudinaryCloudName,
                "api_key", cloudinaryApiKey,
                "api_secret", cloudinaryApiSecret
        ));
    }

    @Override
    public List<BlogImage> uploadImages(MultipartFile[] files, Long draftId) {
        List<BlogImage> savedImages = new ArrayList<>();

        for (int i = 0; i < files.length; i++) {
            MultipartFile file = files[i];
            if (file.isEmpty()) continue;

            try {
                String originalName = file.getOriginalFilename();
                String publicUrl;
                String storedPath;

                if (isCloudinaryConfigured()) {
                    // Cloudinary 업로드
                    Map uploadResult = getCloudinary().uploader().upload(
                            file.getBytes(),
                            ObjectUtils.asMap("folder", "naver-blog")
                    );
                    publicUrl = (String) uploadResult.get("secure_url");
                    storedPath = (String) uploadResult.get("public_id");
                } else {
                    // 로컬 폴백 (개발용)
                    File uploadPath = new File(uploadDir);
                    if (!uploadPath.exists()) uploadPath.mkdirs();

                    String ext = originalName != null && originalName.contains(".")
                            ? originalName.substring(originalName.lastIndexOf(".")) : ".jpg";
                    String storedName = UUID.randomUUID() + ext;
                    Path localPath = Paths.get(uploadDir, storedName);
                    Files.copy(file.getInputStream(), localPath);

                    storedPath = localPath.toAbsolutePath().toString();
                    publicUrl = "/uploads/" + storedName;
                }

                BlogImage image = new BlogImage();
                image.setDraftId(draftId);
                image.setOriginalName(originalName);
                image.setStoredPath(storedPath);
                image.setPublicUrl(publicUrl);
                image.setFileSize(file.getSize());
                image.setMimeType(file.getContentType() != null ? file.getContentType() : "image/jpeg");
                image.setDisplayOrder(i);

                imageDao.insert(image);
                savedImages.add(imageDao.findById(image.getId()));

            } catch (IOException e) {
                log.error("이미지 저장 실패: {}", file.getOriginalFilename(), e);
                throw new RuntimeException("이미지 저장에 실패했습니다: " + file.getOriginalFilename());
            }
        }

        return savedImages;
    }

    @Override
    public List<BlogImage> getByDraftId(Long draftId) {
        return imageDao.findByDraftId(draftId);
    }

    @Override
    public void updateOrder(Long imageId, int displayOrder) {
        imageDao.updateOrder(imageId, displayOrder);
    }

    @Override
    public void delete(Long imageId) {
        BlogImage image = imageDao.findById(imageId);
        if (image != null) {
            if (!isCloudinaryConfigured()) {
                File file = new File(image.getStoredPath());
                if (file.exists()) file.delete();
            }
            imageDao.deleteById(imageId);
        }
    }

    @Override
    public void linkToDraft(Long imageId, Long draftId) {
        imageDao.updateDraftId(imageId, draftId);
    }
}
