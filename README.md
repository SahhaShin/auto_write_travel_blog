# 네이버 블로그 AI 초안 생성 웹 애플리케이션

기존에 작성한 네이버 여행 블로그 글의 문체를 AI가 학습하여,
이미지와 여행 계획만 입력하면 동일한 스타일의 블로그 초안을 자동 생성하는 풀스택 웹 애플리케이션입니다.
생성된 초안은 크롬 익스텐션으로 네이버 블로그 글쓰기 페이지에 바로 삽입할 수 있습니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + Vite 7 |
| Backend | Spring Boot 3.2 (Java 17) + MyBatis |
| Database | TiDB Cloud Serverless (MySQL 8 호환) |
| AI | Claude API (claude-sonnet-4-6) + Gemini 2.5-flash (fallback) |
| 에디터 | TipTap (ProseMirror 기반) |
| 이미지 저장 | Cloudinary |
| 배포 | Frontend → Vercel / Backend → Render (Docker) |
| 크롬 익스텐션 | Manifest V3, MAIN world scripting |
| 버전관리 | Git + GitHub |

---

## 주요 기능

1. **스타일 학습** - 기존 네이버 블로그 URL 또는 텍스트를 등록하면 AI가 문체 분석
2. **AI 글 생성** - 이미지 + 여행 계획 입력 → Claude API가 동일 문체로 한국어 초안 생성
   - Claude 크레딧 소진 시 **Gemini 2.5-flash 자동 fallback**
3. **리치 에디터** - TipTap 에디터에서 자유롭게 수정, 3초 자동 저장
4. **크롬 익스텐션으로 발행** - 네이버 블로그 글쓰기 페이지에서 초안 본문을 자동 삽입, 제목은 직접 입력 후 발행
5. **발행 히스토리** - 발행된 글 목록 관리

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
│   │   ├── api/                 # Axios API 클라이언트
│   │   │   ├── axiosClient.js
│   │   │   ├── styleApi.js
│   │   │   ├── draftApi.js
│   │   │   ├── imageApi.js
│   │   │   ├── generateApi.js
│   │   │   └── postApi.js       # 히스토리 API
│   │   ├── pages/
│   │   │   ├── CreatePostPage.jsx   # 이미지 업로드 + 여행 계획 입력
│   │   │   ├── EditorPage.jsx       # TipTap 에디터 + AI 생성
│   │   │   ├── StyleReferencePage.jsx
│   │   │   └── HistoryPage.jsx
│   │   ├── App.jsx
│   │   └── App.css
│   ├── vercel.json
│   └── package.json
│
├── backend/                     # Spring Boot 3.x
│   ├── src/main/java/com/shincha/naverblog/
│   │   ├── controller/
│   │   │   ├── StyleController.java
│   │   │   ├── ImageController.java
│   │   │   ├── DraftController.java
│   │   │   ├── GenerateController.java
│   │   │   └── PostController.java  # 히스토리 API
│   │   ├── model/
│   │   │   ├── dto/
│   │   │   ├── dao/
│   │   │   └── service/
│   │   │       ├── ClaudeServiceImpl.java
│   │   │       ├── StyleServiceImpl.java
│   │   │       ├── ImageServiceImpl.java
│   │   │       └── DraftServiceImpl.java
│   └── src/main/resources/
│       ├── application.properties
│       ├── schema.sql
│       └── mappers/             # MyBatis XML 매퍼 4개
│
├── Dockerfile                   # Render 배포용 (repo root 기준)
├── render.yaml
└── README.md
```

---

## 사용 흐름

```
1. 스타일 관리 → 기존 네이버 여행 글 URL 또는 텍스트 2~3개 등록
         ↓
2. 새 글 작성 → 여행 사진 업로드 + 여행지/날짜/일정/포인트 입력
         ↓
3. AI 생성 버튼 → Claude가 등록된 글 문체로 한국어 초안 작성 (10~30초)
         ↓
4. 에디터에서 내용 수정 → 3초 자동 저장
         ↓
5. 네이버 블로그 글쓰기 페이지 접속
         ↓
6. 크롬 익스텐션 "초안 불러오기" → 본문 자동 삽입
         ↓
7. 제목 직접 입력 → 발행
```

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
| DELETE | `/api/images/{id}` | 이미지 삭제 |

### 초안 `/api/drafts`
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/drafts` | 전체 목록 |
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

---

## 주의사항

- **Claude API 비용**: 포스트 1개당 약 $0.01~$0.05. 크레딧 소진 시 Gemini 2.5-flash로 자동 전환 (무료)
- **Render 무료 플랜**: 15분 비활성 시 슬립 → 첫 요청 30~60초 대기
- **Cloudinary**: 이미지 영구 저장용 (Render 파일시스템은 ephemeral). Render 환경변수에 `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` 설정 필요

---

## Git 저장소

```
https://github.com/SahhaShin/auto_write_travel_blog.git
```
