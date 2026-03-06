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

## 2026-03-06 (QA 세션 - AI 생성 및 자동 발행)

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

### [ERR-011] AES-256 암호화 실패 - "암호화 실패" 오류

**발생 위치:** `backend/.../util/EncryptionUtil.java`

**원인:**
AES 키 길이는 16/24/32 bytes여야 하는데, 설정된 암호화 키가 30자라 패딩 후에도 잘못된 크기

**해결:**
```java
// 변경 전: 16바이트로 패딩
private byte[] getPaddedKey(String key) { /* pad to 16 */ }

// 변경 후: 항상 32바이트로 패딩 (AES-256)
private byte[] getPaddedKey(String key) {
    byte[] keyBytes = new byte[32];
    byte[] src = key.getBytes(StandardCharsets.UTF_8);
    System.arraycopy(src, 0, keyBytes, 0, Math.min(src.length, 32));
    return keyBytes;
}
```

---

### [ERR-012] Selenium - 네이버 로그인 캡차 / 봇 감지

**증상:** 로그인 시 `WAITING_CAPTCHA` 상태에서 타임아웃

**원인:** Headless Chrome이 네이버 봇 감지 시스템에 감지됨

**해결:**
- `--headless=new` 옵션 제거 → 실제 브라우저 창으로 실행
- `navigator.webdriver` 감지 우회 JS 주입
- `excludeSwitches: ["enable-automation"]` 옵션 추가
- 캡차 발생 시 상태를 `WAITING_CAPTCHA`로 설정, 사용자가 직접 해결 가능

---

### [ERR-013] Selenium - 발행 버튼 클릭 불가 (element not interactable)

**증상:** 발행 버튼을 찾았으나 `ElementNotInteractableException` 발생

**원인:** 버튼 위에 오버레이 또는 다른 요소가 덮고 있어 일반 click() 불가

**해결:** JavascriptExecutor로 JS click 사용
```java
((JavascriptExecutor) driver).executeScript("arguments[0].click();", publishBtn);
```

---

### [ERR-014] Selenium - 로그인 후 URL이 nidlogin에서 변경되지 않음

**증상:** 로그인 버튼 클릭 후 URL이 계속 nidlogin 페이지에 머묾

**원인:** 캡차/2FA 처리 시간을 기다리지 않고 바로 URL 체크

**해결:** `waitForLoginComplete()` 메서드 추가 - 최대 3분간 URL 변경 대기
```java
private String waitForLoginComplete(WebDriver driver, Long draftId, int timeoutSeconds)
```

---

### [ERR-015] Selenium - "예약 발행 글" 모달 오픈 (잘못된 버튼 클릭)

**증상:** 발행 시 "예약 발행 글이 없습니다" 모달 팝업

**원인:** XPath `//button[contains(text(),'발행')]`이 툴바의 "예약발행 현황" 버튼을 먼저 매칭

**해결:**
- `"예약"` 포함 버튼 명시적 제외 필터 추가
- JS로 `innerText.trim() === '발행'` 정확 매칭 우선 적용
- `defaultContent()`로 전환 후 탐색

---

### [ERR-016] Selenium - 발행 설정 패널의 확인 버튼을 찾지 못함

**증상:** 발행 설정 패널이 열렸으나 15초 대기 후 `WARN: 발행하기 버튼을 찾지 못함`

**원인:**
패널 내 확인 버튼의 텍스트가 "발행하기"가 아니라 **"발행"** 임을 모름
(로그에서 버튼 목록을 찍어 확인: `"발행 설정 닫기"` 이후에 오는 `"발행"` 버튼이 확인 버튼)

**버튼 목록 (실제 로그):**
```
"예약 발행 0건", "저장", "발행"(툴바), ..., "발행 설정 닫기", "발행"(확인)
```

**해결:**
```javascript
// "발행 설정 닫기" 이후에 오는 "발행" 버튼 찾기
var closeIdx = btns.findIndex(b => b.innerText.includes('발행 설정 닫기'));
for (var i = closeIdx + 1; i < btns.length; i++) {
    if (btns[i].innerText.trim() === '발행') return btns[i];
}
```

---

### [ERR-017] Maven 빌드 실패 - Java 버전 불일치

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

## 2026-03-06 (QA 세션)

### [ERR-F002] 글 작성 POST 요청 시 category 필드 누락

**증상:** 드래프트 생성 API 호출 시 500 에러 (ERR-007과 연계)

**원인:** 프론트 UI에 카테고리 선택 기능 없어 요청 body에 `category` 필드 미포함

**해결 (임시):** 백엔드에서 null이면 `"여행"` 기본값 처리 (ERR-007 참조)

---

### [ERR-F003] 발행 히스토리 "네이버 블로그에서 보기" 클릭 시 편집 창으로 이동

**증상:** 발행 완료 후 저장된 URL이 `postwrite` URL이어서 블로그 글이 아닌 편집 페이지로 연결

**원인:**
Selenium 발행 프로세스가 완료되지 않아 URL이 변경되지 않은 상태(`postwrite`)로 DB에 저장됨.
실제 발행 확인 버튼("발행")이 클릭되지 않았기 때문 (ERR-016 참조)

**해결 중:** ERR-016 해결 후 정상 발행 URL 저장 예정

---
