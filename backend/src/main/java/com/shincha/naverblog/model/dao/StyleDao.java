package com.shincha.naverblog.model.dao;
import com.shincha.naverblog.model.dto.BlogStyleSample;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface StyleDao {
    List<BlogStyleSample> findAllByUserId(@Param("userId") Long userId);
    BlogStyleSample findById(Long id);
    int insert(BlogStyleSample sample);
    int softDelete(Long id);
    List<BlogStyleSample> findActiveByCategory(@Param("category") String category);
}
