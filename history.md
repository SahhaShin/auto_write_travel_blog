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

## 현재 상태 (2026-03-11 기준)

| 기능 | 상태 |
|------|------|
| 회원가입 / 로그인 (JWT) | 완료 |
| 사용자별 데이터 격리 | 완료 |
| 스타일 참고 URL 분석 | 완료 |
| AI 글 생성 (Claude → Gemini fallback) | 완료 |
| 글 편집 (제목/내용/이미지) | 완료 |
| 크롬 익스텐션 본문 삽입 | 완료 (제목은 사용자 직접 입력) |
| 초안 삭제 | 완료 |
| Selenium 자동 발행 | 제거 (크롬 익스텐션으로 대체) |
| 프로덕션 배포 (Vercel + Render + TiDB) | 완료 |

---
