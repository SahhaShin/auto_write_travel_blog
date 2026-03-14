# 네이버 블로그 AI 초안 생성 웹 애플리케이션

기존에 작성한 네이버 여행 블로그 글의 문체를 AI가 학습하여,
이미지와 여행 계획만 입력하면 동일한 스타일의 블로그 초안을 자동 생성하는 풀스택 웹 애플리케이션입니다.
생성된 초안은 크롬 익스텐션으로 네이버 블로그 글쓰기 페이지에 바로 삽입할 수 있습니다.
여행 플래너 기능으로 여행 계획을 직접 관리하고, 확정된 계획을 AI 블로그 글쓰기에 자동 연동합니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + Vite 7 |
| Backend | Spring Boot 3.2 (Java 17) + Spring Security + MyBatis |
| Database | TiDB Cloud Serverless (MySQL 8 호환) |
| AI | Claude API (claude-sonnet-4-6) + Gemini 2.5-flash (fallback / 여행 계획 생성) |
| 인증 | JWT (JJWT 0.12.5) + BCrypt + Google OAuth 2.0 |
| 에디터 | TipTap (ProseMirror 기반) |
| 이미지 저장 | Cloudinary |
| 배포 | Frontend → Vercel / Backend → Render (Docker) |
| 크롬 익스텐션 | Manifest V3, MAIN world scripting |
| 버전관리 | Git + GitHub |

---

## 주요 기능

1. **회원가입 / 로그인** - JWT 기반 다중 사용자 인증. 사용자별 데이터 완전 분리. **Google 계정으로 로그인** 지원
2. **스타일 학습** - 기존 네이버 블로그 URL 또는 텍스트를 등록하면 AI가 문체 분석
3. **여행 플래너** - 여행 계획 전체 주기 관리
   - AI 자동 생성 (Gemini 2.5-flash): 여행지/기간/스타일 입력 → 일정+체크리스트+짐목록+현지정보 자동 생성
   - 기존 계획 완성: 텍스트 또는 **사진(손글씨·캡처 이미지)** 업로드 → Gemini 멀티모달로 읽어서 일정 완성
   - **AI 자연어 일정 추가**: 카카오톡 내용을 그대로 붙여넣기 → AI가 일정 항목으로 자동 파싱
   - **Leaflet 지도 마커**: 여행 일정 탭 상단에 Leaflet 지도 표시. Nominatim 지오코딩으로 모든 일정 장소를 카테고리별 색상 마커로 표시 (일차 번호, 팝업 정보 포함)
   - 6개 탭 관리: 사전 준비(보드) / 여행 일정 / 서류 준비 / 짐 싸기 / 경비(현지+원화, 날짜순 정렬) / 각종 정보
4. **AI 글 생성** - 이미지 + 여행 계획 입력 → Claude API가 동일 문체로 한국어 초안 생성
   - 여행 플래너 연동 시: 실제 일정·경비·현지 정보가 프롬프트에 자동 반영되어 더 풍부한 글 생성
   - Claude 크레딧 소진 시 **Gemini 2.5-flash 자동 fallback**
5. **리치 에디터** - TipTap 에디터에서 자유롭게 수정, 3초 자동 저장
6. **크롬 익스텐션으로 발행** - 네이버 블로그 글쓰기 페이지에서 초안 본문을 자동 삽입, 제목은 직접 입력 후 발행
7. **발행 히스토리** - 초안 목록 관리 및 삭제

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
│   │   │   ├── postApi.js
│   │   │   └── travelApi.js     # 여행 플래너 API
│   │   ├── components/
│   │   │   └── TravelMap.jsx        # Leaflet 지도 (Nominatim 지오코딩, 카테고리 마커)
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx        # Google Sign-In 버튼 포함
│   │   │   ├── RegisterPage.jsx     # Google Sign-In 버튼 포함
│   │   │   ├── CreatePostPage.jsx   # 여행 계획 연결 + 이미지 업로드
│   │   │   ├── EditorPage.jsx
│   │   │   ├── StyleReferencePage.jsx
│   │   │   ├── HistoryPage.jsx
│   │   │   ├── TravelListPage.jsx   # 여행 목록
│   │   │   ├── TravelCreatePage.jsx # 새 여행 생성 (AI 자동 / 계획 완성 + 사진 업로드)
│   │   │   └── TravelDetailPage.jsx # 여행 상세 (6탭 + 구글 지도 + AI 자연어 입력)
│   │   ├── App.jsx
│   │   └── App.css
│   ├── vercel.json
│   └── package.json
│
├── backend/                     # Spring Boot 3.x
│   ├── src/main/java/com/shincha/naverblog/
│   │   ├── config/
│   │   │   ├── SecurityConfig.java  # Spring Security + AntPathRequestMatcher + BCrypt
│   │   │   └── WebConfig.java       # CORS allowedOriginPatterns + RestTemplate @Bean
│   │   ├── security/
│   │   │   └── JwtFilter.java
│   │   ├── util/
│   │   │   └── JwtUtil.java
│   │   ├── controller/
│   │   │   ├── AuthController.java
│   │   │   ├── StyleController.java
│   │   │   ├── ImageController.java
│   │   │   ├── DraftController.java
│   │   │   ├── GenerateController.java
│   │   │   ├── PostController.java
│   │   │   └── TravelController.java   # 여행 플래너 API
│   │   └── model/
│   │       ├── dto/
│   │       │   ├── User.java
│   │       │   ├── BlogDraft.java       # tripId 필드 포함
│   │       │   ├── BlogStyleSample.java
│   │       │   ├── BlogImage.java
│   │       │   ├── PostHistory.java
│   │       │   ├── TravelTrip.java
│   │       │   ├── TravelItinerary.java
│   │       │   ├── TravelChecklist.java
│   │       │   └── TravelExpense.java
│   │       ├── dao/
│   │       │   ├── UserDao.java
│   │       │   ├── DraftDao.java
│   │       │   ├── StyleDao.java
│   │       │   ├── ImageDao.java
│   │       │   ├── PostHistoryDao.java
│   │       │   └── TravelDao.java
│   │       └── service/
│   │           ├── ClaudeServiceImpl.java  # 여행 계획 데이터 프롬프트 반영
│   │           ├── StyleServiceImpl.java
│   │           ├── DraftServiceImpl.java
│   │           ├── ImageServiceImpl.java
│   │           └── TravelServiceImpl.java  # AI 여행 계획 생성/파싱 (Gemini)
│   └── src/main/resources/
│       ├── application.properties
│       └── mappers/
│           ├── UserMapper.xml
│           ├── DraftMapper.xml
│           ├── StyleMapper.xml
│           ├── ImageMapper.xml
│           ├── PostHistoryMapper.xml
│           └── TravelMapper.xml
│
├── Dockerfile                   # Render 배포용
├── render.yaml
├── DEV_RULES.md                 # 개발 규칙 (브랜치/PR/리뷰/MD 업데이트)
└── README.md
```

---

## 사용 흐름

### 여행 플래너 → 블로그 글쓰기 연동 흐름

```
1. 여행 플래너 → 새 여행 계획
         ↓
2. AI로 일정 자동 생성 OR 기존 계획 텍스트/사진 붙여넣기 완성
         ↓
3. AI 자연어 일정 추가 (카카오톡 내용 → 자동 파싱)
         ↓
4. 6개 탭에서 일정·경비·서류·짐·현지정보 관리
         ↓
5. 새 글 작성 → "여행 계획 연결" 드롭다운에서 해당 여행 선택
         ↓
6. AI 글 생성 → 실제 일정/경비/현지정보가 프롬프트에 자동 반영
         ↓
7. 에디터에서 수정 → 크롬 익스텐션으로 네이버 블로그에 삽입
```

### 단독 블로그 글쓰기 흐름

```
1. 회원가입 → 로그인
2. 스타일 관리 → 기존 네이버 여행 글 등록
3. 새 글 작성 → 여행 계획 연결 없이 직접 입력
4. AI 생성 → 에디터 수정 → 크롬 익스텐션 발행
```

---

## REST API

### 인증 `/api/auth`
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/register` | 회원가입 → JWT 반환 |
| POST | `/api/auth/login` | 로그인 → JWT 반환 |
| POST | `/api/auth/google` | Google idToken 검증 → 계정 생성/연동 → JWT 반환 |

> 이하 모든 API는 `Authorization: Bearer <token>` 헤더 필요

### 스타일 `/api/styles`
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/styles` | 내 스타일 목록 |
| POST | `/api/styles` | 텍스트로 추가 |
| POST | `/api/styles/from-url` | URL 스크래핑 후 저장 |
| DELETE | `/api/styles/{id}` | 삭제 |

### 이미지 `/api/images`
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/images/upload` | 다중 업로드 (multipart) |
| GET | `/api/images/draft/{draftId}` | draft 이미지 목록 |
| DELETE | `/api/images/{id}` | 삭제 |

### 초안 `/api/drafts`
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/drafts` | 내 초안 목록 |
| GET | `/api/drafts/{id}` | 상세 (이미지 포함) |
| POST | `/api/drafts` | 생성 (tripId 선택) |
| PUT | `/api/drafts/{id}` | 편집 저장 |
| DELETE | `/api/drafts/{id}` | 삭제 |

### AI 생성 `/api/generate`
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/generate/{draftId}` | 글 생성 (tripId 있으면 여행 계획 반영) |
| POST | `/api/generate/{draftId}/regenerate` | 재생성 |

### 여행 플래너 `/api/travel`
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/travel` | 내 여행 목록 |
| POST | `/api/travel` | 여행 생성 |
| GET | `/api/travel/{tripId}` | 상세 (일정+체크리스트+경비 포함) |
| PUT | `/api/travel/{tripId}` | 여행 기본 정보 수정 |
| DELETE | `/api/travel/{tripId}` | 삭제 |
| POST | `/api/travel/{tripId}/generate` | AI로 전체 계획 생성 (Gemini) |
| POST | `/api/travel/{tripId}/fill-gaps` | AI로 빈 시간대 채우기 |
| POST | `/api/travel/{tripId}/complete` | 텍스트+이미지 기반 AI 계획 완성 (Gemini 멀티모달) |
| POST | `/api/travel/{tripId}/parse-text` | 자연어 텍스트 → 일정 자동 파싱 |
| POST | `/api/travel/{tripId}/itinerary` | 일정 추가 |
| PUT | `/api/travel/{tripId}/itinerary/{id}` | 일정 수정 |
| DELETE | `/api/travel/{tripId}/itinerary/{id}` | 일정 삭제 |
| POST | `/api/travel/{tripId}/checklist` | 체크리스트 항목 추가 |
| PUT | `/api/travel/{tripId}/checklist/{id}/status` | 상태 변경 |
| DELETE | `/api/travel/{tripId}/checklist/{id}` | 삭제 |
| POST | `/api/travel/{tripId}/expenses` | 경비 추가 |
| PUT | `/api/travel/{tripId}/expenses/{id}` | 경비 수정 |
| DELETE | `/api/travel/{tripId}/expenses/{id}` | 경비 삭제 |
| PUT | `/api/travel/{tripId}/info` | 각종 정보 저장 |

### 히스토리 `/api/history`
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/history` | 발행 히스토리 목록 |

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

- **Claude API 비용**: 포스트 1개당 약 $0.01~$0.05. 크레딧 소진 시 Gemini 2.5-flash 자동 전환 (무료)
- **여행 계획 AI 생성**: Gemini 2.5-flash 사용 (무료)
- **Render 무료 플랜**: 15분 비활성 시 슬립 → 첫 요청 30~60초 대기
- **Cloudinary**: 이미지 영구 저장용. 미설정 시 Render 재배포 때 이미지 삭제됨
- **JWT_SECRET**: 운영 환경에서 반드시 32자 이상 강력한 문자열 설정
- **CORS**: SecurityConfig에서 `AntPathRequestMatcher` 사용 (Spring Security 6 MvcRequestMatcher 이슈 우회)
- **이미지 업로드 (기존 계획 완성)**: 프론트에서 Canvas로 최대 1024px 압축 후 base64 전송

---

## Git 저장소

```
https://github.com/SahhaShin/auto_write_travel_blog.git
```
