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

**`application-local.properties`**
```properties
gemini.api.key=AIzaSyAGC...  # AI Studio 발급 무료 키
```

### 확인된 동작

- Claude 크레딧 오류 감지 → 자동으로 Gemini 2.5-flash 호출
- 도쿄 여행 블로그 글 정상 생성 확인

---

## 2026-03-06 | 네이버 자격증명 AES-256 암호화 저장

### 배경

네이버 아이디/비밀번호를 평문 저장하지 않고 AES-256으로 암호화하여 DB에 보관

### Backend 변경

**`EncryptionUtil.java`**
- `getPaddedKey()`: 키를 항상 32바이트로 패딩 (AES-256)
- `encrypt()` / `decrypt()`: AES/CBC/PKCS5Padding 방식

**`NaverCredentials.java`**
```java
private String encryptedId;       // AES 암호화된 네이버 ID
private String encryptedPassword; // AES 암호화된 네이버 PW
private String blogId;
private String sessionCookies;    // AES 암호화된 세션 쿠키 JSON
```

**`NaverCredentialsMapper.xml`**
- `session_cookies MEDIUMTEXT` 컬럼 추가
- `updateCookies` 쿼리 추가

**DB 변경**
```sql
ALTER TABLE naver_credentials ADD COLUMN session_cookies MEDIUMTEXT;
```

---

## 2026-03-06 | Selenium 자동 발행 - 2FA 대기 & 쿠키 세션

### 배경

네이버 로그인 시 캡차/2FA 처리 및 이후 재사용을 위한 쿠키 세션 저장

### Backend 변경

**`NaverAutoPostServiceImpl.java`**

| 메서드 | 설명 |
|--------|------|
| `tryLoginWithCookies()` | DB에 저장된 암호화 쿠키로 로그인 시도 |
| `saveCookies()` | 로그인 성공 후 쿠키 암호화 → DB 저장 |
| `waitForLoginComplete()` | 최대 3분 대기 (캡차/2FA 사용자 직접 처리) |
| `is2FAPage()` | 2FA 페이지 여부 감지 |
| `waitForOtp()` | OTP 입력 대기 (최대 5분) |
| `submitOtp()` | 외부에서 OTP 전달 |

**`PostController.java`**
```java
// 2FA OTP 제출 엔드포인트
POST /api/post/otp/{draftId}
body: { "otp": "123456" }
```

**ChromeOptions 변경**
- `--headless=new` 제거 → 실제 브라우저 창 실행 (봇 감지 우회)
- `navigator.webdriver` 감지 우회 JS 주입

### 로그인 플로우

```
저장된 쿠키 시도
    ↓ 실패
일반 로그인 (아이디/비밀번호 입력)
    ↓
캡차 감지 → status: WAITING_CAPTCHA (사용자 직접 해결)
    ↓
2FA 감지 → status: WAITING_2FA → /api/post/otp/{id}로 OTP 제출
    ↓
로그인 완료 → 쿠키 암호화 저장 (다음 실행 시 재사용)
```

---

## 2026-03-06 | Selenium 발행 버튼 수정 (1차 ~ 3차)

### 배경

네이버 SmartEditor ONE 발행 버튼 클릭이 계속 실패하여 반복 수정

### 변경 히스토리

**1차 - "예약 발행 글" 모달 문제**
- 문제: `//button[contains(text(),'발행')]` XPath가 "예약발행 현황" 버튼을 먼저 매칭
- 해결: `"예약"` 포함 버튼 제외, JS로 `innerText.trim() === '발행'` 정확 매칭

**2차 - 도움말 패널이 버튼을 가림**
- 문제: 에디터 우측 "도움말" 패널이 자동으로 열려 발행 버튼 클릭 방해 가능성
- 해결:
  - 발행 버튼 찾기 전 X 버튼(닫기) 클릭 시도
  - ESC 키로 모달/패널 닫기
  - `defaultContent()`로 iframe 밖으로 전환 후 탐색

**3차 - 발행 설정 패널 내 확인 버튼 오인**
- 문제: 패널 내 확인 버튼을 "발행하기"로 예상했으나 실제 텍스트는 "발행"
- 해결: 버튼 목록 로깅으로 실제 텍스트 확인 후 수정
  ```
  실제 버튼 순서: "예약 발행 0건", "저장", "발행"(툴바), ..., "발행 설정 닫기", "발행"(확인)
  ```
  ```javascript
  var closeIdx = btns.findIndex(b => b.innerText.includes('발행 설정 닫기'));
  // closeIdx 이후의 "발행" 버튼이 실제 확인 버튼
  ```

### 현재 발행 플로우

```
defaultContent() 전환
    ↓
도움말 패널 닫기 (X 버튼 / ESC)
    ↓
JS로 "예약" 제외 + innerText === "발행" 버튼 찾기
    ↓
클릭 → 발행 설정 패널 오픈
    ↓
"발행 설정 닫기" 이후의 "발행" 버튼 찾아서 클릭
    ↓
URL이 postwrite에서 변경될 때까지 최대 15초 대기
    ↓
최종 URL → DB 저장 (post_history, blog_drafts.naver_post_url)
```

---

---

## 2026-03-10 | 첫 배포 (Vercel + Render + TiDB Cloud)

### 배경

로컬 개발 완료 후 프로덕션 배포 진행

### 배포 구성

| 서비스 | 플랫폼 | URL |
|--------|--------|-----|
| Frontend | Vercel | https://frontend-blush-seven-53.vercel.app |
| Backend | Render (Docker, Free) | https://naver-blog-backend.onrender.com |
| Database | TiDB Cloud Serverless (Free) | gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000 |

### 해결한 문제들

**1. 프론트엔드 빌드 - Java 버전 문제**
- 로컬 기본 Java가 11인데 프로젝트는 17 필요
- 해결: `JAVA_HOME=~/Library/Java/JavaVirtualMachines/corretto-17.0.7/Contents/Home` 지정하여 빌드

**2. Vercel 환경변수 누락 → Network Error**
- `VITE_API_BASE_URL` 미설정으로 프론트가 `localhost:8080`으로 요청
- 해결: `vercel env add VITE_API_BASE_URL production` 으로 Render URL 등록 후 재배포

**3. Render Dockerfile 경로 오류**
- `render.yaml`의 `dockerfilePath: ./Dockerfile`이 repo 루트 기준으로 해석됨
- 기존엔 루트에 Dockerfile 없어서 `failed to read dockerfile` 에러
- 해결: repo 루트에 Dockerfile 생성 (COPY 경로를 `backend/` 기준으로 수정), `render.yaml`에서 `rootDir: backend` 제거

**4. Render 환경변수 미설정 → DB 연결 실패 (500 에러)**
- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` 등 환경변수 전부 비어있었음
- TiDB Cloud Serverless Free Cluster 신규 생성 (ap-southeast-1)
- `naver_blog_auto` 데이터베이스 및 테이블 5개 수동 생성 (schema.sql 실행)
- Render Environment 탭에 환경변수 설정 후 재배포 → 정상 동작 확인

### Render 환경변수 목록

| Key | 비고 |
|-----|------|
| `DB_URL` | TiDB Cloud JDBC URL (useSSL=true, port 4000) |
| `DB_USERNAME` | TiDB 사용자명 |
| `DB_PASSWORD` | TiDB 비밀번호 |
| `AES_SECRET_KEY` | 32자 이상 임의 문자열 |
| `CORS_ORIGINS` | Vercel 프론트 URL |
| `UPLOAD_DIR` | `/app/uploads` (render.yaml에 고정) |

### 주의사항

- Render 무료 플랜: 15분 비활성 시 슬립 → 첫 요청 50초+ 지연
- `spring.sql.init.mode` 미설정 → schema.sql 자동 실행 안됨, 수동 실행 필요
- `render.yaml` 변경이 기존 서비스 대시보드 설정을 override 하지 않는 경우 있음 → 대시보드에서 직접 확인 필요

---

## 현재 상태 (2026-03-10 기준)

| 기능 | 상태 |
|------|------|
| 스타일 참고 URL 분석 | 완료 |
| AI 글 생성 (Claude → Gemini fallback) | 완료 |
| 글 편집 (제목/내용/이미지) | 완료 |
| 네이버 자격증명 암호화 저장 | 완료 |
| 쿠키 세션 재사용 | 완료 |
| 캡차/2FA 대기 | 완료 |
| Selenium 자동 발행 - 발행 버튼 | 수정 중 |
| 발행 완료 URL 저장 | 발행 성공 후 확인 필요 |
| 프로덕션 배포 (Vercel + Render + TiDB) | 완료 |

---
