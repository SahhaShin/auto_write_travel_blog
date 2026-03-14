# 개발 히스토리

프로젝트의 기능 추가 및 변경 이력을 날짜별로 정리합니다.

---

## 2026-03-05 ~ 2026-03-06 | 초기 커밋 & 로컬 실행

### 프로젝트 구조

```
auto-blog/
├── backend/          # Spring Boot 3.2 (Java 17) + MyBatis + MySQL
└── frontend/         # React + Vite
```

### Backend 초기 구성

| 파일 | 내용 |
|------|------|
| `application.properties` | 공통 설정 (환경변수 기반) |
| `application-local.properties` | 로컬 전용 설정 (gitignore 처리) |
| `schema.sql` | MySQL 테이블 자동 생성 |
| `NaverAutoPostServiceImpl.java` | Selenium 기반 네이버 자동 발행 |
| `ClaudeServiceImpl.java` | Claude API 연동 AI 글 생성 |
| `EncryptionUtil.java` | AES-256 암호화 유틸 |

### Frontend 초기 구성

- React + Vite + Axios
- 스타일 참고 URL 입력 → AI 글 생성 → 편집 → 발행 플로우

---

## 2026-03-06 | Gemini API Fallback 구현

### 배경

Claude API 크레딧 소진으로 AI 글 생성 불가 → Gemini free tier로 대체

### Backend 변경

**`ClaudeServiceImpl.java`**
- `callClaude()` 분리: Claude API 호출, 크레딧 오류 시 `CreditExhaustedException` throw
- `callGemini()` 추가: Gemini v1beta API (`gemini-2.5-flash`) 호출
- Fallback 로직: Claude 실패 → Gemini 자동 전환
- `saveGenerated()` 추가: 생성 결과 DB 저장 공통 처리

**`application.properties`**
```properties
gemini.api.key=${GEMINI_API_KEY:}
gemini.api.model=gemini-2.5-flash
```

### 확인된 동작

- Claude 크레딧 오류 감지 → 자동으로 Gemini 2.5-flash 호출
- 도쿄 여행 블로그 글 정상 생성 확인

---

## 2026-03-06 | 네이버 자격증명 AES-256 암호화 저장

*(현재 삭제된 기능 - Selenium 자동 발행 폐기로 함께 제거됨)*

네이버 아이디/비밀번호를 AES-256으로 암호화하여 DB에 보관하고, Selenium으로 자동 발행하는 기능을 구현하였으나 이후 크롬 익스텐션 방식으로 대체되어 전체 제거.

---

## 2026-03-06 | Selenium 자동 발행 구현 및 디버깅

*(현재 삭제된 기능)*

Selenium + Chrome으로 네이버 블로그 자동 로그인 및 발행을 시도하였으나, SmartEditor ONE의 DOM 구조와 네이버 봇 감지로 인한 반복적인 실패. 결국 크롬 익스텐션 방식으로 대체 결정.

주요 시도 내역:
- 캡차/2FA 대기 처리
- 쿠키 세션 재사용
- 발행 버튼 JS 클릭 (여러 차례 수정)

---

## 2026-03-10 | 첫 배포 (Vercel + Render + TiDB Cloud)

### 배포 구성

| 서비스 | 플랫폼 | URL |
|--------|--------|-----|
| Frontend | Vercel | https://frontend-blush-seven-53.vercel.app |
| Backend | Render (Docker, Free) | https://naver-blog-backend.onrender.com |
| Database | TiDB Cloud Serverless (Free) | gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000 |

### 해결한 문제들

**1. Java 버전 불일치 빌드 실패**
- 로컬 기본 Java가 11인데 프로젝트는 17 필요
- 해결: `JAVA_HOME=~/Library/Java/JavaVirtualMachines/corretto-17.0.7/Contents/Home` 지정

**2. Vercel 환경변수 누락 → Network Error**
- `VITE_API_BASE_URL` 미설정으로 프론트가 `localhost:8080`으로 요청
- 해결: `vercel env add VITE_API_BASE_URL production` 후 재배포

**3. Render Dockerfile 경로 오류**
- `dockerfilePath: ./Dockerfile`이 repo 루트 기준으로 해석됨
- 해결: repo 루트에 Dockerfile 생성 (`backend/` COPY 경로 기준으로 수정)

**4. Render 환경변수 미설정 → DB 연결 실패**
- TiDB Cloud Serverless 신규 생성, 테이블 수동 생성 후 환경변수 등록

---

## 2026-03-11 | 아키텍처 대개편 — Selenium 제거 + 크롬 익스텐션 + 다중 사용자 인증

### 배경

- Selenium 자동 발행이 SmartEditor ONE / 네이버 봇 감지로 안정적으로 동작하지 않음
- 배포 서버(Render)에 Chrome 설치 불필요 → Docker 이미지 대폭 경량화
- 서비스가 공개 배포됨에 따라 다중 사용자 지원 및 데이터 격리 필요

---

### 1. Selenium / Chrome 완전 제거

**`backend/pom.xml`**
- 제거: `selenium-java`, `webdrivermanager`, `jasypt-spring-boot-starter`
- 추가: `spring-boot-starter-security`, `jjwt-api/impl/jackson` (0.12.5)

**`Dockerfile` (repo root)**
- 이전: Ubuntu 기반 + Chrome/Chromedriver 설치 (~1GB 이상)
- 이후: `eclipse-temurin:17-jre-alpine` 기반 단순 JAR 실행 (~200MB)

**삭제된 파일/클래스:**
- `NaverAutoPostServiceImpl.java`
- `NaverCredentials.java`, `EncryptionUtil.java`
- 네이버 자격증명 관련 DB 테이블 및 API

---

### 2. 크롬 익스텐션 본문 삽입

**`chrome-extension/popup.js`**
- 초안 목록 API 호출 → 선택한 초안 본문을 네이버 SmartEditor ONE에 삽입
- 삽입 방식: `DataTransfer` + `ClipboardEvent` paste 시뮬레이션 (MAIN world)
- 에디터 감지: `[contenteditable="true"]` 전체 수집 → aria-hidden / 오프스크린 필터 → 높이 기준 정렬 → 가장 큰 영역 = 본문 에디터
- 제목 삽입 불가 (SmartEditor ONE 내부 커서 위치 의존) → 제목을 `<h2>` 태그로 본문 상단에 포함하는 방식으로 타협
- `[IMAGE_N]` 플레이스홀더를 실제 `<img>` 태그로 치환하여 삽입

**`chrome-extension/popup.html`**
- 제목 직접 입력 안내 문구 추가

---

### 3. 설정 페이지 제거

**Frontend**
- `SettingsPage.jsx` 삭제
- `App.jsx`에서 `/settings` 라우트 및 네비게이션 링크 제거

**Backend**
- `application.properties`에서 네이버 자격증명 관련 설정 제거

---

### 4. 다중 사용자 인증 (JWT + BCrypt)

#### 신규 파일

| 파일 | 내용 |
|------|------|
| `User.java` | id, username, passwordHash, createdAt |
| `UserDao.java` | findByUsername, insert |
| `UserMapper.xml` | users 테이블 CRUD |
| `AuthController.java` | POST /api/auth/register, /api/auth/login |
| `JwtUtil.java` | generate(userId, username), extractUserId, isValid |
| `JwtFilter.java` | Bearer 토큰 파싱 → principal = userId(Long) |
| `SecurityConfig.java` | Spring Security 설정 + BCryptPasswordEncoder @Bean |
| `RegisterPage.jsx` | 회원가입 UI |
| `LoginPage.jsx` | 로그인 UI (회원가입 링크 포함) |

#### 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `BlogDraft.java` | `userId` 필드 추가 |
| `BlogStyleSample.java` | `userId` 필드 추가 |
| `DraftDao.java` | `findAll()` → `findAllByUserId(userId)` |
| `StyleDao.java` | `findAll()` → `findAllByUserId(userId)` |
| `DraftMapper.xml` | user_id 포함 INSERT/SELECT |
| `StyleMapper.xml` | user_id 포함 INSERT/SELECT |
| `DraftController.java` | SecurityContext에서 userId 추출 → 서비스 전달 |
| `StyleController.java` | SecurityContext에서 userId 추출 → 서비스 전달 |
| `GenerateController.java` | SecurityContext에서 userId 추출 → 서비스 전달 |
| `ClaudeServiceImpl.java` | 스타일 기본 조회 시 `findAllByUserId(userId)` |
| `App.jsx` | RequireAuth 래퍼 + Layout + /login + /register 라우트 |
| `axiosClient.js` | 요청 인터셉터(JWT 첨부) + 응답 인터셉터(401→/login 리디렉션) |

#### DB 마이그레이션

```sql
CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE blog_drafts ADD COLUMN user_id BIGINT;
ALTER TABLE blog_style_samples ADD COLUMN user_id BIGINT;
```

---

### 5. HistoryPage 삭제 버튼 추가

**`HistoryPage.jsx`**
- 초안 목록 각 항목에 삭제 버튼 추가
- `DELETE /api/drafts/{id}` 호출 후 목록 갱신

---

### 6. .md 파일 전면 업데이트

- `README.md`: 다중 사용자, 인증 API, 구조 업데이트
- `DEPLOY.md`: JWT_SECRET 환경변수, TiDB 마이그레이션 SQL 추가
- `CLAUDE.md`: 인증 구조, 파일 목록, 환경변수 전면 업데이트
- `history.md`: 이번 변경 이력 추가
- `errorlog.md`: 현재 상태 업데이트

---

## 2026-03-14 | CORS 버그 수정 + 여행 플래너 기능 추가 + 블로그 연동

### 1. CORS 403 버그 수정

**원인**: Spring Boot 3.x에서 `WebMvcConfigurer`의 CORS 설정이 Spring Security 필터 체인에 자동 적용되지 않음.
`/api/auth/register` 등 `permitAll()` 엔드포인트도 CORS preflight에서 403 반환.

**수정 파일**: `SecurityConfig.java`
```java
http.cors(Customizer.withDefaults())  // 이 한 줄 추가
    .csrf(AbstractHttpConfigurer::disable)
    ...
```

---

### 2. 여행 플래너 기능 추가

#### 신규 백엔드 파일

| 파일 | 내용 |
|------|------|
| `TravelTrip.java` | 여행 기본 정보 DTO |
| `TravelItinerary.java` | 날짜별 일정 DTO |
| `TravelChecklist.java` | 사전준비/서류/짐 체크리스트 DTO |
| `TravelExpense.java` | 경비 내역 DTO (현지통화 + 원화 + 1인기준) |
| `TravelDao.java` | 여행 플래너 통합 MyBatis DAO |
| `TravelMapper.xml` | 여행 플래너 통합 SQL 매퍼 |
| `TravelServiceImpl.java` | AI 여행 계획 생성 (Gemini 2.5-flash) + CRUD |
| `TravelController.java` | `/api/travel/**` 전체 REST API |

#### 신규 프론트엔드 파일

| 파일 | 내용 |
|------|------|
| `travelApi.js` | 여행 플래너 API 모듈 |
| `TravelListPage.jsx` | 여행 목록 (카드 + D-day 표시) |
| `TravelCreatePage.jsx` | 새 여행 생성 (AI 자동 / 기존 계획 완성) |
| `TravelDetailPage.jsx` | 여행 상세 6탭 (사전준비 보드 / 일정 / 서류 / 짐 / 경비 / 각종정보) |

#### 여행 플래너 주요 기능

- **AI 자동 생성**: 여행지/기간/인원/스타일/예산 입력 → Gemini가 일정+체크리스트+짐목록+현지정보 JSON 생성
- **기존 계획 완성**: 부분 계획 텍스트 입력 → AI가 빈 부분 채워줌
- **AI 빈 시간 채우기**: 일정 탭에서 기존 일정 분석 → 빈 시간대 추천
- **경비 관리**: 현지 통화 + 원화 환산 + 1인 기준 자동 계산 (환율 기반)
- **사전 준비 보드**: Not Started / In Progress / Done 3컬럼 보드, 클릭으로 상태 이동
- **체크리스트**: 서류 준비 / 짐 싸기 프로그레스 바 포함

#### DB 마이그레이션

```sql
CREATE TABLE travel_trips (...);
CREATE TABLE travel_itinerary (...);
CREATE TABLE travel_checklist (...);
CREATE TABLE travel_expenses (...);
```

---

### 3. 여행 플래너 ↔ 블로그 글쓰기 연동

**핵심**: 여행 플래너에서 확정된 계획을 AI 블로그 생성 시 자동으로 프롬프트에 반영.

#### 변경된 파일

| 파일 | 변경 |
|------|------|
| `BlogDraft.java` | `tripId` 필드 추가 |
| `DraftMapper.xml` | `trip_id` 컬럼 INSERT/SELECT 반영 |
| `ClaudeServiceImpl.java` | `TravelDao` 주입, `buildTripDataSection()` 추가 |
| `CreatePostPage.jsx` | "여행 계획 연결" 드롭다운 UI 추가 |

#### DB 마이그레이션

```sql
ALTER TABLE blog_drafts ADD COLUMN trip_id BIGINT;
```

#### AI 프롬프트에 추가되는 내용 (여행 연결 시)

```
=== 상세 여행 계획 데이터 ===
기간: 2024-09-17 ~ 2024-09-24 (7박 8일) / 인원: 2명
여행 스타일: 맛집 탐방, 감성 카페

[날짜별 일정]
1일차 (2024-09-17):
  22:10~24:00 | 항공 | 인천 → 시드니 이동 (입국심사서 작성)
...

[경비 요약]
총 AUD 1,595.07 (약 ₩1,435,563)
1인 기준: AUD 797.54 (약 ₩717,786)

[주요 지출 내역]
  - 시드니 락사 [식사] AUD 42.60: 드럼스틱 치킨 락사 1개...
  - The baxter inn [식사] AUD 30.52: 애플 위스키...

[현지 여행 정보]
▶ 입국 정보 / ▶ 환율 정보 / ...
```

---

### 4. md 파일 전면 업데이트

- `README.md`: 여행 플래너 기능, 연동 흐름, 전체 API, 새 파일 구조 반영
- `DEPLOY.md`: 전체 DB 스키마 (여행 플래너 4개 테이블 포함), 마이그레이션 SQL, CORS 주의사항 추가
- `CLAUDE.md`: 프로젝트 구조, 주의사항 업데이트
- `history.md`: 이번 변경 이력 추가

---

---

## 2026-03-14 | PR #4 — Leaflet 지도 마커 + Google Sign-In

### 1. 여행 일정 지도 마커 (Leaflet + Nominatim)

**신규 파일**
- `frontend/src/components/TravelMap.jsx`: Leaflet 지도 컴포넌트
  - Nominatim(OpenStreetMap) 지오코딩으로 여행지 중심 좌표 및 최대 15개 장소 마커 추가
  - 카테고리별 색상 원형 마커 (식사·활동·쇼핑·숙소·기타), 마커 안에 일차 숫자 표시
  - 마커 클릭 시 팝업 (장소명, 일차, 시작~종료 시간)
  - 1.1초 요청 딜레이 (Nominatim 무료 rate limit 준수)
  - `FitBounds` 컴포넌트로 마커 전체가 보이도록 자동 줌
  - 하단 카테고리 범례 및 총 장소 수 표시
  - 교통·항공 카테고리 제외, 중복 장소명 필터링

**변경된 파일**
- `TravelDetailPage.jsx`: Google Maps iframe 제거 → `<TravelMap>` 컴포넌트로 교체

### 2. Google Sign-In 연동

**Backend**
- `User.java`: `googleId` 필드 추가
- `UserDao.java`: `findByGoogleId()`, `updateGoogleId()` 메서드 추가
- `UserMapper.xml`: google_id 컬럼 resultMap, SELECT, UPDATE, INSERT 반영
- `AuthController.java`: `POST /api/auth/google` 엔드포인트 추가
  - Google tokeninfo API로 idToken 검증
  - 기존 Google 연동 계정 조회 → 없으면 이메일로 기존 계정 조회 후 연동 → 없으면 신규 가입
  - JWT 반환
- `application.properties`: `GOOGLE_CLIENT_ID` 환경변수 추가

**Frontend**
- `LoginPage.jsx`, `RegisterPage.jsx`: Google Sign-In 버튼 추가 (`@react-oauth/google`)
- `App.jsx`: `GoogleOAuthProvider`로 전체 앱 래핑

**DB 마이그레이션**
```sql
ALTER TABLE users ADD COLUMN google_id VARCHAR(100);
```

---

---

## 2026-03-14 | PR #5 — 지도 마커 표시 버그 수정 + 일정명 클릭 지도 이동

### 수정 내용

**마커 안 보이는 버그 수정 (2가지)**
- 목적지 geocoding 실패 시 `center`가 null로 남아 지도 자체가 렌더링 안 되던 문제 → 첫 번째 마커 geocoding 성공 시 해당 좌표를 fallback center로 사용
- `leaflet-div-icon` 기본 흰 배경·테두리가 색상 마커 위에 겹치던 문제 → CSS `transparent` 주입으로 해결

**일정명 클릭 → 지도 마커 이동 신규 기능**
- 일정 테이블의 활동명을 파란 클릭 가능 텍스트로 변경
- 클릭 시 `MapController`가 `map.flyTo()` 호출 → 해당 마커로 부드럽게 이동 + 팝업 자동 오픈
- `markerRefs` ref map으로 Leaflet 마커 인스턴스를 activity명으로 관리

---

## 현재 상태 (2026-03-14 기준)

| 기능 | 상태 |
|------|------|
| 회원가입 / 로그인 (JWT) | 완료 |
| Google Sign-In 연동 | 완료 (환경변수 설정 필요) |
| 사용자별 데이터 격리 | 완료 |
| 스타일 참고 URL 분석 | 완료 |
| AI 글 생성 (Claude → Gemini fallback) | 완료 |
| 글 편집 (제목/내용/이미지) | 완료 |
| 크롬 익스텐션 본문 삽입 | 완료 (제목은 사용자 직접 입력) |
| 초안 삭제 | 완료 |
| Selenium 자동 발행 | 제거 (크롬 익스텐션으로 대체) |
| CORS 403 버그 수정 | 완료 |
| 여행 플래너 (AI 계획 생성 + 6탭 관리) | 완료 |
| AI 자연어 일정 파싱 | 완료 |
| Leaflet 지도 마커 (전체 일정 장소) | 완료 |
| 여행 플래너 ↔ 블로그 글쓰기 연동 | 완료 |
| 프로덕션 배포 (Vercel + Render + TiDB) | 완료 |

---
