# fo-web 기업·개인 웹 문서 반영 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 확정된 fo-web 설계(개인 웹 · 기업 웹 · 기업 AI 요금제 · 참고 데이터)를 제품 문서 5개(PRD · feature-spec · feature-map · api-spec · tech-stack)에 반영한다. 코드는 바꾸지 않는다.

**Architecture:** 설계 문서가 원본이다. 각 문서의 해당 장을 고치고, 새 내용은 새 절로 넣는다. 문서끼리 겹치는 내용은 한 곳(feature-spec)에 규칙을 두고 나머지는 링크한다. 문서마다 태스크 하나, 커밋 하나씩 만든다.

**Tech Stack:** Markdown, git, grep

**Spec:** `docs/superpowers/specs/2026-10-21-fo-web-design.md` (이하 "스펙"). 모든 값은 스펙에서 그대로 옮긴다. 태스크마다 스펙의 해당 절을 먼저 연다.

## Global Constraints

- 문서만 바꾼다. `push-fe`, `push-be` 서브모듈과 코드는 건드리지 않는다.
- 작업 브랜치: `docs/fo-web-employer` (develop에서 만든다). 커밋은 scoped Conventional Commit `docs(product): ...`, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 시작 시 `docs/PRD.md`, `docs/api-spec.md`, `docs/feature-spec.md`, `docs/tech-stack.md`, `Makefile`에 이전 세션의 커밋 안 된 변경이 있다. 되돌리지 않는다. Task 1에서 사용자에게 처리 방법을 묻는다.
- 스펙의 표기를 문서에도 쓴다: 사용자가 확정한 것은 표시 없이, 내가 정한 것은 문서 관례대로 그냥 쓰되 값 옆에 "(시작값, 운영하며 조절)"처럼 성격을 밝힌다. 미확정 설계안 절(api-spec 4–5장, PRD 13.2)은 기존처럼 "미확정"을 유지한다.
- 용어: **개인** = 기업이 아닌 일반 사용자 전체(구직자 + 재직자). **기업** = 회사와 그 담당자.
- 개인 요금제: FREE 무료 · PRO $30/월 · ULTRA $100/월, USD, 월간만. 원화 가격과 "연간 -20%"는 모든 문서에서 지운다.
- 기업 요금제: Basic $20 · Pro $100 · Ultra $200, USD, 월간만.
- 모델: FREE DeepSeek 최신 · PRO Sonnet 최신 · ULTRA Opus 최신 / 기업 Basic Sonnet 최신 · Pro Opus 최신 · Ultra Fable 최신. 화면과 데이터에는 모델명 대신 요금제명을 쓴다.
- 데스크톱 관련 문장은 손대지 않는다(작업 순서: 앱 → 웹 → 데스크톱).
- 웹 화면 디자인은 Claude Design "웹" 페이지가 나오면 그 내용이 기준이다. 문서에는 화면 목록과 규칙만 쓰고 레이아웃은 정하지 않는다.
- 문체: 기존 문서와 같은 짧은 평서문("~한다"), 표 위주. 한국어.

## Review Focus

1. 옛 가격 잔존 — `9,900`, `29,000`, `7,900`, `23,200`, `연간` 같은 옛 요금제 문구가 한 문서라도 남으면 독자는 어느 쪽이 맞는지 모른다. 각 태스크 검증 grep과 Task 7 전체 grep으로 막는다.
2. 문서 간 숫자 불일치 — 크레딧(300/5,000/20,000/3,000/15,000/30,000), 초대 인원(Pro 2 · Ultra 5), 프로젝트 개수(5/20/무제한), 알림 종류 수(5)가 문서마다 다르면 구현자가 틀린 쪽을 고른다. Task 7에서 숫자별 grep으로 대조한다.
3. "요금제는 AI에만" 원칙 위반 — 내보내기 · 대화 기록 보관을 요금제로 막는 문장이 남는다. 예외는 기업 담당자 초대 수 하나뿐이다. Task 2·3 검증 grep으로 막는다.
4. 적합도 노출 위치 — 웹 브라우저 공고 상세에 적합도가 남거나, 앱 WebView에서 사라지는 문장. Task 3(3.4절)·Task 4(fo-web 트리) 검증으로 막는다.
5. 회사 단위 소유 누락 — 공고 · 요금제 · 크레딧 · 기업 AI 대화가 "사용자" 소유로 적힌 문장(`company_user_id` 등). Task 5 검증 grep으로 막는다.

---

### Task 1: 브랜치와 스펙 커밋

**Files:**
- Commit: `docs/superpowers/specs/2026-10-21-fo-web-design.md`, `docs/superpowers/plans/2026-10-21-fo-web-docs.md`

- [ ] **Step 1: 커밋 안 된 기존 변경 확인**

Run: `git status --short && git diff --stat`
Expected: `Makefile`, `docs/PRD.md`, `docs/api-spec.md`, `docs/feature-spec.md`, `docs/tech-stack.md`, `push-be`, `push-fe` 변경이 보인다. 사용자에게 "이 변경을 먼저 커밋할지, 이 브랜치로 가져갈지" 묻고 답대로 처리한다. 답 없이 되돌리거나 섞어 커밋하지 않는다.

- [ ] **Step 2: 브랜치 생성**

Run: `git switch -c docs/fo-web-employer`
Expected: `Switched to a new branch 'docs/fo-web-employer'`

- [ ] **Step 3: 커밋**

```bash
git add docs/superpowers/specs/2026-10-21-fo-web-design.md docs/superpowers/plans/2026-10-21-fo-web-docs.md
git commit -m "docs(product): add fo-web employer design and docs plan"
```

---

### Task 2: PRD.md

**Files:**
- Modify: `docs/PRD.md` (1장 표 · 4장 · 5장 · 6장 표 · 7.5 · 7.6 · 7.11 · 7.13 · 9장 · 14장 · 16장, 새 절 7.14 · 7.15)

**Interfaces:**
- Produces: PRD 새 절 번호 `7.14 fo-web 개인 웹 (v2)`, `7.15 fo-web 기업 웹과 기업 AI (v2)`, `7.16 참고 데이터 (v2)`. Task 3·4가 이 번호로 링크한다.

- [ ] **Step 1: 1장 표의 fo-web 행 교체**

새 내용: "fo-mobile의 웹 버전. 개인은 AI 채팅만 뺀 모바일과 같은 Push를 쓴다(일반 채용공고 사이트처럼 탐색 · 북마크 · 지원). 기업은 사업자 확인 후 공고 · 지원자를 관리하고 기업 AI(공고 생성 · 서류 검토 · 면접 준비)를 유료로 쓴다. 채용공고 상세와 허브 프로필 상세는 모바일 앱 WebView에도 띄운다." 마지막 문장 "웹 화면 디자인은 Claude Design에 ..."은 유지한다.

- [ ] **Step 2: 4장 비목표 수정**

- 지운다: "기업 공고 작성 UI (위치는 fo-web 기업 로그인으로 확정, 화면은 이번 범위 밖)"
- "기업 채용 담당자용 ATS 관리 기능" 줄의 단서를 "단, v2에서 기업의 공고 등록, 지원자 단계 변경과 알림, 허브 제안은 지원한다"로 바꾼다.
- "비로그인 열람"을 "모바일 앱 비로그인 열람(fo-web은 공고 목록 · 상세 · 공고 검색을 로그인 없이 연다)"으로 바꾼다.
- 추가(스펙 2장 비목표 그대로): AI 대화 면접 · 인성 면접(추후 Ultra), 다른 채용 플랫폼 · 회사 채용 사이트 연동, 허브 노출 우선순위 판매, 개인 웹의 AI 채팅(과 AI 채팅으로 들어가는 버튼)

- [ ] **Step 3: 5장 대상 사용자**

"기업 회원" 행을 "기업 (v2, 회사 + 담당자)"로 바꾸고 내용: "사업자 확인을 거친 회사의 담당자가 공고를 올리고, 지원자를 관리하고, 허브 프로필에 제안을 보낸다. 기업 AI를 요금제로 쓴다." 표 아래에 용어 한 줄: "개인은 기업이 아닌 사용자 전체(구직자 + 재직자)다."

- [ ] **Step 4: 6장 플랫폼 표**

- 인증: "Google·GitHub OAuth(PKCE), 이메일·비밀번호(이메일 인증). 기업 계정은 Google과 이메일만"
- AI 모델 행 끝에 추가: "관리형 모델은 요금제로 정한다([feature-spec.md](feature-spec.md) 9장)."
- 결제: "Stripe 월 구독(USD). 개인 FREE·PRO·ULTRA, 기업 Basic·Pro·Ultra. 크레딧"

- [ ] **Step 5: 7.13 결제를 개인·기업 요금제로 다시 쓰기**

제목은 그대로 둔다. 본문은 스펙 3장 표(등급 · 가격 · 모델)와 3.1 레버 표(월 크레딧 · 추론 강도 · 작성 방법 · 참고 연차 · 참고 점수)를 옮긴다. 규칙 줄:
- 요금제는 Push AI 사용에만 적용한다. 서류 내보내기와 대화 기록 보관은 모든 요금제에 열려 있다(대화 기록은 사용자가 지울 때까지 보관). 예외: 기업 담당자 초대 수(Pro 2명, Ultra 5명).
- 기업 요금제는 같은 등급의 개인 요금제보다 한 단계 위 모델과 레버를 쓴다.
- 역량 보완 프로젝트: FREE 5개 · PRO 20개 · ULTRA 크레딧 한도 안에서 무제한(동시에 가진 개수).
- 레버 값과 크레딧은 시작값이고 운영하며 조절한다.
- 크레딧은 매월 1일 충전, "충전"으로 추가 구매(기업도 같다).
- 개인은 앱에서 결제한다. 네이티브 인앱 결제(App Store · Google Play)만 되고 가격은 Stripe와 같다. Stripe 개인 상품은 데스크톱용으로 남는다. 구독은 서버에서 하나로 합친다. 웹에서는 개인 요금제를 결제하지 않는다. 기업은 웹에서 Stripe로 결제한다.
상세 규칙은 feature-spec 9장 링크로 넘긴다.

- [ ] **Step 6: 7.5 · 7.6 · 7.11 보정**

- 7.5 적합도 문단 끝에 추가: "적합도 상세는 요금제로 나눈다: FREE 점수만, PRO 항목별 점수와 약점, ULTRA '이렇게 고치면 N점대'까지. 웹 브라우저에서는 계산하지 않고 마이 › 내 활동에서만 점수를 보여준다."
- 7.6 끝에 추가: "모바일 역량 보완 프로젝트 개수는 요금제로 제한한다(7.13)."
- 7.11 알림 종류를 5개로: 기존 4개 + "지원 상태 변경(기업이 단계를 바꿨을 때)". "스위치 4개"를 "스위치 5개"로.

- [ ] **Step 7: 새 절 7.14 · 7.15 · 7.16 추가 (7.13 뒤)**

- 7.14 fo-web 개인 웹: 스펙 6장 요약(포함 · 뺀 것 · 적합도 노출 위치 · 결제 없음).
- 7.15 fo-web 기업 웹과 기업 AI: 스펙 5장(계정 · 사업자 확인 · 회사와 담당자) + 7장(화면 차이, 지원자 관리, 기업 AI 기능 표, 공고 생성 · 서류 검토 · 면접 준비 흐름) 요약. 기능 표는 스펙 7.1 표 그대로.
- 7.16 참고 데이터: 스펙 4장 요약(쓰는 곳, 데이터가 적을 때 구간당 30개 미만은 참고 안 함, 가공 3묶음, 동의 조건, 외부 PDF 처리).
각 절은 10–20줄, 세부 규칙은 feature-spec 새 절(Task 3의 16 · 17 · 18장) 링크.

- [ ] **Step 8: 9장 데이터 모델**

v2 신규에 추가: `Company`(사업자번호 · 상호 · 요금제), `CompanyMember`(관리자 · 담당자), `CompanyInvite`, `ApplicationSnapshot`(지원 시점 서류), `ReferenceSample`(가공한 참고 데이터), `UserConsent`(참고 데이터 동의). `JobPosting` 설명을 "기업 공고(회사 소유)"로.

- [ ] **Step 9: 14장 리스크 추가**

- 참고 데이터에 다른 사용자 서류를 가공해 쓴다. 별도 선택 동의, 철회 시 삭제, 원문 비노출을 지킨다. 출시 전 개인정보 전문가 검토가 필요하다.
- 해외 AI 제공사로 서류를 보낸다(국외 이전 고지). DeepSeek는 OpenRouter 제공사 라우팅으로 미국 호스팅만 쓴다.
- 출시 직후 참고 데이터가 적어 기업 서류 검토가 기준선 없이 동작한다.

- [ ] **Step 10: 16장 미결 정리**

- 지운다: "fo-web의 기업 화면(로그인, 공고 등록·관리)과 구직자 화면 범위", "기업 회원 인증 절차. 사업자 확인을 할지 정해야 한다.", "요금제 크레딧(월 300 / 5,000 / 20,000)을 기존 마이크로크레딧 단위와 맞추는 일" 중 앞의 두 줄. 크레딧 단위 줄은 유지한다.
- "설정의 AI 채팅 항목(... 대화 기록 보관 ...)" 줄에서 "대화 기록 보관"을 뺀다.
- "모바일 결제를 IAP로 할지 Stripe 웹으로 보낼지"를 지운다(모바일은 인앱 결제만으로 확정).

- [ ] **Step 11: 검증**

Run: `grep -nE "9,900|29,000|7,900|23,200|연간|대화 기록 7일|이번 범위 밖\)" docs/PRD.md`
Expected: 출력 없음
Run: `grep -nE "Basic|Fable|지원 상태 변경|7\.14|7\.15|7\.16|구간당 30" docs/PRD.md | wc -l`
Expected: 7 이상

- [ ] **Step 12: 커밋**

```bash
git add docs/PRD.md
git commit -m "docs(product): add employer web and AI plans to PRD"
```

---

### Task 3: feature-spec.md

**Files:**
- Modify: `docs/feature-spec.md` (1장 · 3.4 · 4장 · 9장 · 11장 · 12.3 · 12.4 · 14장, 새 장 16 · 17 · 18)

**Interfaces:**
- Consumes: PRD 7.14 · 7.15 · 7.16 (Task 2)
- Produces: feature-spec `16. fo-web 개인 웹`, `17. fo-web 기업 웹`, `18. 참고 데이터`. 규칙의 원본이다. Task 4·5가 링크한다.

- [ ] **Step 1: 1장 인증**

추가 줄:
- 계정은 개인 · 기업 두 종류이고 따로다. 로그인 화면에서 먼저 고른다. 계정 종류는 `users.is_employer`.
- 가입 방법: 개인 Google · GitHub · 이메일, 기업 Google · 이메일.
- 이메일은 전체에서 하나만 쓴다. 이미 쓰인 이메일이면 "이 이메일은 개인 계정으로 가입되어 있어요"(기업이면 "기업 계정으로")를 보여준다.
- 이메일 인증은 무조건 거친다. 이메일 가입은 인증 메일 링크를 눌러야 계정이 생긴다. OAuth는 제공사가 인증한 이메일만 받는다(GitHub은 `verified`인 기본 이메일만, 없으면 400 `EMAIL_NOT_VERIFIED`). 비밀번호 재설정도 메일로 한다.
- 가입 화면에 참고 데이터 동의 체크박스(선택)가 있다(18장).

- [ ] **Step 2: 3.4 채용공고 상세**

- 적합도 줄 뒤에 추가: "적합도 카드는 앱 WebView에서만 보인다. 웹 브라우저(개인 · 기업)에서는 공고 상세에 적합도가 없다. 구분은 `window.ReactNativeWebView` 유무." "적합도 상세는 요금제로 나눈다(9장)."
- 하단 버튼 뒤에 추가: "웹: 개인 웹은 일반 채용공고 사이트처럼 쓴다. 북마크 · 공유 · 지원하기를 웹 페이지가 직접 그린다. 지원하기는 모바일과 같은 서류 고르기 시트와 `apply`를 쓴다. 'AI로 맞추기'는 없다. 기업은 '이 공고 참고해서 만들기' 하나만 있다. 누르면 기업 AI 채팅이 열리고 이 공고가 첨부 컨텍스트로 들어간다(17장)."

- [ ] **Step 3: 4장 지원 관리**

끝에 추가: "기업이 지원 단계를 바꾸면(서류 통과 → `SCREENING`, 면접 → `INTERVIEW`, 합격 → `OFFER`, 불합격 → `REJECTED`) 지원자의 application 단계가 같이 바뀌고 '지원 상태 변경' 알림이 간다. 모바일 지원활동은 여전히 읽기 전용이다."

- [ ] **Step 4: 9장 결제 다시 쓰기**

- 지운다: "월간/연간을 고를 수 있고 연간은 20% 싸다", 옛 요금제 표, "요금제가 기능을 막는다: ..." 줄, "모바일: ... 결제 방식(IAP / Stripe 웹)은 미결이다"의 원화 관련 내용.
- 넣는다: 스펙 3장 요금제 표, 3.1 레버 표(시작값), 3.2 개인 요금제 변경 5줄(내보내기 개방, 대화 기록 보관 무기한, 프로젝트 5/20/무제한, 적합도 상세 차등, 면접 준비 깊이 차등), 기업 크레딧 규칙(개인과 같은 원장 구조, 회사 단위 잔액, 충전 가능), Stripe 상품 메타데이터(개인 `metadata.plan=PRO|ULTRA`, 기업 `metadata.audience=EMPLOYER` + `metadata.plan=BASIC|PRO|ULTRA`), 추론 강도 값 `LOW | MEDIUM | HIGH | MAX`.
- 넣는다(스펙 6.2): 모바일 결제는 인앱 결제만(앱에서 Stripe 안 엶), Stripe와 같은 가격, 활성 구독 하나, 데스크톱 Stripe 구독자 중복 문구 "이미 카드로 구독 중이에요", 충전은 소모성 인앱 상품, 해지는 결제한 곳에서, 스토어 알림(App Store Server Notifications V2 · Google Play RTDN)도 같은 원장에 기록.
- 유지: 크레딧 마이크로크레딧 단위 미결, BYOK, 사용량 조회, 설정 언어·테마.

- [ ] **Step 5: 11장 소셜**

추가: "기업 계정도 글과 댓글을 쓴다. 작성자는 회사명 + 기업 배지로만 보여주고 담당자 이름은 보이지 않는다."

- [ ] **Step 6: 12.3 설정 · 12.4 알림**

- 12.3 알림 스위치에 "지원 상태 변경" 추가. AI 채팅 묶음에서 "대화 기록 보관 기간(요금제 한도 안에서 고른다. FREE 7일, ULTRA 무제한)"을 지운다(대화 기록은 사용자가 지울 때까지 보관).
- 12.4 표에 행 추가: `지원 상태 변경 | 기업이 내 지원의 단계를 바꿨을 때 | 마이 › 내 활동 › 지원활동`. "위 4종류"를 "위 5종류"로.

- [ ] **Step 7: 14장 브리지**

마지막 문단 뒤에 추가: "fo-web은 같은 페이지를 웹 브라우저에서도 연다. `window.ReactNativeWebView`가 없으면 웹 모드다: 적합도 카드를 그리지 않고, 하단 버튼을 웹에서 직접 그린다(3.4)."

- [ ] **Step 8: 새 장 16 · 17 · 18 추가 (15장 뒤)**

- `## 16. fo-web 개인 웹 [fo-web]`: 스펙 6장 전체(비로그인 공개 범위 — 공고 목록 · 상세 · 공고 검색만, 허브 · 소셜은 로그인 필요, 북마크 · 지원 시 로그인 후 원래 공고로 복귀, 포함 화면, 뺀 것, 서류 가져오기는 파일 업로드만, 적합도는 마이 › 내 활동에서만 점수만 · 누를 수 없음, 개인 결제 없음).
- `## 17. fo-web 기업 웹 [fo-web]`: 스펙 5.1 사업자 확인(국세청 `validate` · `status` 흐름, `valid=01`, `b_stt_cd=01`만 통과, 상호는 `b_nm`, 신규 개업자 안내 문구 "개업 직후라면 1–2일 뒤 다시 시도해 주세요", 통과 전에는 공고 등록 · 기업 AI 막음), 5.2 회사와 담당자(관리자 · 담당자 권한, 초대 Pro 2 · Ultra 5 · Basic 없음, 한도 초과 시 새 초대만 막음), 7장 화면 차이(허브 프로필 없음, 소셜 기업 배지, 기업용 마이), 7.0 지원자 관리, 7.1 기업 AI(기능 표, 세 흐름, 웹 검색은 `web_search=True`, 외부 PDF는 대화에만 붙고 대화 삭제 시 함께 삭제 · 참고 풀 제외, 최종 판단은 담당자).
- `## 18. 참고 데이터 [공통]`: 스펙 4장 전체(쓰는 곳 표, 4.0 구간당 30개, 4.1 가공 3묶음과 문장 구조 예시 `{대상}의 {문제}를 {기술}로 해결해 {지표}를 {수치}% 개선했다`, 공고맞춤 점수에 요금제명 기록, 4.2 동의 문구 "내 서류와 평가 결과를 가공해 다른 사용자와 기업의 AI가 참고 자료로 써요", 철회 시 삭제, 원문 비노출, 국외 이전 고지).

- [ ] **Step 9: 검증**

Run: `grep -nE "9,900|29,000|7,900|23,200|연간|FREE 7일|요금제가 기능을 막는다" docs/feature-spec.md`
Expected: 출력 없음
Run: `grep -cE "^## 1[678]\. " docs/feature-spec.md`
Expected: `3`
Run: `grep -n "지원 상태 변경" docs/feature-spec.md | wc -l`
Expected: 3 이상 (4장 · 12.3 · 12.4)

- [ ] **Step 10: 커밋**

```bash
git add docs/feature-spec.md
git commit -m "docs(product): specify fo-web personal and employer rules"
```

---

### Task 4: feature-map.md

**Files:**
- Modify: `docs/feature-map.md` (1장 표, 4장)

**Interfaces:**
- Consumes: feature-spec 16 · 17 · 18장 (Task 3)

- [ ] **Step 1: 1장 표의 fo-web 열 채우기**

개인 웹에 있는 행은 `●`(AI 채팅 · 내 공고 추가 · AI 관련 행 제외), 로그인 행은 "(토큰 주입)" 대신 `●`. "로그인 (Google·GitHub)"을 "로그인 (Google·GitHub·이메일)"으로. 행 추가(fo-web만 `●`): 사업자 확인, 담당자 관리, 지원자 관리(단계 · 알림), 기업 AI(공고 생성 · 서류 검토 · 면접 준비), 기업 요금제. API 열은 Task 5의 경로를 쓴다.

- [ ] **Step 2: 4장 fo-web 다시 쓰기**

제목 "## 4. fo-web — 개인·기업 웹"으로. 첫 문단은 PRD 1장과 같은 설명. 기존 WebView 라우트 표(`/postings/:id`, `/profiles/:id`)는 유지하고 "웹 브라우저에서는 적합도 카드 없음"을 `/postings/:id` 행에 덧붙인다. "읽기 전용 페이지이고 버튼이 없다"는 "앱 WebView에서는 버튼이 없다. 웹 브라우저에서는 하단 버튼을 웹이 그린다"로. 그 아래 3.x 모바일 트리 형식으로 두 트리:
- `### 4.1 개인 웹`: 로그인(개인/기업 선택) · 홈 · 채용공고 페이지 · 통합 검색 · 채용공고 상세(지원하기) · 허브 · 허브 프로필 상세 · 소셜 · 마이(프로필 · 서류 · 내 활동(적합도 점수)) · 제안함 · 1:1 메시지 · 알림함 · 설정
- `### 4.2 기업 웹`: 로그인 → 사업자 확인 · 개인 웹과 같은 탐색 화면(허브 프로필 없음) · 채용공고 상세(이 공고 참고해서 만들기 → 기업 AI 채팅) · 기업 AI 채팅 · 내 공고 관리 · 지원자 목록 › 지원자 서류(단계 변경) · 소셜(기업 배지) · 마이(회사 정보 · 담당자 관리 · 기업 요금제 · 북마크 · 팔로우 · 게시글)
라우트 이름은 정하지 않는다("Claude Design 웹 페이지 기준으로 정한다").

- [ ] **Step 3: 검증**

Run: `grep -nE "### 4\.1 개인 웹|### 4\.2 기업 웹|사업자 확인|이 공고 참고해서 만들기" docs/feature-map.md | wc -l`
Expected: 4 이상
Run: `grep -n "토큰 주입" docs/feature-map.md`
Expected: 출력 없음

- [ ] **Step 4: 커밋**

```bash
git add docs/feature-map.md
git commit -m "docs(product): map fo-web personal and employer screens"
```

---

### Task 5: api-spec.md

**Files:**
- Modify: `docs/api-spec.md` (2.2 · 3.2 · 3.15 · 4장 새 절 · 4.5 · 5장 · 6장)

**Interfaces:**
- Consumes: feature-spec 1 · 9 · 17 · 18장 (Task 3)
- Produces: 아래 경로 이름. Task 4 표가 이 이름을 쓴다. 모두 4장 "미확정 설계안" 아래에 둔다.

- [ ] **Step 1: 2.2 공개 경로와 3.2 auth**

공개 경로에 `POST /auth/email/signup|verify|login|password-reset|password-reset/confirm`, `GET /postings`, `GET /postings/locations`, `GET /postings/{id}` 추가(토큰 없으면 `bookmarked`·`applied`는 `false`, `GET /search`는 토큰 없으면 공고 탭 결과만). 3.2 표에 같은 경로 5개 행 추가(요청: `email*`, `password*`, `accountType*`(`PERSONAL|EMPLOYER`), `consentReference`(bool) / `token*` / ...; 응답: signup 202, verify·login은 `Session`). `GET /auth/{google|github}/start`에 `accountType*` 쿼리 추가, GitHub은 `EMPLOYER`면 400 `VALIDATION_ERROR`. 이메일 충돌은 409 `EMAIL_TAKEN`(`details.accountType`). 인증 전 로그인은 403 `EMAIL_NOT_VERIFIED`. OAuth 제공사 이메일이 인증되지 않았으면 400 `EMAIL_NOT_VERIFIED`. 3.2 제목 옆에 "(이메일 가입은 v2 미확정)" 표기.

- [ ] **Step 2: 3.15 billing**

- `GET /billing` 응답에 `audience`(`PERSONAL|EMPLOYER`) 추가. 기업이면 회사 기준 값.
- `POST /billing/checkout` `planId*`: 개인 `PRO|ULTRA`, 기업 `BASIC|PRO|ULTRA`. 월간만. 기업은 관리자만(아니면 403).
- `POST /billing/topup`(충전) 행 추가.
- `GET /billing` 응답에 `source`(`STRIPE|APP_STORE|GOOGLE_PLAY`) 추가. 행 추가: `POST /billing/iap/verify` 🔑(`platform*`, `receipt*`/`purchaseToken*` → 구독 반영, 다른 수단으로 구독 중이면 409 `ALREADY_SUBSCRIBED`), `POST /billing/webhook/app-store`, `POST /billing/webhook/google-play`(공개, 서명 검증). 2.2 공개 경로에도 두 웹훅을 넣는다.

- [ ] **Step 3: 4장 새 절**

- `### 4.6 회사와 담당자`: `POST /companies/verify`(`bNo*`, `startDt*`, `pNm*`, `bNm*` → 국세청 `validate`+`status`, 실패 422 `BUSINESS_NOT_VERIFIED`, 이미 등록된 사업자번호 409 `COMPANY_EXISTS`), `GET /companies/me`, `GET /companies/me/members`, `POST /companies/me/invites`(`email*`, 한도 초과 403 `SEAT_LIMIT`), `POST /companies/invites/{token}/accept`, `DELETE /companies/me/members/{userId}`. 관리자 전용 표시.
- `### 4.7 지원자 관리`: `GET /postings/{id}/applicants`(회사 소유 공고만), `GET /postings/{id}/applicants/{applicationId}`(스냅샷 서류 포함), `PATCH /postings/{id}/applicants/{applicationId}`(`stage*`: `SCREENING|INTERVIEW|OFFER|REJECTED` → 지원자 application 단계 변경 + `APPLICATION_STAGE` 알림).
- `### 4.8 기업 AI`: 기업 AI 대화를 기존 `/conversations`에 얹을지 별도로 둘지는 구현 시 정한다(스펙 10장). 계약으로 정할 것만 쓴다: 대화는 회사 소유, 첨부 `postingId`, Ultra만 PDF 업로드, 요금제 잠금은 403 `PLAN_REQUIRED`(`details.requiredPlan`).
- `### 4.9 참고 데이터 동의`: `GET|PUT /me/consents`(`referenceData` bool). 끄면 그 사용자 `reference_samples` 삭제.
- 4.1 `POST /postings`: "`users.is_employer`가 아니면 403"을 "사업자 확인된 회사의 담당자가 아니면 403"으로. `POST /postings/{id}/apply`: "지원 시점 서류를 `application_snapshots`에 복사한다" 추가.

- [ ] **Step 4: 4.5 라우팅**

core 경로 목록에 `/companies*`, `/me/consents`, `/auth/email/*` 추가.

- [ ] **Step 5: 5장 DB**

표에 추가: `companies`(`id, b_no unique, name, verified_at, plan, stripe_customer_id, created_at`), `company_members`(`(company_id, user_id) pk, role check(ADMIN, MEMBER), created_at`), `company_invites`(`id, company_id, email, token, expires_at, accepted_at`), `application_snapshots`(`application_id, document_id, content, created_at`), `reference_samples`(`id, source_user_id, job_category, tenure_years, fit_score, part_scores jsonb, plan check(FREE, PRO, ULTRA), features jsonb, sentence_templates jsonb, created_at`), `user_consents`(`user_id pk, reference_data bool, updated_at`). `users`에 `password_hash`, `email_verified_at` 추가. `job_postings.company_user_id`를 `company_id`로 바꾼다고 표기. 마이그레이션 파일 이름은 정하지 않는다.

- [ ] **Step 6: 6장 알려진 차이**

- 마지막 billing 줄을 새 내용으로: "`POST /billing/checkout`에 기업 요금제(BASIC)와 audience가 없다. 충전, 요금제 낮추기, 매월 1일 충전, 요금제별 AI 레버 적용이 없다. 크레딧을 마이크로크레딧 단위와 맞추는 일은 미결이다."
- 추가: "gateway `services/gateway/src/models.ts`의 `EFFORTS`에 `MAX`가 없다(ai · core에는 있다)."
- 추가: "`POST /postings/{id}/apply`는 `documentIds`를 `application_events.payload`에만 남긴다. 스냅샷이 없다."

- [ ] **Step 7: 검증**

Run: `grep -nE "/companies/verify|/postings/\{id\}/applicants|/me/consents|/auth/email/signup|reference_samples|SEAT_LIMIT|PLAN_REQUIRED" docs/api-spec.md | wc -l`
Expected: 7 이상
Run: `grep -n "company_user_id" docs/api-spec.md`
Expected: `company_id`로 바꾼다는 표기가 있는 줄만 나온다

- [ ] **Step 8: 커밋**

```bash
git add docs/api-spec.md
git commit -m "docs(api): draft employer, applicant, consent and email auth endpoints"
```

---

### Task 6: tech-stack.md

**Files:**
- Modify: `docs/tech-stack.md` (2.5 · 3장)

- [ ] **Step 1: 2.5 fo-web**

기존 문장 뒤에 추가: "앱 WebView 페이지와 개인 · 기업 웹을 함께 서빙한다. 웹 로그인은 이메일 · OAuth를 직접 처리한다(WebView는 토큰 주입). 기업 결제는 Stripe Checkout으로 보낸다."

- [ ] **Step 2: 3장 백엔드 표**

- LLM 행에 추가: "요금제별 관리형 모델(DeepSeek · Sonnet · Opus · Fable 최신), 추론 강도 `LOW|MEDIUM|HIGH|MAX`, 웹 검색은 OpenRouter `:online`, DeepSeek는 제공사 라우팅으로 미국 호스팅만"
- 행 추가: "인앱 결제 | App Store · Google Play 구독(서버 검증 · 스토어 알림). 클라이언트 라이브러리는 구현 시 정한다"
- 행 추가: "메일 | 이메일 인증 · 비밀번호 재설정 · 담당자 초대 (Cloudflare Email Service)", "사업자 확인 | 국세청 사업자등록정보 진위확인 및 상태조회 API(공공데이터포털)"

- [ ] **Step 3: 검증**

Run: `grep -nE "Fable|:online|국세청|Email Service|인앱 결제" docs/tech-stack.md | wc -l`
Expected: 5 이상

- [ ] **Step 4: 커밋**

```bash
git add docs/tech-stack.md
git commit -m "docs(stack): add employer web, plan models and verification services"
```

---

### Task 7: 문서 간 일관성 점검

**Files:**
- Read: `docs/PRD.md`, `docs/feature-spec.md`, `docs/feature-map.md`, `docs/api-spec.md`, `docs/tech-stack.md`

- [ ] **Step 1: 옛 요금제 잔존 확인**

Run: `grep -nE "9,900|29,000|7,900|23,200|연간|FREE 7일|대화 기록 7일" docs/*.md`
Expected: 출력 없음

- [ ] **Step 2: 숫자 대조**

Run: `grep -nE "3,000|15,000|30,000|5,000|20,000" docs/PRD.md docs/feature-spec.md`
Expected: 두 문서의 레버 표 값이 스펙 3.1과 같다(FREE 300 · PRO 5,000 · ULTRA 20,000 · Basic 3,000 · Pro 15,000 · Ultra 30,000).
Run: `grep -nE "2명|5명|5개|20개|5종류|스위치 5" docs/PRD.md docs/feature-spec.md`
Expected: 초대 Pro 2명 · Ultra 5명, 프로젝트 5개 · 20개, 알림 5종류가 두 문서에서 같다.

- [ ] **Step 2b: 결제 미결 잔존 확인**

Run: `grep -nE "IAP.*미결|IAP\) 할지|IAP로 할지|결제 방식\(IAP / Stripe 웹\)은 미결" docs/*.md`
Expected: 출력 없음

- [ ] **Step 3: 원칙 위반 확인**

Run: `grep -nE "요금제.*(내보내기|보관).*막|내보내기.*PRO" docs/*.md`
Expected: 출력 없음

- [ ] **Step 4: 링크 확인**

Run: `grep -noE "\]\([a-z-]+\.md\)" docs/PRD.md docs/feature-spec.md docs/feature-map.md | sort -u`
Expected: 가리키는 파일이 모두 `docs/`에 있다. 새로 쓴 "7.14 · 7.15 · 7.16", "16 · 17 · 18장" 참조가 실제 절 번호와 맞는다.

- [ ] **Step 5: 고칠 것이 있으면 고치고 커밋**

```bash
git add docs/
git commit -m "docs(product): align fo-web numbers across docs"
```
고칠 것이 없으면 커밋하지 않는다.

- [ ] **Step 6: 사용자에게 보고**

바뀐 문서와 커밋 목록(`git log --oneline develop..`)을 보여준다. push와 PR은 사용자가 요청할 때만 한다.
