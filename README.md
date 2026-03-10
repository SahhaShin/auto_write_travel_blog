# 네이버 블로그 자동 포스팅 웹 애플리케이션

기존에 작성한 네이버 여행 블로그 글의 문체를 AI가 학습하여,
이미지와 여행 계획만 입력하면 동일한 스타일의 블로그 초안을 자동 생성하고
네이버에 자동으로 포스팅해주는 풀스택 웹 애플리케이션입니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18 + Vite |
| Backend | Spring Boot 3.2 (Java 17) |
| Database | TiDB Cloud Serverless (MySQL 8 호환) |
| AI | Claude API (claude-sonnet-4-6) + Gemini 2.5-flash (fallback) |
| 자동화 | Selenium 4 + WebDriverManager |
| 에디터 | TipTap (ProseMirror 기반) |
| 암호화 | AES-256 (Jasypt) |
| 배포 | Frontend → Vercel / Backend → Render (Docker) |
| 버전관리 | Git + GitHub |

---

## 주요 기능

1. **스타일 학습** - 기존 네이버 블로그 URL 또는 텍스트를 등록하면 AI가 문체 분석
2. **AI 글 생성** - 이미지 + 여행 계획 입력 → Claude API가 동일 문체로 한국어 초안 생성
   - Claude 크레딧 소진 시 **Gemini 2.5-flash 자동 fallback**
3. **리치 에디터** - TipTap 에디터에서 자유롭게 수정, 3초 자동 저장
4. **네이버 자동 발행** - Selenium이 네이버 로그인 → SmartEditor ONE에 글 입력 → 발행
   - **쿠키 세션 재사용** - 최초 로그인 후 세션 쿠키를 AES-256 암호화하여 DB 저장, 이후 자동 재사용
   - **캡차 대기** - 실제 브라우저 창 실행으로 봇 감지 우회, 캡차 발생 시 사용자가 직접 해결
   - **2FA(OTP) 지원** - `/api/post/otp/{draftId}` 엔드포인트로 OTP 제출 시 자동 입력
5. **발행 히스토리** - 발행된 글 목록 및 네이버 URL 관리

---

## 프로젝트 구조

```
auto-blog/
├── frontend/                        # React + Vite
│   ├── src/
│   │   ├── api/                     # Axios API 클라이언트
│   │   │   ├── axiosClient.js       # 기본 axios 설정
│   │   │   ├── styleApi.js          # 스타일 참고 글 API
│   │   │   ├── draftApi.js          # 초안 CRUD API
│   │   │   ├── imageApi.js          # 이미지 업로드 API
│   │   │   ├── generateApi.js       # Claude AI 생성 API
│   │   │   └── postApi.js           # 발행 / 히스토리 API
│   │   ├── pages/
│   │   │   ├── CreatePostPage.jsx   # 이미지 업로드 + 여행 계획 입력
│   │   │   ├── EditorPage.jsx       # TipTap 에디터 + AI 생성 + 발행
│   │   │   ├── StyleReferencePage.jsx  # 스타일 참고 글 관리
│   │   │   ├── HistoryPage.jsx      # 초안 목록 + 발행 히스토리
│   │   │   └── SettingsPage.jsx     # 네이버 로그인 정보 설정
│   │   ├── App.jsx                  # 라우팅 설정
│   │   └── App.css                  # 전역 스타일
│   ├── vercel.json                  # Vercel SPA 라우팅 설정
│   ├── .env.example                 # 환경변수 예시
│   └── package.json
│
├── backend/                         # Spring Boot 3.x
│   ├── src/main/java/com/shincha/naverblog/
│   │   ├── NaverBlogApplication.java
│   │   ├── config/
│   │   │   └── WebConfig.java       # CORS + 정적 파일 서빙
│   │   ├── controller/
│   │   │   ├── StyleController.java
│   │   │   ├── ImageController.java
│   │   │   ├── DraftController.java
│   │   │   ├── GenerateController.java
│   │   │   └── PostController.java
│   │   ├── model/
│   │   │   ├── dto/                 # BlogDraft, BlogImage, BlogStyleSample 등
│   │   │   ├── dao/                 # MyBatis DAO 인터페이스
│   │   │   └── service/
│   │   │       ├── ClaudeServiceImpl.java       # Claude API 연동
│   │   │       ├── NaverAutoPostServiceImpl.java # Selenium 자동화
│   │   │       ├── StyleServiceImpl.java         # jsoup URL 스크래핑
│   │   │       ├── ImageServiceImpl.java
│   │   │       └── DraftServiceImpl.java
│   │   └── util/
│   │       └── EncryptionUtil.java  # AES-256 암호화
│   ├── src/main/resources/
│   │   ├── application.properties   # 환경변수 기반 설정
│   │   ├── schema.sql               # MySQL 테이블 생성 스크립트
│   │   └── mappers/                 # MyBatis XML 매퍼 (5개)
│   ├── Dockerfile                   # Chrome 포함 컨테이너
│   └── pom.xml
│
├── render.yaml                      # Render 배포 설정
├── .gitignore
└── README.md
```

---

## 데이터베이스 스키마

### blog_style_samples — 스타일 참고 글
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT | PK |
| title | VARCHAR(500) | 참고 글 제목 |
| source_url | VARCHAR(1000) | 네이버 블로그 원본 URL |
| content | LONGTEXT | 참고 본문 |
| category | VARCHAR(100) | 카테고리 |
| is_active | TINYINT | 소프트 삭제 여부 |

### blog_drafts — 초안 (핵심 테이블)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT | PK |
| destination | VARCHAR(500) | 여행지 |
| travel_dates | VARCHAR(200) | 여행 날짜 |
| itinerary | TEXT | 일정 개요 |
| key_points | TEXT | 강조 포인트 |
| generated_content | LONGTEXT | AI 생성 본문 (HTML) |
| final_content | LONGTEXT | 최종 편집 본문 (HTML) |
| status | ENUM | DRAFT / GENERATED / EDITING / READY / POSTED / FAILED |
| naver_post_url | VARCHAR(1000) | 발행 후 네이버 URL |

### blog_images — 업로드 이미지
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT | PK |
| draft_id | BIGINT | FK → blog_drafts |
| stored_path | VARCHAR(1000) | 서버 저장 경로 |
| public_url | VARCHAR(1000) | 외부 접근 URL |
| display_order | INT | 포스트 내 순서 |

### post_history — 발행 히스토리 (불변 로그)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT | PK |
| draft_id | BIGINT | FK → blog_drafts |
| naver_post_url | VARCHAR(1000) | 발행된 URL |
| content_snapshot | LONGTEXT | 발행 시점 본문 스냅샷 |
| automation_log | TEXT | Selenium 실행 로그 |

### naver_credentials — 네이버 로그인 정보
| 컬럼 | 타입 | 설명 |
|------|------|------|
| encrypted_id | VARCHAR(500) | AES-256 암호화된 아이디 |
| encrypted_password | VARCHAR(500) | AES-256 암호화된 비밀번호 |
| blog_id | VARCHAR(200) | 블로그 URL 경로 ID |
| session_cookies | MEDIUMTEXT | AES-256 암호화된 로그인 쿠키 JSON (세션 재사용) |

---

## REST API

### 스타일 참고 글 `/api/styles`
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/styles` | 목록 조회 |
| POST | `/api/styles` | 텍스트로 직접 추가 |
| POST | `/api/styles/from-url` | URL 스크래핑 후 저장 |
| DELETE | `/api/styles/{id}` | 소프트 삭제 |

### 이미지 `/api/images`
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/images/upload` | 다중 이미지 업로드 (multipart) |
| GET | `/api/images/draft/{draftId}` | draft의 이미지 목록 |
| PUT | `/api/images/{id}/order` | 이미지 순서 변경 |
| DELETE | `/api/images/{id}` | 이미지 삭제 |

### 초안 `/api/drafts`
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/drafts` | 전체 목록 |
| GET | `/api/drafts/{id}` | 상세 조회 (이미지 포함) |
| POST | `/api/drafts` | 새 초안 생성 |
| PUT | `/api/drafts/{id}` | 편집 내용 저장 (자동저장) |
| DELETE | `/api/drafts/{id}` | 삭제 |

### AI 생성 `/api/generate`
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/generate/{draftId}` | Claude API 호출 → 글 생성 |
| POST | `/api/generate/{draftId}/regenerate` | 다른 옵션으로 재생성 |

### 발행 `/api/post`
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/post/{draftId}` | 네이버 자동 발행 시작 (비동기, 202 반환) |
| GET | `/api/post/status/{draftId}` | 발행 진행 상태 폴링 |
| POST | `/api/post/otp/{draftId}` | 2FA OTP 제출 (발행 대기 중 호출) |
| PUT | `/api/credentials` | 네이버 로그인 정보 저장 |
| GET | `/api/history` | 발행 히스토리 목록 |

**발행 상태값 (`GET /api/post/status/{draftId}` 응답)**
| 상태 | 의미 |
|------|------|
| `PENDING` | 발행 요청 접수 |
| `LOGGING_IN` | 로그인 진행 중 |
| `WAITING_CAPTCHA` | 캡차 발생 - 브라우저에서 직접 해결 필요 |
| `WAITING_2FA` | 2차 인증 대기 - `/api/post/otp/{id}`로 OTP 제출 |
| `NAVIGATING` | 글쓰기 페이지 이동 중 |
| `SETTING_TITLE` | 제목 입력 중 |
| `SETTING_CONTENT` | 본문 입력 중 |
| `PUBLISHING` | 발행 버튼 클릭 중 |
| `SUCCESS:{url}` | 발행 완료 (네이버 글 URL 포함) |
| `FAILED:{msg}` | 실패 (오류 메시지 포함) |

---

## 로컬 개발 / 빌드 / 배포

→ **[DEPLOY.md](./DEPLOY.md)** 참고

---

## 사용 흐름

```
1. 설정 페이지 → 네이버 아이디/비밀번호/블로그ID 저장
         ↓
2. 스타일 관리 → 기존 네이버 여행 글 URL 또는 텍스트 2~3개 등록
         ↓
3. 새 글 작성 → 여행 사진 업로드 + 여행지/날짜/일정/포인트 입력
         ↓
4. AI 생성 버튼 → Claude가 등록된 글 문체로 한국어 초안 작성 (10~30초)
         ↓
5. 에디터에서 내용 수정 → 3초 자동 저장
         ↓
6. 네이버에 발행 → Selenium이 자동 로그인 → SmartEditor에 입력 → 발행
         ↓
7. 히스토리 페이지에서 발행된 네이버 글 링크 확인
```

---

## 배포

| 서비스 | 플랫폼 | URL |
|--------|--------|-----|
| Frontend | Vercel | https://frontend-blush-seven-53.vercel.app |
| Backend | Render (Docker) | https://naver-blog-backend.onrender.com |
| Database | TiDB Cloud Serverless | ap-southeast-1 |

→ 상세 배포 절차는 **[DEPLOY.md](./DEPLOY.md)** 참고

---

## 주의사항

- **네이버 2단계 인증(OTP)** - `/api/post/otp/{draftId}` 엔드포인트로 OTP 제출 지원. 단, 패스키/앱 인증 방식은 미지원
- **네이버 캡차** - 실제 브라우저 창이 열리므로 캡차 발생 시 직접 해결 가능. 상태 폴링(`WAITING_CAPTCHA`)으로 확인
- **쿠키 세션** - 최초 로그인 후 쿠키가 DB에 저장되어 이후 로그인 생략. 쿠키 만료 시 재로그인 자동 수행
- **Claude API 비용**: 포스트 1개당 약 $0.01~$0.05. 크레딧 소진 시 Gemini 2.5-flash로 자동 전환 (무료)
- **Render 무료 플랜**: 15분 비활성 시 슬립 → 첫 요청 30~60초 대기
- **Selenium + Chrome**: 메모리 512MB(Render 무료) 환경에서 불안정할 수 있음 → AI 생성/편집 기능은 정상 동작
- **네이버 SmartEditor ONE** CSS 선택자는 네이버 업데이트 시 변경될 수 있음 (`NaverAutoPostServiceImpl.java` 수정 필요)

---

## Git 저장소

```
https://github.com/SahhaShin/auto_write_travel_blog.git
```

**브랜치 전략**
```
main - 배포 기준 브랜치
```

**커밋 후 push**
```bash
cd /Users/shinsanha/Desktop/auto-blog
git add .
git commit -m "변경 내용 설명"
git push
```

---

## 개발 환경 정보

| 항목 | 경로 / 버전 |
|------|-------------|
| Java 17 | `~/Library/Java/JavaVirtualMachines/corretto-17.0.7` |
| Maven | `/opt/homebrew/opt/maven/bin/mvn` |
| MySQL (로컬) | `/opt/homebrew/bin/mysql` (ver 8.1.0) |
| MySQL (프로덕션) | TiDB Cloud Serverless (ap-southeast-1) |
| Node | npm 사용 가능 |
| DB 관리 도구 | DBeaver |
