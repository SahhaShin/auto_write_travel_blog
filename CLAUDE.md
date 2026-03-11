# CLAUDE.md — 네이버 블로그 AI 초안 생성 프로젝트

## 프로젝트 개요

기존 네이버 블로그 글의 문체를 AI가 학습하여, 이미지와 여행 계획 입력만으로 동일 스타일의 블로그 초안을 자동 생성하는 풀스택 웹앱.
생성된 초안은 크롬 익스텐션으로 네이버 블로그 글쓰기 페이지에 삽입, 제목은 사용자가 직접 입력 후 발행.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + Vite 7 |
| Backend | Spring Boot 3.2 (Java 17) + MyBatis |
| Database | TiDB Cloud Serverless (MySQL 8 호환) |
| AI | Claude API (`claude-sonnet-4-6`) + Gemini 2.5-flash (fallback) |
| 이미지 저장 | Cloudinary (Render ephemeral fs 대체) |
| 에디터 | TipTap (ProseMirror 기반) |
| 크롬 익스텐션 | Manifest V3, MAIN world scripting |
| 배포 | Frontend → Vercel / Backend → Render (Docker) |

---

## 프로젝트 구조

```
auto-blog/
├── Dockerfile                  # 루트 Dockerfile (Render 배포용, build context = repo root)
├── render.yaml                 # Render 배포 설정
├── chrome-extension/           # 크롬 익스텐션
│   ├── manifest.json
│   ├── popup.html / popup.js   # 초안 선택 + 본문 삽입 (MAIN world)
│   └── content.js
├── backend/
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/shincha/naverblog/
│       │   ├── controller/     # REST 컨트롤러 5개
│       │   ├── model/dto/      # DTO 클래스
│       │   ├── model/dao/      # MyBatis DAO 인터페이스
│       │   └── model/service/  # 서비스 구현체
│       └── resources/
│           ├── application.properties
│           ├── application-local.properties  # gitignore, 로컬 전용
│           ├── schema.sql
│           └── mappers/        # MyBatis XML 매퍼 4개
└── frontend/
    ├── src/
    │   ├── api/                # axiosClient + 4개 API 모듈
    │   └── pages/              # 4개 페이지 컴포넌트
    ├── vercel.json
    └── package.json
```

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
- `render.yaml`에 `rootDir` 없음, `dockerfilePath: ./Dockerfile`

**Render 환경변수:**

| Key | 비고 |
|-----|------|
| `DB_URL` | `jdbc:mysql://gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/naver_blog_auto?useSSL=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8&allowPublicKeyRetrieval=true` |
| `DB_USERNAME` | TiDB 사용자명 |
| `DB_PASSWORD` | TiDB 비밀번호 |
| `CLAUDE_API_KEY` | Anthropic API 키 |
| `GEMINI_API_KEY` | Google AI Studio 키 (무료, fallback용) |
| `CORS_ORIGINS` | `https://frontend-blush-seven-53.vercel.app` |
| `UPLOAD_DIR` | `/app/uploads` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary 클라우드명 |
| `CLOUDINARY_API_KEY` | Cloudinary API 키 |
| `CLOUDINARY_API_SECRET` | Cloudinary API 시크릿 |

### Database → TiDB Cloud

- 클러스터: ap-southeast-1 (Singapore), Serverless Free
- DB명: `naver_blog_auto`
- 테이블: `blog_style_samples`, `blog_drafts`, `blog_images`, `post_history`
- 스키마 변경 시 TiDB 콘솔 SQL Editor에서 수동 실행 필요

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
- **render.yaml vs 대시보드**: 기존 서비스는 대시보드 설정이 우선
- **Cloudinary**: 이미지 영구 저장. 미설정 시 로컬 uploads 폴더에 저장 (Render에서는 재배포 시 삭제됨)
- **크롬 익스텐션**: 제목은 SmartEditor ONE API 접근 불가로 사용자가 직접 입력. 본문만 자동 삽입
