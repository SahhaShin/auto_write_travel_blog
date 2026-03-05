package com.shincha.naverblog.model.dao;

import com.shincha.naverblog.model.dto.BlogDraft;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface DraftDao {
    List<BlogDraft> findAll();
    BlogDraft findById(Long id);
    int insert(BlogDraft draft);
    int update(BlogDraft draft);
    int updateStatus(Long id, String status);
    int updateGenerated(Long id, String title, String content, String model, int tokens);
    int updateNaverPostUrl(Long id, String url);
    int deleteById(Long id);
}
