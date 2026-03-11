# Frontend — 네이버 블로그 AI 초안 생성

React 19 + Vite 7 기반 프론트엔드.

## 실행

```bash
npm install
npm run dev
```

브라우저: `http://localhost:5173`

## 환경변수

`frontend/.env` 파일 생성:

```env
VITE_API_BASE_URL=http://localhost:8080
```

운영 환경에서는 Vercel 환경변수로 설정:
```bash
vercel env add VITE_API_BASE_URL production
# 값: https://naver-blog-backend.onrender.com
```

## 배포

```bash
vercel --prod --yes
```

## 페이지 구성

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/login` | LoginPage | 로그인 (JWT) |
| `/register` | RegisterPage | 회원가입 |
| `/create` | CreatePostPage | 이미지 업로드 + 여행 계획 입력 |
| `/editor/:draftId` | EditorPage | TipTap 에디터 + AI 생성 |
| `/styles` | StyleReferencePage | 스타일 참고 글 관리 |
| `/history` | HistoryPage | 초안 목록 + 삭제 |

## 인증

- 로그인/회원가입 성공 시 JWT를 `localStorage`에 저장
- `axiosClient.js`가 모든 요청에 `Authorization: Bearer <token>` 자동 첨부
- 401 응답 시 토큰 삭제 후 `/login`으로 자동 이동
- 미인증 상태에서 보호 라우트 접근 시 `/login`으로 리디렉션 (`RequireAuth`)
