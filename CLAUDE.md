# CLAUDE.md — 네이버 블로그 AI 초안 생성 프로젝트

@DEV_RULES.md

## 프로젝트 개요

기존 네이버 블로그 글의 문체를 AI가 학습하여, 이미지와 여행 계획 입력만으로 동일 스타일의 블로그 초안을 자동 생성하는 풀스택 웹앱.
생성된 초안은 크롬 익스텐션으로 네이버 블로그 글쓰기 페이지에 삽입. 제목은 사용자가 직접 입력 후 발행.
다중 사용자 지원: 회원가입/로그인 후 각자의 데이터만 접근 가능.
여행 플래너: AI(Gemini 2.5-flash)로 여행 계획 자동 생성 및 관리. 확정된 계획을 블로그 글쓰기에 자동 연동.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + Vite 7 |
| Backend | Spring Boot 3.2 (Java 17) + Spring Security + MyBatis |
| Database | TiDB Cloud Serverless (MySQL 8 호환) |
| AI | Claude API (`claude-sonnet-4-6`) + Gemini 2.5-flash (fallback) |
| 인증 | JWT (JJWT 0.12.5) + BCrypt |
| 이미지 저장 | Cloudinary (Render ephemeral fs 대체) |
| 에디터 | TipTap (ProseMirror 기반) |
| 크롬 익스텐션 | Manifest V3, MAIN world scripting |
| 배포 | Frontend → Vercel / Backend → Render (Docker) |

---

## 프로젝트 구조

```
auto-blog/
├── Dockerfile                  # 루트 Dockerfile (Render 배포용, build context = repo root)
├── render.yaml
├── chrome-extension/
│   ├── manifest.json
│   ├── popup.html / popup.js   # 초안 선택 + 본문 삽입 (MAIN world)
│   └── content.js
├── backend/
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/shincha/naverblog/
│       │   ├── config/
│       │   │   ├── SecurityConfig.java   # Spring Security + cors(Customizer.withDefaults()) + BCrypt
│       │   │   └── WebConfig.java        # CORS allowedOriginPatterns
│       │   ├── security/
│       │   │   └── JwtFilter.java
│       │   ├── util/
│       │   │   └── JwtUtil.java
│       │   ├── controller/
│       │   │   ├── AuthController.java
│       │   │   ├── DraftController.java
│       │   │   ├── StyleController.java
│       │   │   ├── GenerateController.java
│       │   │   ├── ImageController.java
│       │   │   ├── PostController.java
│       │   │   └── TravelController.java  # /api/travel/** 여행 플래너 전체
│       │   └── model/
│       │       ├── dto/
│       │       │   ├── User, BlogDraft(+tripId), BlogStyleSample, BlogImage, PostHistory
│       │       │   └── TravelTrip, TravelItinerary, TravelChecklist, TravelExpense
│       │       ├── dao/
│       │       │   ├── UserDao, DraftDao, StyleDao, ImageDao, PostHistoryDao
│       │       │   └── TravelDao          # 여행 플래너 통합 DAO
│       │       └── service/
│       │           ├── ClaudeServiceImpl  # TravelDao 주입, buildTripDataSection()
│       │           ├── StyleServiceImpl, DraftServiceImpl, ImageServiceImpl
│       │           └── TravelServiceImpl  # Gemini AI 계획 생성 + CRUD
│       └── resources/
│           ├── application.properties
│           ├── application-local.properties  # gitignore
│           └── mappers/
│               ├── UserMapper, DraftMapper, StyleMapper, ImageMapper, PostHistoryMapper
│               └── TravelMapper.xml       # 여행 플래너 통합 매퍼
└── frontend/
    ├── src/
    │   ├── api/
    │   │   ├── axiosClient.js
    │   │   ├── styleApi, draftApi, imageApi, generateApi, postApi
    │   │   └── travelApi.js               # 여행 플래너 API
    │   └── pages/
    │       ├── LoginPage.jsx, RegisterPage.jsx
    │       ├── CreatePostPage.jsx          # 여행 계획 연결 드롭다운 포함
    │       ├── EditorPage.jsx
    │       ├── StyleReferencePage.jsx
    │       ├── HistoryPage.jsx
    │       ├── TravelListPage.jsx          # 여행 목록
    │       ├── TravelCreatePage.jsx        # 새 여행 생성 (AI / 계획 완성)
    │       └── TravelDetailPage.jsx        # 6탭 상세 관리
    ├── vercel.json
    └── package.json
```

---

## 인증 구조

- `/api/auth/register`, `/api/auth/login` → 공개 (JWT 불필요)
- 그 외 모든 `/api/**` → `Authorization: Bearer <token>` 필수
- JWT payload: `subject = userId(Long)`, claim `username`
- JwtFilter: `SecurityContextHolder`의 `principal = userId(Long)`
- 각 컨트롤러에서 userId 추출:
  ```java
  Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
  ```
- 데이터 격리: `blog_drafts.user_id`, `blog_style_samples.user_id` 컬럼으로 필터링

---

## 로컬 개발 실행

### 백엔드

```bash
cd /Users/shinsanha/Desktop/auto-blog/backend

JAVA_HOME=~/Library/Java/JavaVirtualMachines/corretto-17.0.7/Contents/Home \
/opt/homebrew/opt/maven/bin/mvn spring-boot:run \
  -Dspring-boot.run.profiles=local
```

> 로컬 Java 기본값이 11이라 반드시 JAVA_HOME 지정 필요

### 프론트엔드

```bash
cd /Users/shinsanha/Desktop/auto-blog/frontend
npm run dev
```

### 백엔드 빌드 (JAR)

```bash
cd /Users/shinsanha/Desktop/auto-blog/backend
JAVA_HOME=~/Library/Java/JavaVirtualMachines/corretto-17.0.7/Contents/Home \
mvn clean package -DskipTests
```

---

## 배포

### Frontend → Vercel

```bash
cd /Users/shinsanha/Desktop/auto-blog/frontend
vercel --prod --yes
```

**Vercel 환경변수:**
- `VITE_API_BASE_URL` = `https://naver-blog-backend.onrender.com`

### Backend → Render

- git push → Render 자동 배포 (Auto-Deploy)
- Dockerfile 위치: repo 루트 `/Dockerfile` (build context = repo root)

**Render 환경변수:**

| Key | 비고 |
|-----|------|
| `DB_URL` | TiDB Cloud JDBC URL |
| `DB_USERNAME` | TiDB 사용자명 |
| `DB_PASSWORD` | TiDB 비밀번호 |
| `CLAUDE_API_KEY` | Anthropic API 키 |
| `GEMINI_API_KEY` | Google AI Studio 키 (무료, fallback용) |
| `JWT_SECRET` | 32자 이상 임의 문자열 (필수) |
| `CORS_ORIGINS` | `https://frontend-blush-seven-53.vercel.app` |
| `UPLOAD_DIR` | `/app/uploads` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary 클라우드명 |
| `CLOUDINARY_API_KEY` | Cloudinary API 키 |
| `CLOUDINARY_API_SECRET` | Cloudinary API 시크릿 |

### Database → TiDB Cloud

- 클러스터: ap-southeast-1 (Singapore), Serverless Free
- DB명: `naver_blog_auto`
- 테이블: `users`, `blog_style_samples`, `blog_drafts`, `blog_images`, `post_history`
- 스키마 변경 시 TiDB 콘솔 SQL Editor에서 수동 실행 필요
- 상세 SQL은 DEPLOY.md 참고

---

## 운영 URL

| 서비스 | URL |
|--------|-----|
| Frontend | https://frontend-blush-seven-53.vercel.app |
| Backend | https://naver-blog-backend.onrender.com |
| GitHub | https://github.com/SahhaShin/auto_write_travel_blog |

---

## 주요 주의사항

- **Java**: 로컬 기본 Java가 11이므로 빌드/실행 시 `JAVA_HOME` 명시 필수
- **Render 슬립**: 무료 플랜 15분 비활성 → 첫 요청 50초+ 지연
- **schema.sql 자동 실행 안됨**: DB 스키마 변경 시 TiDB 콘솔에서 직접 실행
- **JWT_SECRET**: 운영 환경에서 반드시 강력한 키 설정. 기본값은 dev 전용
- **Cloudinary**: 이미지 영구 저장. 미설정 시 로컬 uploads에 저장 (Render 재배포 시 삭제됨)
- **크롬 익스텐션**: 제목은 SmartEditor ONE API 접근 불가로 사용자가 직접 입력. 본문만 자동 삽입
- **데이터 격리**: 모든 조회/생성 API는 JWT의 userId 기반으로 자신의 데이터만 접근 가능
- **CORS**: SecurityConfig에 반드시 `.cors(Customizer.withDefaults())` 추가. 없으면 `/api/auth/**` 포함 모든 CORS 요청 403 오류
- **여행 플래너 AI**: Gemini 2.5-flash 사용 (무료). `GEMINI_API_KEY` 환경변수 필수
- **여행 계획 연동**: `blog_drafts.trip_id` → `TravelDao`로 일정/경비/정보 조회 → 프롬프트 자동 삽입
