# ========== Сборка ==========
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app

# Копируем бэкенд
COPY backend/verdikt/pom.xml ./backend/
COPY backend/verdikt/src ./backend/src

# Фронт в static — Spring Boot отдаст с /
RUN mkdir -p ./backend/src/main/resources/static
COPY index.html app.js main.js apiClient.js chatStore.js uiManager.js encryptionService.js authService.js styles.css themes.css crypto.js service-worker.js manifest.json instructions.txt ./backend/src/main/resources/static/

# В проде фронт с того же хоста — не задаём VERDIKT_BACKEND_URL (будет location.origin)
RUN sed -i "s|window.VERDIKT_BACKEND_URL = 'http://localhost:8080';|window.VERDIKT_BACKEND_URL = '';|g" ./backend/src/main/resources/static/index.html

# Сборка JAR (без тестов)
RUN cd backend && apk add --no-cache maven && mvn -B package -DskipTests

# ========== Запуск ==========
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# H2 в /data — сюда Amvera примонтирует постоянное хранилище (см. amvera.yaml)
ENV SPRING_DATASOURCE_URL=jdbc:h2:file:/data/verdikt;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE

COPY --from=build /app/backend/target/verdikt-backend-*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
