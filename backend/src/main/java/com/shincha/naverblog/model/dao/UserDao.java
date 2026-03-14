package com.shincha.naverblog.model.dao;
import com.shincha.naverblog.model.dto.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserDao {
    User findByUsername(String username);
    User findByGoogleId(String googleId);
    int insert(User user);
    int updateGoogleId(@org.apache.ibatis.annotations.Param("id") Long id,
                       @org.apache.ibatis.annotations.Param("googleId") String googleId);
}
