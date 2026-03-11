# 네이버 블로그 AI 초안 생성 웹 애플리케이션

기존에 작성한 네이버 여행 블로그 글의 문체를 AI가 학습하여,
이미지와 여행 계획만 입력하면 동일한 스타일의 블로그 초안을 자동 생성하는 풀스택 웹 애플리케이션입니다.
생성된 초안은 크롬 익스텐션으로 네이버 블로그 글쓰기 페이지에 바로 삽입할 수 있습니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + Vite 7 |
| Backend | Spring Boot 3.2 (Java 17) + Spring Security + MyBatis |
| Database | TiDB Cloud Serverless (MySQL 8 호환) |
| AI | Claude API (claude-sonnet-4-6) + Gemini 2.5-flash (fallback) |
| 인증 | JWT (JJWT 0.12.5) + BCrypt |
| 에디터 | TipTap (ProseMirror 기반) |
| 이미지 저장 | Cloudinary |
| 배포 | Frontend → Vercel / Backend → Render (Docker) |
| 크롬 익스텐션 | Manifest V3, MAIN world scripting |
| 버전관리 | Git + GitHub |

---

## 주요 기능

1. **회원가입 / 로그인** - JWT 기반 다중 사용자 인증. 사용자별 데이터 완전 분리
2. **스타일 학습** - 기존 네이버 블로그 URL 또는 텍스트를 등록하면 AI가 문체 분석
3. **AI 글 생성** - 이미지 + 여행 계획 입력 → Claude API가 동일 문체로 한국어 초안 생성
   - Claude 크레딧 소진 시 **Gemini 2.5-flash 자동 fallback**
4. **리치 에디터** - TipTap 에디터에서 자유롭게 수정, 3초 자동 저장
5. **크롬 익스텐션으로 발행** - 네이버 블로그 글쓰기 페이지에서 초안 본문을 자동 삽입, 제목은 직접 입력 후 발행
6. **발행 히스토리** - 초안 목록 관리 및 삭제

---

## 프로젝트 구조

```
auto-blog/
├── chrome-extension/            # 크롬 익스텐션 (Manifest V3)
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js                 # 초안 조회 + 본문 삽입 (MAIN world)
│   └── content.js
│
├── frontend/                    # React + Vite
│   ├── src/
│   │   ├── api/
│   │   │   ├── axiosClient.js   # JWT 인터셉터 (자동 토큰 첨부 + 401 처리)
│   │   │   ├── styleApi.js
│   │   │   ├── draftApi.js
│   │   │   ├── imageApi.js
│   │   │   ├── generateApi.js
│   │   │   └── postApi.js
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx        # 로그인
│   │   │   ├── RegisterPage.jsx     # 회원가입
│   │   │   ├── CreatePostPage.jsx   # 이미지 업로드 + 여행 계획 입력
│   │   │   ├── EditorPage.jsx       # TipTap 에디터 + AI 생성
│   │   │   ├── StyleReferencePage.jsx
│   │   │   └── HistoryPage.jsx      # 초안 목록 + 삭제
│   │   ├── App.jsx              # 라우팅 + RequireAuth + Layout
│   │   └── App.css
│   ├── vercel.json
│   └── package.json
│
├── backend/                     # Spring Boot 3.x
│   ├── src/main/java/com/shincha/naverblog/
│   │   ├── config/
│   │   │   ├── SecurityConfig.java  # Spring Security + BCryptPasswordEncoder
│   │   │   └── WebConfig.java       # CORS 설정
│   │   ├── security/
│   │   │   └── JwtFilter.java       # JWT 인증 필터
│   │   ├── util/
│   │   │   └── JwtUtil.java         # JWT 생성/검증
│   │   ├── controller/
│   │   │   ├── AuthController.java  # 회원가입 / 로그인
│   │   │   ├── StyleController.java
│   │   │   ├── ImageController.java
│   │   │   ├── DraftController.java
│   │   │   ├── GenerateController.java
│   │   │   └── PostController.java
│   │   └── model/
│   │       ├── dto/             # User, BlogDraft, BlogStyleSample, BlogImage, PostHistory
│   │       ├── dao/             # MyBatis DAO 인터페이스 (UserDao 포함)
│   │       └── service/         # ClaudeServiceImpl, StyleServiceImpl, DraftServiceImpl, ImageServiceImpl
│   └── src/main/resources/
│       ├── application.properties
│       └── mappers/             # MyBatis XML 매퍼 5개 (UserMapper 포함)
│
├── Dockerfile                   # Render 배포용 (repo root 기준)
├── render.yaml
└── README.md
```

---

## 사용 흐름

```
1. 회원가입 → 로그인
         ↓
2. 스타일 관리 → 기존 네이버 여행 글 URL 또는 텍스트 2~3개 등록
         ↓
3. 새 글 작성 → 여행 사진 업로드 + 여행지/날짜/일정/포인트 입력
         ↓
4. AI 생성 버튼 → Claude가 등록된 글 문체로 한국어 초안 작성 (10~30초)
         ↓
5. 에디터에서 내용 수정 → 3초 자동 저장
         ↓
6. 네이버 블로그 글쓰기 페이지 접속
         ↓
7. 크롬 익스텐션 "초안 불러오기" → 본문 자동 삽입
         ↓
8. 제목 직접 입력 → 발행
```

---

## REST API

### 인증 `/api/auth`
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/register` | 회원가입 (username, password) → JWT 반환 |
| POST | `/api/auth/login` | 로그인 → JWT 반환 |

> 이하 모든 API는 `Authorization: Bearer <token>` 헤더 필요

### 스타일 참고 글 `/api/styles`
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/styles` | 내 스타일 목록 조회 |
| POST | `/api/styles` | 텍스트로 직접 추가 |
| POST | `/api/styles/from-url` | URL 스크래핑 후 저장 |
| DELETE | `/api/styles/{id}` | 소프트 삭제 |

### 이미지 `/api/images`
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/images/upload` | 다중 이미지 업로드 (multipart) |
| GET | `/api/images/draft/{draftId}` | draft의 이미지 목록 |
| DELETE | `/api/images/{id}` | 이미지 삭제 |

### 초안 `/api/drafts`
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/drafts` | 내 초안 목록 |
| GET | `/api/drafts/{id}` | 상세 조회 (이미지 포함) |
| POST | `/api/drafts` | 새 초안 생성 |
| PUT | `/api/drafts/{id}` | 편집 내용 저장 |
| DELETE | `/api/drafts/{id}` | 삭제 |

### AI 생성 `/api/generate`
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/generate/{draftId}` | Claude API 호출 → 글 생성 |
| POST | `/api/generate/{draftId}/regenerate` | 재생성 |

### 히스토리 `/api/history`
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/history` | 발행 히스토리 목록 |
| GET | `/api/history/{id}` | 상세 조회 |

---

## 배포

| 서비스 | 플랫폼 | URL |
|--------|--------|-----|
| Frontend | Vercel | https://frontend-blush-seven-53.vercel.app |
| Backend | Render (Docker) | https://naver-blog-backend.onrender.com |
| Database | TiDB Cloud Serverless | ap-southeast-1 |

→ 상세 배포 절차는 **[DEPLOY.md](./DEPLOY.md)** 참고

---

## 크롬 익스텐션 설치

1. `chrome://extensions` → 개발자 모드 ON
2. "압축해제된 확장 프로그램 로드" → `chrome-extension/` 폴더 선택
3. 네이버 블로그 글쓰기 페이지에서 익스텐션 클릭 → 초안 선택 → "초안 불러오기"
4. 제목은 직접 입력 후 발행

> 본문은 `<h2>` 제목 포함 전체 자동 삽입. 네이버 SmartEditor ONE의 제목 필드는 API 접근 불가로 직접 입력 필요.

---

## 주의사항

- **Claude API 비용**: 포스트 1개당 약 $0.01~$0.05. 크레딧 소진 시 Gemini 2.5-flash로 자동 전환 (무료)
- **Render 무료 플랜**: 15분 비활성 시 슬립 → 첫 요청 30~60초 대기
- **Cloudinary**: 이미지 영구 저장용 (Render 파일시스템은 ephemeral). `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` 환경변수 설정 필요
- **JWT_SECRET**: 운영 환경에서 반드시 32자 이상의 강력한 임의 문자열로 설정

---

## Git 저장소

```
https://github.com/SahhaShin/auto_write_travel_blog.git
```
