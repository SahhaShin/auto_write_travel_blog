package com.shincha.naverblog.model.dao;

import com.shincha.naverblog.model.dto.PostHistory;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface PostHistoryDao {
    int insert(PostHistory history);
    List<PostHistory> findAll();
    PostHistory findById(Long id);
    PostHistory findByDraftId(Long draftId);
}
