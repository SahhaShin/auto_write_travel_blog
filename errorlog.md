# 에러 로그

프로젝트 개발 중 발생한 오류와 해결 방법을 기록합니다.
Frontend / Backend 섹션으로 구분하여 날짜순 정리.

---

# BACKEND

---

## 2026-03-06 (초기 실행)

### [ERR-001] MySQL `CREATE INDEX IF NOT EXISTS` 문법 오류

**발생 위치:** `backend/src/main/resources/schema.sql`

**오류 메시지:**
```
ERROR 1064 (42000): You have an error in your SQL syntax...
near 'IF NOT EXISTS idx_drafts_status'
```

**원인:** MySQL 8.0은 `CREATE INDEX IF NOT EXISTS` 구문을 지원하지 않음

**해결:**
```sql
-- 변경 전
CREATE INDEX IF NOT EXISTS idx_drafts_status ON blog_drafts(status);

-- 변경 후
CREATE INDEX idx_drafts_status ON blog_drafts(status);
```

---

### [ERR-002] GitHub HTTPS push 인증 실패

**오류 메시지:**
```
fatal: could not read Username for 'https://github.com': Device not configured
```

**원인:** macOS 터미널 환경에서 HTTPS 방식으로 GitHub 인증 불가

**해결:** remote URL을 SSH 방식으로 변경
```bash
git remote set-url origin git@github.com:SahhaShin/auto_write_travel_blog.git
```

---

### [ERR-003] Maven 명령어 없음

**오류 메시지:**
```
command not found: mvn
```

**원인:** Maven이 설치되어 있지 않음

**해결:**
```bash
brew install maven
# 이후 실행 시 전체 경로 사용
/opt/homebrew/opt/maven/bin/mvn spring-boot:run
```

---

### [ERR-004] MySQL root 로그인 실패

**오류 메시지:**
```
ERROR 1045 (28000): Access denied for user 'root'@'localhost' (using password: NO)
```

**원인:** root 계정에 비밀번호가 설정되어 있으나 공백으로 시도함

**해결:**
- MySQL 바이너리 경로: `/opt/homebrew/Cellar/mysql@8.0/8.0.45_1/bin/mysql`
- `application-local.properties`에 실제 비밀번호 설정

---

### [ERR-005] `.claude/` 폴더 git에 실수로 스테이징

**원인:** `.gitignore`에 `.claude/`가 없는 상태에서 `git add .` 실행

**해결:**
```bash
git rm --cached -rf .claude/
echo ".claude/" >> .gitignore
```

---

### [ERR-006] 네이버 블로그 본문 추출 실패 (jsoup + iframe)

**발생 위치:** `backend/.../model/service/StyleServiceImpl.java`

**오류 메시지:**
```json
{"error": "블로그 본문을 추출할 수 없습니다. URL을 확인해주세요."}
```

**원인:**
네이버 블로그 PC 버전(`blog.naver.com`)은 본문이 iframe 내부에 렌더링되어 jsoup으로 직접 접근 불가.
`.se-main-container` 등 셀렉터가 iframe 밖의 HTML에서는 매칭되지 않음.

**해결:** PC URL → 모바일 URL(`m.blog.naver.com`)로 자동 변환
```java
private String toMobileNaverUrl(String url) {
    if (url.contains("blog.naver.com") && !url.contains("m.blog.naver.com")) {
        return url.replace("blog.naver.com", "m.blog.naver.com");
    }
    return url;
}
```

---

## 2026-03-06 (QA 세션 - AI 생성)

### [ERR-007] POST /api/drafts → 500 Internal Server Error

**발생 위치:** `backend/.../model/service/DraftServiceImpl.java`

**원인:**
`blog_drafts` 테이블의 `category` 컬럼이 NOT NULL인데, 프론트에서 category를 보내지 않아 null 삽입 시도

**해결:**
```java
// DraftServiceImpl.create() 메서드에 기본값 추가
if (draft.getCategory() == null) draft.setCategory("여행");
```

---

### [ERR-008] Claude API 400 - credit balance is too low

**오류 메시지:**
```
{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low..."}}
```

**원인:** Claude API 크레딧 소진

**해결:** Gemini API를 fallback으로 구현
- Claude 호출 → "credit balance is too low" 감지 시 → Gemini 자동 전환
- `ClaudeServiceImpl.java`에 `CreditExhaustedException`, `callGemini()` 추가

---

### [ERR-009] Gemini API 429 - API key 할당량 0

**오류 메시지:**
```
429 Too Many Requests - quota limit:0
```

**원인:** 첫 번째 Gemini API 키(`AIzaSyC1...`)가 billing 프로젝트에 연결되어 있어 free tier 할당량 없음

**해결:** Google AI Studio에서 새 API 키 발급 (`AIzaSyAGC...`)

---

### [ERR-010] Gemini 404 - gemini-1.5-flash 모델 없음

**오류 메시지:**
```
404 Not Found - models/gemini-1.5-flash is not found
```

**원인:** `v1beta` API에서 `gemini-1.5-flash` 모델명이 유효하지 않음

**해결:** `models.list` API로 실제 가능한 모델 확인 후 `gemini-2.5-flash`로 교체

---

### [ERR-011] Maven 빌드 실패 - Java 버전 불일치

**오류 메시지:**
```
Fatal error compiling: error: release version 17 not supported
```

**원인:** 기본 JAVA_HOME이 Java 17이 아닌 다른 버전을 가리킴

**해결:**
```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17) mvn spring-boot:run -Dspring-boot.run.profiles=local
```

---

## 2026-03-10 (배포)

### [ERR-012] Render Dockerfile 경로 오류

**오류 메시지:**
```
failed to read dockerfile: open Dockerfile: no such file or directory
```

**원인:** `render.yaml`의 `dockerfilePath: ./Dockerfile`이 repo 루트 기준인데 루트에 Dockerfile 없음

**해결:** repo 루트에 Dockerfile 생성. `COPY` 경로를 `backend/` 기준으로 수정

---

### [ERR-013] Spring Security 추가 후 CORS 에러

**증상:** Spring Security 의존성 추가 후 프론트엔드에서 API 호출 시 CORS 오류

**원인:** Security FilterChain이 CORS preflight(OPTIONS)를 차단

**해결:**
```java
// WebConfig에서 CORS 매핑을 /**로 변경
registry.addMapping("/**").allowedOrigins(...);
// SecurityConfig에서 cors() 활성화
http.cors(Customizer.withDefaults())
```

---

## 2026-03-11 (크롬 익스텐션 본문 삽입)

### [ERR-014] 크롬 익스텐션 - 에디터 본문 영역을 찾지 못함

**증상:** "에디터 본문 영역을 찾지 못했습니다" 알림

**원인:** 셀렉터가 너무 구체적 (`.se-main-container`, `#postViewArea` 등)이어서 SmartEditor ONE 실제 DOM과 불일치

**해결:** `[contenteditable="true"]` 전체 수집 → aria-hidden / 오프스크린(left < -500px, width < 20px) 필터 → 높이 내림차순 정렬 → 가장 큰 영역 = 본문 에디터

---

### [ERR-015] 크롬 익스텐션 - 클립보드 헬퍼 div가 에디터로 오인식

**증상:** SmartEditor ONE의 숨겨진 `<div contenteditable="true" aria-hidden="true" style="left:-9999px; width:17px">` 가 가장 먼저 선택됨

**원인:** aria-hidden 및 오프스크린 요소 필터링 미적용

**해결:** 선택 전 필터 추가
```javascript
// aria-hidden 제외
if (el.getAttribute('aria-hidden') === 'true') continue;
// 오프스크린 요소 제외
const rect = el.getBoundingClientRect();
if (rect.left < -500 || rect.width < 20) continue;
```

---

### [ERR-016] 크롬 익스텐션 - 본문이 마우스 커서 위치에 삽입됨

**증상:** 붙여넣기가 에디터 본문 전체가 아닌 마우스가 마지막으로 클릭한 위치에 삽입됨

**원인:** SmartEditor ONE은 DataTransfer paste 이벤트를 현재 커서(selection) 위치 기준으로 처리. `range.selectNodeContents(el)` 후 paste 이벤트를 dispatching해도 내부 커서가 변경되지 않음

**해결:** 제목 따로 삽입하는 방식을 포기. 제목을 `<h2>` 태그로 본문 상단에 포함시키고, 전체 본문 일괄 삽입. 제목 필드는 사용자가 직접 입력하도록 안내.

---

# FRONTEND

---

## 2026-03-06 (초기 실행)

### [ERR-F001] 프론트엔드 API 연결 실패 (CORS / 주소 미설정)

**증상:** 로컬 실행 시 API 호출 전부 실패

**원인:** `.env` 파일이 없어 `VITE_API_BASE_URL`이 undefined

**해결:** `frontend/.env` 파일 생성
```env
VITE_API_BASE_URL=http://localhost:8080
```

---

## 2026-03-10 (배포)

### [ERR-F002] Vercel 배포 후 API 호출 Network Error

**증상:** 배포 후 모든 API 요청 실패

**원인:** `VITE_API_BASE_URL` 환경변수를 Vercel에 미설정 → undefined로 axios 요청

**해결:**
```bash
vercel env add VITE_API_BASE_URL production
# 값: https://naver-blog-backend.onrender.com
vercel --prod --yes
```

---

## 2026-03-11 (다중 사용자 인증)

### [ERR-F003] 설정 페이지 제거 후 메뉴에 계속 표시됨

**증상:** 코드에서 Settings 라우트를 제거했으나 Vercel에 배포된 버전에는 여전히 표시

**원인:** 코드 변경 후 Vercel 재배포를 하지 않음

**해결:**
```bash
cd frontend
vercel --prod --yes
```

---

### [ERR-F004] 401 응답 후 무한 리디렉션

**증상:** 토큰 만료 시 `/login`으로 리디렉션 되어야 하는데 빈 화면 또는 루프 발생 가능

**원인:** axiosClient 응답 인터셉터에서 localStorage.removeItem 후 `window.location.href = '/login'` 처리 필요

**해결:**
```javascript
// axiosClient.js 응답 인터셉터
if (error.response?.status === 401) {
  localStorage.removeItem('token');
  window.location.href = '/login';
}
```

---
