# Push 기능 맵

- 버전: 2.0
- 작성일: 2026-10-20
- 상태: 초안
- 관련 문서: [PRD.md](PRD.md), [feature-spec.md](feature-spec.md), [api-spec.md](api-spec.md)

클라이언트별로 화면이 어떻게 이어지는지 정리한다. 기능 규칙은 [feature-spec.md](feature-spec.md)에 있다.

## 1. 기능 × 클라이언트

| 기능 | 데스크톱 | 모바일 | fo-web | 주요 API |
|---|:-:|:-:|:-:|---|
| 로그인 (Google·GitHub) | ● | ● | (토큰 주입) | `/auth/*` |
| AI 채팅 (단계 게이트 이력서) | ● | ● | | `/conversations`, `/approvals` |
| 내 공고 추가 (링크·텍스트) | ● | ● | | `/jobs` |
| 공고 DOM 수집 (내장 브라우저) | ● | | | `/jobs` (`sourceKind: DOM`) |
| 공고 분석 (갭 분석) | ● | | | `/jobs/{id}/analyze` |
| 공고 검색 (내 공고 + 기업 공고) | | ● | | `/postings` |
| 채용공고 상세 | ● (`/jobs/:id`) | ● (WebView) | ● | `/postings/...` (백엔드 미확정) |
| 북마크 (기업 공고) | | ● | | `/postings/posted/{id}/bookmark` |
| 지원 관리 (단계·타임라인·제출) | ● | 보기 | | `/applications` |
| 지원 기록 (기업 공고) | | ● | | `/postings/posted/{id}/apply` |
| Career Vault (추후) | ● | | | `/career-evidence` |
| 이력서 파일 등록 | ● | ● | | `/sources` |
| 문서 작업실 (편집·확정·출력) | ● | | | `/documents` |
| 역량 보완 프로젝트 (CLI) | ● | | | `/projects` |
| 면접 준비 (추후) | ● | | | `/interviews` |
| 캘린더 · Google 연동 | ● | | | `/calendar`, `/integrations/google` |
| 허브 (프로필·팔로우·제안) | | ● | ● (상세) | `/profiles`, `/users`, `/me/profile` |
| 소셜 (게시물·댓글·이미지) | | ● | | `/posts`, `/uploads/images` |
| 결제 · AI 키 · 설정 | ● | | | `/billing`, `/ai/keys` |

## 2. 데스크톱 (fo-desktop, 기존)

```
로그인 (/login) ─ OAuth ─ /auth/callback
앱 셸 (좌측 사이드바: 기능 / 채팅 / 프로젝트)
├─ 홈 (/) ─ AI 명령창, 새 대화
├─ 채팅 (/chat/:id) ─ 스트리밍, 승인 카드, 문서 카드
├─ 기능
│  ├─ 지원 현황 (/applications) ─ 단계, 타임라인, 제출
│  │  └─ 공고 상세 (/jobs/:id) ─ 요구사항, 갭 분석
│  ├─ 내 서류 (/documents) ─ 문서 편집기 (/documents/:id): TipTap, AI 버블, 확정, PDF/DOCX
│  ├─ 캘린더 (/calendar) ─ Google 연동 (/integrations/google/callback)
│  └─ 면접 준비 (/interview) — 추후
├─ Career Vault (/vault) — 추후
└─ 설정 (/settings) ─ 요금제 (/settings/plan), AI 키, 언어·테마
```

## 3. 모바일 (fo-mobile, 신규)

```
앱 시작
├─ 로그인 (모달) ─ Google / GitHub OAuth (PKCE, push://auth/callback)
└─ 탭 (NativeTabs)
   ├─ 홈
   │  ├─ 헤더: Push. · 알림함 글래스 버튼(안 읽음 배지) → 알림함
   │  ├─ 인사말 · AI 이력서 적합도 카드 → AI 이력서
   │  ├─ 검색 (Stack.SearchBar)
   │  ├─ 필터 칩 줄: 전체 · 직군 · 경력 · 지역 · 고용형태 · 출처(전체/내 공고/기업 공고)
   │  ├─ 새로 올라온 공고 · 이번 주 많이 본 공고 (적합도 배지)
   │  ├─ + 공고 추가 (링크 / 텍스트) ─ 서버가 읽는 동안 진행 상태 표시
   │  └─ 채용공고 상세 [WebView: fo-web /postings/:id]
   │     ├─ 툴바: 북마크 · 공유 (글래스 캡슐)
   │     ├─ 본문: 내 적합도 카드 · 하는 일 · 자격 요건 · 우대 사항
   │     └─ 하단: AI로 맞추기 → AI 이력서 · 지원하기
   ├─ 허브
   │  ├─ 검색
   │  ├─ 직군 토글 칩: 개발 · 디자인 · 기획 · 마케팅 · 데이터 · 영업
   │  ├─ 필터: 재직 기간 · 커리어 상태(만족 / 이직·구직중 / 프로필 피드백) · 탐색(추천 / 제안)
   │  ├─ 추천 프로필 리스트
   │  ├─ 필터 시트: 초기화 · 프로필 N개 보기
   │  └─ 허브 프로필 상세 [WebView: fo-web /profiles/:id] ─ 소개 · 경력 타임라인 · 기술 스택
   │     └─ 툴바: 팔로우 · 공유 · 제안하기 → 제안 글래스 시트 (500자)
   ├─ 소셜
   │  ├─ 카테고리: 전체 · 직장 생활 · 개발 · 일상 · 커리어 · 소통 · 커피챗 · 마케팅·광고
   │  ├─ 게시물 무한 리스트
   │  ├─ 글쓰기 (form sheet "새 글"): 카테고리 · 제목 · 본문 · 이미지(최대 4)
   │  └─ 게시물 상세 (네이티브): 본문 · 이미지 · 댓글 · 답글 달기 · 댓글 입력창
   ├─ AI 이력서
   │  ├─ 빈 상태: 빠른 시작 4개 · 최근 대화 · 바로가기
   │  ├─ 대화 목록 (데스크톱과 공유)
   │  └─ 대화: 상태 줄 · 도구/결과 줄 · 할 일 · diff · 1·2·3 승인 패널 · @언급 · 중단
   └─ 마이
      ├─ 헤더: 제안함 글래스 버튼(배지) → 제안함(받은/보낸) → 제안 상세(거절 · 수락하고 답장하기)
      ├─ 헤더: 설정 톱니바퀴 → 설정(계정 · 알림 · 허브 공개 · AI 이력서 · 기타)
      ├─ [세그먼트] 프로필 ─ 허브 프로필과 같은 화면 · 섹션별 편집 버튼 → 섹션 편집 시트
      ├─ [세그먼트] 이력서 ─ 파일 목록 · 파일 등록(PDF/DOCX) · 빈 상태(AI로 만들기)
      └─ [세그먼트] 내 활동
         ├─ 지원활동 ─ 배지: 지원함 · 서류 · 면접 · 합격 · 불합격
         ├─ 북마크 → 채용공고 상세
         ├─ 팔로우 → 허브 프로필 상세
         └─ 게시글 → 게시물 상세

```

### 3.1 라우트 파일 (`apps/fo-mobile/src/app/`)

| 화면 | 파일 | 렌더링 |
|---|---|---|
| 루트 | `_layout.tsx` (Stack, 세션 게이트) | 네이티브 |
| 로그인 | `sign-in.tsx` (modal) | 네이티브 |
| 탭 바 | `(tabs)/_layout.tsx` | NativeTabs |
| 탭별 스택 | `(tabs)/(home,hub,social,chat,my)/_layout.tsx` | Stack |
| 홈 | `(tabs)/(home)/index.tsx` → `screens/home-screen.{ios,android}.tsx` | 네이티브 |
| 허브 | `(tabs)/(hub)/hub.tsx` → `screens/hub-screen.{ios,android}.tsx` | 네이티브 |
| 소셜 | `(tabs)/(social)/social.tsx` → `screens/social-screen.{ios,android}.tsx` | 네이티브 |
| 글쓰기 | `(tabs)/(social)/compose.tsx` | form sheet |
| 게시물 상세 | `(tabs)/(social)/posts/[id].tsx` | 네이티브 |
| AI 이력서 | `(tabs)/(chat)/chat.tsx` | 네이티브 |
| 마이 | `(tabs)/(my)/my.tsx` → `screens/my-screen.{ios,android}.tsx` | 네이티브 |
| 프로필 섹션 편집 | `(tabs)/(my)/edit-profile/[section].tsx` (`basic \| intro \| career \| skills`) | form sheet |
| 채용공고 상세 | `(tabs)/(home,hub,social,chat,my)/postings/[id].tsx` | WebView |
| 허브 프로필 상세 | `(tabs)/(home,hub,social,chat,my)/profiles/[id].tsx` | WebView |

공고 상세와 프로필 상세는 shared route다. 마이 탭의 북마크나 팔로우에서 열어도 탭을 바꾸지 않고 현재 탭 안에서 열린다.

## 4. fo-web (신규)

| 라우트 | 내용 | 호출 |
|---|---|---|
| `/postings/:id` | 회사 헤더, 직무 설명, 자격 요건, 우대 사항, 근무 조건, 출처 | 공고 상세 API (백엔드 미확정) |
| `/profiles/:id` | 프로필 헤더, 소개, 커리어 상태, 경력 타임라인, 기술 스택 | `GET /profiles/{id}` |

읽기 전용 페이지이고 버튼이 없다. 버튼은 네이티브 헤더와 툴바가 맡는다.
