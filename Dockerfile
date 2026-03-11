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

# Google Chrome 설치 (Ubuntu 22.04에서 chromium-browser는 snap으로 redirect되어 Docker에서 동작 안 함)
RUN apt-get update && apt-get install -y wget gnupg fonts-nanum --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# ChromeDriver는 WebDriverManager가 런타임에 자동 다운로드
ENV CHROME_BIN=/usr/bin/google-chrome-stable
ENV CHROMEDRIVER_PATH=

WORKDIR /app

# 업로드 파일 저장 디렉토리
RUN mkdir -p /app/uploads

COPY --from=build /app/target/naver-blog-backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", \
    "-Djava.awt.headless=true", \
    "-jar", "app.jar"]
