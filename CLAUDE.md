# CLAUDE.md — 네이버 블로그 자동 포스팅 프로젝트

## 프로젝트 개요

기존 네이버 블로그 글의 문체를 AI가 학습하여, 이미지와 여행 계획 입력만으로 동일 스타일의 블로그 초안을 자동 생성하고 네이버에 자동 발행하는 풀스택 웹앱.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + Vite 7 |
| Backend | Spring Boot 3.2 (Java 17) + MyBatis |
| Database | TiDB Cloud Serverless (MySQL 8 호환) |
| AI | Claude API (`claude-sonnet-4-6`) + Gemini 2.5-flash (fallback) |
| 자동화 | Selenium 4 + WebDriverManager |
| 에디터 | TipTap (ProseMirror 기반) |
| 암호화 | AES-256 (Jasypt) |
| 배포 | Frontend → Vercel / Backend → Render (Docker) |

---

## 프로젝트 구조

```
auto-blog/
├── Dockerfile                  # 루트 Dockerfile (Render 배포용, build context = repo root)
├── render.yaml                 # Render 배포 설정
├── CLAUDE.md                   # 이 파일
├── history.md                  # 개발 히스토리
├── README.md                   # 프로젝트 문서
├── backend/
│   ├── Dockerfile              # 로컬 Docker 빌드용 (rootDir=backend 기준)
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/shincha/naverblog/
│       │   ├── controller/     # REST 컨트롤러 5개
│       │   ├── model/dto/      # DTO 클래스
│       │   ├── model/dao/      # MyBatis DAO 인터페이스
│       │   ├── model/service/  # 서비스 구현체
│       │   └── util/EncryptionUtil.java
│       └── resources/
│           ├── application.properties
│           ├── application-local.properties  # gitignore, 로컬 전용
│           ├── schema.sql
│           └── mappers/        # MyBatis XML 매퍼 5개
└── frontend/
    ├── src/
    │   ├── api/                # axiosClient + 5개 API 모듈
    │   └── pages/              # 5개 페이지 컴포넌트
    ├── .env                    # 로컬 전용 (gitignore)
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
| `GEMINI_API_KEY` | Google AI Studio 키 (무료) |
| `AES_SECRET_KEY` | 32자 이상 임의 문자열 |
| `CORS_ORIGINS` | `https://frontend-blush-seven-53.vercel.app` |
| `UPLOAD_DIR` | `/app/uploads` |

### Database → TiDB Cloud

- 클러스터: ap-southeast-1 (Singapore), Serverless Free
- DB명: `naver_blog_auto`
- 테이블: `blog_style_samples`, `blog_drafts`, `blog_images`, `post_history`, `naver_credentials`
- 스키마 변경 시 TiDB 콘솔 SQL Editor에서 수동 실행 필요 (`spring.sql.init.mode` 미설정)

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
- **render.yaml vs 대시보드**: 기존 서비스는 대시보드 설정이 우선 — 변경 후 대시보드에서 확인
- **Selenium + Chrome**: Render 무료 512MB 환경에서 불안정 가능
- **네이버 SmartEditor**: CSS 선택자가 네이버 업데이트 시 변경될 수 있음
