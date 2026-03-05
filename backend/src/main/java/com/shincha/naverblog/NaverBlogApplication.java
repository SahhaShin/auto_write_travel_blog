package com.shincha.naverblog;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@MapperScan("com.shincha.naverblog.model.dao")
@EnableAsync
public class NaverBlogApplication {

    public static void main(String[] args) {
        SpringApplication.run(NaverBlogApplication.class, args);
    }
}
