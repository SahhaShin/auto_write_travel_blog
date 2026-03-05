package com.shincha.naverblog.model.dao;

import com.shincha.naverblog.model.dto.BlogStyleSample;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface StyleDao {
    List<BlogStyleSample> findAll();
    BlogStyleSample findById(Long id);
    int insert(BlogStyleSample sample);
    int softDelete(Long id);
    List<BlogStyleSample> findActiveByCategory(String category);
}
