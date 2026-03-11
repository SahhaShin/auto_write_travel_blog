package com.shincha.naverblog.model.dao;
import com.shincha.naverblog.model.dto.BlogDraft;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface DraftDao {
    List<BlogDraft> findAllByUserId(@Param("userId") Long userId);
    BlogDraft findById(Long id);
    int insert(BlogDraft draft);
    int update(BlogDraft draft);
    int updateStatus(@Param("id") Long id, @Param("status") String status);
    int updateGenerated(@Param("id") Long id, @Param("title") String title, @Param("content") String content, @Param("model") String model, @Param("tokens") int tokens);
    int updateNaverPostUrl(@Param("id") Long id, @Param("url") String url);
    int deleteById(Long id);
}
