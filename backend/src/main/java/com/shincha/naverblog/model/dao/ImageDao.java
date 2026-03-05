package com.shincha.naverblog.model.dao;

import com.shincha.naverblog.model.dto.BlogImage;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface ImageDao {
    int insert(BlogImage image);
    List<BlogImage> findByDraftId(Long draftId);
    BlogImage findById(Long id);
    int updateDraftId(Long imageId, Long draftId);
    int updateOrder(Long imageId, int displayOrder);
    int updateAiDescription(Long imageId, String description);
    int deleteById(Long id);
}
