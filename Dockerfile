# ============================
# Stage 1: Build
# ============================
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY backend/pom.xml .
COPY backend/src ./src
RUN mvn clean package -DskipTests

# ============================
# Stage 2: Runtime
# ============================
FROM eclipse-temurin:17-jre-jammy

RUN apt-get update && apt-get install -y fonts-nanum --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mkdir -p /app/uploads

COPY --from=build /app/target/naver-blog-backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
