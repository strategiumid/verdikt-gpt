# Copilot Instructions for Verdikt GPT

## Архитектура проекта
- **Фронтенд**: Чистый HTML/CSS/JS, без сборщиков и серверной части. Основные файлы: `index.html`, `main.js`, `styles.css`, `themes.css`, `uiManager.js`, и сервисные JS-модули (`authService.js`, `chatStore.js`, `crypto.js`, `encryptionService.js`, `apiClient.js`).
- **Бэкенд**: Java (Spring Boot), расположен в `backend/verdikt/`. Основные директории: `controller/`, `service/`, `entity/`, `repository/`, `dto/`, `config/`.
- **Данные**: В папке `data/` (структура и формат уточнять по коду).

## Ключевые паттерны и соглашения
- **Фронтенд**:
  - Нет фреймворков, только Vanilla JS.
  - Вся логика UI и взаимодействия с API — в отдельных сервисах (`apiClient.js`, `authService.js`, `chatStore.js`).
  - Для шифрования и безопасности используются модули `crypto.js` и `encryptionService.js`.
  - Стилизация через отдельные CSS-файлы, поддержка темизации (`themes.css`).
- **Бэкенд**:
  - Стандартная структура Spring Boot: контроллеры, сервисы, репозитории, DTO, сущности.
  - JWT-аутентификация (`JwtAuthenticationFilter.java`, `SecurityConfig.java`).
  - REST API: все контроллеры в `controller/`, DTO для передачи данных, сервисы для бизнес-логики.
  - Репозитории используют Spring Data JPA.

## Сборка и запуск
- **Фронтенд**: Открыть `index.html` в браузере. Никаких сборщиков не требуется.
- **Бэкенд**:
  - Перейти в `backend/verdikt/`.
  - Сборка: `mvn package`
  - Запуск: `java -jar target/*.jar` или через IDE.
  - Конфигурация: `application.properties` в `resources/`.

## Интеграция и взаимодействие
- Фронтенд общается с бэкендом через REST API (см. `apiClient.js` и контроллеры в `controller/`).
- Аутентификация — через JWT (см. обмен токенами в `authService.js` и фильтры Spring).
- Все бизнес-правила реализованы на стороне бэкенда (сервисы, DTO, валидация).

## Важные файлы для изучения
- Фронтенд: `main.js`, `apiClient.js`, `authService.js`, `chatStore.js`, `uiManager.js`
- Бэкенд: `controller/`, `service/`, `entity/`, `repository/`, `config/`

## Прочее
- Нет специфических соглашений, кроме стандартных для Vanilla JS и Spring Boot.
- Для новых функций придерживаться существующих паттернов разделения ответственности и структуры.

---

_Обновляйте этот файл при изменении архитектуры или ключевых паттернов._
