package com.shincha.naverblog.model.dao;

import com.shincha.naverblog.model.dto.NaverCredentials;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface NaverCredentialsDao {
    NaverCredentials find();
    int upsert(NaverCredentials credentials);
}
