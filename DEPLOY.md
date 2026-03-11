# 빌드 & 배포 가이드

---

## 운영 URL

| 서비스 | URL |
|--------|-----|
| Frontend | https://frontend-blush-seven-53.vercel.app |
| Backend | https://naver-blog-backend.onrender.com |
| Database | TiDB Cloud Serverless (ap-southeast-1) |

---

## 로컬 개발

### 사전 요구사항

- Java 17 Corretto (`~/Library/Java/JavaVirtualMachines/corretto-17.0.7`)
- Maven (`/opt/homebrew/opt/maven/bin/mvn`)
- Node.js / npm
- 로컬 MySQL 8 (DBeaver로 관리)

> 로컬 기본 Java가 11이므로 백엔드 실행/빌드 시 반드시 `JAVA_HOME` 명시

### 로컬 환경변수 설정

`backend/src/main/resources/application-local.properties` 생성 (git 제외):

```properties
spring.datasource.password=MySQL_비밀번호
claude.api.key=sk-ant-api03-...
gemini.api.key=AIzaSy...
```

### 백엔드 실행

```bash
cd /Users/shinsanha/Desktop/auto-blog/backend

JAVA_HOME=~/Library/Java/JavaVirtualMachines/corretto-17.0.7/Contents/Home \
/opt/homebrew/opt/maven/bin/mvn spring-boot:run \
  -Dspring-boot.run.profiles=local
```

확인: `http://localhost:8080/api/drafts` → `[]` 반환

### 프론트엔드 실행

```bash
cd /Users/shinsanha/Desktop/auto-blog/frontend
npm run dev
```

브라우저: `http://localhost:5173`

---

## 빌드

### 백엔드 JAR 빌드

```bash
cd /Users/shinsanha/Desktop/auto-blog/backend

JAVA_HOME=~/Library/Java/JavaVirtualMachines/corretto-17.0.7/Contents/Home \
mvn clean package -DskipTests
```

결과물: `backend/target/naver-blog-backend-0.0.1-SNAPSHOT.jar`

### 프론트엔드 빌드

```bash
cd /Users/shinsanha/Desktop/auto-blog/frontend
npm run build
```

결과물: `frontend/dist/`

---

## 배포

### Frontend → Vercel

```bash
cd /Users/shinsanha/Desktop/auto-blog/frontend
vercel --prod --yes
```

**Vercel 환경변수** (최초 1회 설정):

```bash
vercel env add VITE_API_BASE_URL production
# 값: https://naver-blog-backend.onrender.com
```

### Backend → Render

git push 하면 자동 배포 (Auto-Deploy).

```bash
git add .
git commit -m "변경 내용"
git push origin main
```

**Render 환경변수** (대시보드 → Environment):

| Key | Value |
|-----|-------|
| `DB_URL` | `jdbc:mysql://gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/naver_blog_auto?useSSL=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8&allowPublicKeyRetrieval=true` |
| `DB_USERNAME` | TiDB 사용자명 |
| `DB_PASSWORD` | TiDB 비밀번호 |
| `CLAUDE_API_KEY` | Anthropic API 키 |
| `GEMINI_API_KEY` | Google AI Studio 키 (무료, fallback) |
| `CORS_ORIGINS` | `https://frontend-blush-seven-53.vercel.app` |
| `UPLOAD_DIR` | `/app/uploads` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary 클라우드명 |
| `CLOUDINARY_API_KEY` | Cloudinary API 키 |
| `CLOUDINARY_API_SECRET` | Cloudinary API 시크릿 |

**Render 설정 (대시보드 확인):**
- Root Directory: 비워두기
- Dockerfile Path: `./Dockerfile`
- Runtime: Docker

### Database → TiDB Cloud

- 클러스터: Serverless Free (ap-southeast-1)
- DB명: `naver_blog_auto`
- **스키마 자동 실행 안됨** → 변경 시 TiDB 콘솔 SQL Editor에서 직접 실행

테이블 초기 생성:
```
backend/src/main/resources/schema.sql 참고
```

### 크롬 익스텐션

별도 빌드 불필요. `chrome-extension/` 폴더를 그대로 로드.

```
1. chrome://extensions → 개발자 모드 ON
2. "압축해제된 확장 프로그램 로드" → chrome-extension/ 폴더 선택
3. 코드 변경 후에는 chrome://extensions에서 새로고침(↺) 필요
```

---

## Dockerfile 구조

```
repo root/
└── Dockerfile    ← Render 배포용 (build context = repo root)
                    COPY backend/pom.xml, COPY backend/src
```

---

## 주의사항

- **Render 무료 플랜**: 15분 비활성 시 슬립 → 첫 요청 50초+ 지연
- **render.yaml vs 대시보드**: 기존 서비스는 대시보드 설정 우선
- **schema.sql 자동 실행 안됨**: DB 스키마 변경 시 TiDB 콘솔에서 수동 실행
- **Cloudinary 미설정 시**: 이미지가 로컬 uploads에 저장 → Render 재배포 시 삭제됨
