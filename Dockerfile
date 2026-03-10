# ============================
# Stage 1: Build
# ============================
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY backend/pom.xml .
COPY backend/src ./src
RUN mvn clean package -DskipTests

# ============================
# Stage 2: Runtime (Chrome 포함)
# ============================
FROM eclipse-temurin:17-jdk-jammy

# Chrome 및 ChromeDriver 설치 (Selenium 자동 포스팅용)
RUN apt-get update && apt-get install -y \
    chromium-browser \
    chromium-chromedriver \
    fonts-nanum \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# ChromeDriver 경로 설정
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver

WORKDIR /app

# 업로드 파일 저장 디렉토리
RUN mkdir -p /app/uploads

COPY --from=build /app/target/naver-blog-backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", \
    "-Djava.awt.headless=true", \
    "-jar", "app.jar"]
