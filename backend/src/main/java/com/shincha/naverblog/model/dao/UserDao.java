package com.shincha.naverblog.model.dao;
import com.shincha.naverblog.model.dto.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserDao {
    User findByUsername(String username);
    int insert(User user);
}
