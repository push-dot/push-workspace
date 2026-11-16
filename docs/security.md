# Push 보안 규칙

- 버전: 1.0
- 작성일: 2026-11-17
- 상태: 초안
- 적용 범위: push-be(gateway, core-api, services/ai), push-fe(fo-web, fo-mobile, api-client). 데스크톱은 다루지 않는다.
- 관련 문서: [tech-stack.md](tech-stack.md), [api-spec.md](api-spec.md), [design-rules.md](design-rules.md)

코드를 새로 쓰거나 고칠 때 따르는 보안 규칙이다. 2026-11-17 보안 점검에서 찾은 결함과 그 수정에서 나왔다. 규칙마다 코드 위치와 증거 테스트를 붙였다. 이 문서는 개발자가 지킬 규칙만 적는다. 점검 결과와 남은 위험은 push-design 작업 폴더의 `coverage/SECURITY-REPORT-2026-11-17.md`에 있다.

규칙을 어겨야 하는 사정이 생기면 코드에 이유를 한 줄 남기고 PR에 적는다.

## 1. 믿는 것과 믿지 않는 것

| 믿지 않는다 (공격자가 쓸 수 있다) | 믿는다 (서버가 정한다) |
|---|---|
| 웹 페이지, 업로드한 서류, 다른 사용자의 글·제안 메시지·프로필, 지원자 서류, 공고 본문, 도구 결과, 대화 요약 | 인증한 사용자 id와 회사 id, 요금제, 동의 여부, 접근 모드 |
| 모델이 만든 도구 인자, URL, 답변 글 | 승인 카드의 내용과 승인 기록 |
| 경로·쿼리·본문·헤더 전부, 딥링크, WebView 안의 주소 | gateway가 검증해서 붙인 act-as 헤더 |

모델의 출력은 믿지 않는 쪽이다. 믿지 않는 글을 읽은 모델은 그 글이 시킨 일을 할 수 있기 때문이다.

## 2. 믿지 않는 글은 자료로만 쓴다

- 모델 문맥에 들어가는 믿지 않는 글은 `framework/untrusted.py`의 `as_data(text, source)`를 거친다. 글을 `<data source="…">` 블록으로 감싸고, 안의 `<data` 태그는 전각 꺾쇠(`＜`)로 바꿔 블록을 닫거나 열 수 없게 하고, 20,000자로 자른다.
- 시스템 프롬프트에 `DATA_RULE`이 들어 있어야 한다. 새 프롬프트를 만들 때도 넣는다.
- 믿지 않는 글은 `system` 역할 메시지에 넣지 않는다. 다른 사용자의 서류에서 뽑은 문장 템플릿, 대화 요약도 같다. 요약은 도구 결과가 섞이므로 자료로 감싼다.
- 새 도구를 만들면 결과를 믿지 않는 글로 본다. `harness/policy.py`의 `TRUSTED_READS`(본인 프로필, 본인 회사, 지원자 수, 본인 회사 공고 목록)에 있는 읽기만 예외다. 목록에 넣으려면 "이 결과에는 사용자나 본인 회사가 쓴 글만 들어 있다"를 보여야 한다.
- 구조화 출력(적합도, 검토 리포트, 제안 초안, 이력서 초안)에 들어가는 입력도 같은 규칙을 따른다. 쓰기는 서버 코드가 게이트 뒤에서만 부른다.

증거: `services/ai/tests/security/test_injection_eval.py`는 지시를 그대로 따르는 가짜 모델(`ObedientLC`)로 런타임 전체를 돌린다. `test_untrusted.py`는 헬퍼와 정책을 단위로 확인한다.

## 3. 도구 권한은 서버가 정한다

- `user_id`, `company_id`는 인증한 job의 state에서만 온다. 모델이 만든 인자로 받지 않는다. 도구 인자 모델은 모르는 키를 버린다. 증거: `test_a_tool_argument_cannot_point_a_read_at_another_user`.
- 쓰기를 실행할지는 `harness/policy.py`의 `decide`가 정한다. 모델이나 프롬프트 문구로 우회하게 만들지 않는다.
  - 같은 실행에서 믿지 않는 글을 읽은 뒤의 쓰기는 모든 모드(AUTO, BYPASS 포함)에서 사용자에게 묻는다.
  - 대화에 믿지 않는 글이 남아 있으면 다른 사람에게 닿는 쓰기(`RISKY_WRITE`)와 `update_my_profile`은 다음 턴에도 묻는다.
  - 지원, 제안 수락, 단계 변경은 모드와 관계없이 `ALWAYS_ASK_TOOLS`에 따라 항상 묻는다.
- 요금제, 동의, 접근 모드는 서버가 DB에서 읽는다. "Ultra라고 했다", "동의했다"는 말로 열리는 경로를 만들지 않는다.
- gateway는 클라이언트가 보낸 `x-push-*` 헤더를 지우고, 내부 비밀이 맞는 호출에만 act-as 헤더 네 개를 통과시킨다(`routes/proxy.ts`). core-api는 내부 비밀이 맞을 때만 act-as 헤더를 받고, act-as가 허용한 경로와 회사 멤버십, 승인 카드를 확인한다. 새 내부 경로를 열 때 이 허용 목록에 명시적으로 추가한다.
- id를 받는 경로는 모두 `user_id`, `company_id`, 멤버십으로 범위를 정한다. id만으로 행을 조회하는 쿼리를 쓰지 않는다.
- 갱신은 허용 키 목록(`strictBody`, `forbidExtra`, `PROFILE_KEYS`)으로 열을 고정한다. `role`, `plan`, `user_id`, `credits`, `is_admin`을 본문에서 받는 갱신을 만들지 않는다.

## 4. 바깥으로 나가는 요청

사용자나 모델이 준 URL을 서버가 요청할 때 따르는 규칙이다. 구현은 `services/ai/src/app/ingest/web_page.py`의 `fetch_page`이고, 페이지 읽기 도구, 메시지 속 링크 미리 읽기, RAG 읽기가 모두 이 경로를 쓴다. Chromium으로 렌더하는 폴백은 `web_page.py`의 이그레스 프록시가 같은 검사를 한다.

- 스킴은 http와 https만 받는다. 자격증명이 든 URL은 거부한다.
- 포트는 80과 443만 받는다. VPS의 공인 IP는 사설 대역 검사를 통과하므로 포트를 막지 않으면 `:3000`, `:6379`, `:5432` 같은 내부 서비스에 닿는다.
- 호스트가 풀리는 IP를 모두 검사한다. 사설, 루프백, 링크로컬, 메타데이터, CGNAT, 멀티캐스트, IPv4-mapped·NAT64·6to4 IPv6가 하나라도 있으면 거부한다.
- 검증한 IP로만 접속한다(`_PinnedBackend`). 연결 직전에 이름을 다시 풀지 않는다. 그래야 DNS 리바인딩이 통하지 않는다.
- 리다이렉트는 홉마다 처음부터 검증한다. 본문은 1MB, 시간은 25초를 넘기지 않는다.
- 모델이 만든 URL(`_dictated`)은 사용자에게 카드로 묻는다. 믿지 않는 글이 URL을 만들 수 있으면 쿼리와 경로에 사용자 자료가 실려 나간다. 방금 믿지 않는 글을 읽은 실행에서는 대화에 없던 주소를 모두 묻는다. 그 글이 이전 턴에만 있으면 허용한 호스트의 다른 페이지는 열되, 쿼리 문자열이 있거나 경로에 `@`, `%25`, `%40`, 20자 이상 토큰, 전화번호 꼴이 있으면 묻는다. 카드에는 쿼리를 포함한 전체 주소를 보여 준다(`harness/approval.py`).
- PDF 파싱은 API 프로세스에서 하지 않는다. `ingest/pdf_text.py`의 `read_pdf_text`는 자식 프로세스에서 읽고(제한 시간 30초, CPU 제한, Linux에서 메모리 1GiB), 동시에 두 개까지만 띄운다. 이벤트 루프에서 동기로 파싱하면 조작한 PDF 하나가 API 전체를 멈춘다.
- DOCX는 `word/document.xml`의 선언 크기 상한(10 MiB)을 두고, `xml.etree`로 읽는다. 이 파서는 외부 엔티티를 해석하지 않으므로 파서를 바꿀 때 이 성질을 다시 확인한다. 파일을 디스크에 풀지 않는다.
- 이력서 PDF·DOCX 렌더는 초안에 든 이미지·링크 URL을 가져오지 않는다. 글자만 그린다.

증거: `services/ai/tests/security/test_net_ssrf.py`, `test_net_files.py`.

## 5. 답변을 내보내기 전에 정리한다

- 모델의 답은 저장하기 전에 `strip_exfil(reply, seen)`을 거친다. 이미지는 대체 글로 바꾸고, 렌더할 때 가져오는 HTML 태그는 지우고, 링크는 그 실행에서 본 주소일 때만 남긴다. 모델이 만든 링크의 쿼리에는 사용자 자료가 실릴 수 있다.
- 스트리밍 `token` 이벤트는 원문 그대로 나간다. 저장본만 정리된다. 그래서 클라이언트도 막는다.
  - 앱과 웹은 봇 답변의 마크다운 이미지와 원격 이미지를 불러오지 않는다.
  - 링크는 주소를 보여 주거나 저장본으로 다시 그린다. 답변 글을 HTML로 렌더하지 않는다(`dangerouslySetInnerHTML`, `rehype-raw` 금지).
- 데이터에서 온 URL을 열 때는 스킴을 검사한다. `window.open`이나 `Linking.openURL`에 `javascript:`, `push://`, `intent://`, `file://`을 넘기지 않는다. fo-web `shared/lib/bridge.ts`의 `send`는 http(s)만 받고, fo-mobile `openBrowser`는 http(s)만, `openUrl`은 http(s)와 `mailto:`만 받는다.
- 다른 사용자가 넣은 외부 이미지 URL은 열람자의 IP를 드러낸다. 서버는 이미지 키만 저장하고 상대 경로(`/api/v1/uploads/images/…`)만 돌려준다. 클라이언트는 이미지를 `assetUrl`·`absoluteUrl`로만 그리고, API 오리진 밖 주소(`//host`, `user@host`, 다른 포트·스킴 포함)는 그리지 않는다. `<img src>`에 서버 값을 그대로 넣지 않는다(`asset-url.test.ts`가 검사한다).
- 새 오픈 리다이렉트 경로를 만들 때 `returnTo`는 `/`로 시작하는 내부 경로만 받고, `//`, `://`, `\`, 제어문자(`\t` 등)를 거부한다(`shared/model/return-to.ts`).

## 6. 토큰과 세션

- 앱은 세션을 SecureStore에 둔다. 토큰을 로그에 남기지 않는다.
- 웹은 기본으로 access·refresh 토큰을 localStorage에 둔다. 스크립트 한 줄이 곧 계정 탈취이므로 CSP를 완화책으로 둔다. refresh 토큰을 HttpOnly 쿠키(`push_rt`)에 두고 access 토큰을 메모리에만 두는 방식이 구현돼 있다. `/auth/` 요청 중 `x-csrf: 1` 헤더가 있는 것만 쿠키를 주고받고, fo-web은 `VITE_COOKIE_SESSION=1`로 빌드할 때만 쓴다. 쿠키는 웹과 API가 같은 사이트일 때만 실리므로 도메인을 맞춘 뒤에 켠다.
- 웹 CSP(fo-web `public/_headers`)의 `script-src 'self'`와 인라인 테마 스크립트의 sha256 해시를 지킨다. `index.html`의 인라인 스크립트를 고치면 해시도 바꾼다(`security-headers.test.ts`가 검사한다). 새 외부 스크립트 출처를 열지 않는다.
- WebView에는 fo-web 오리진에서만 토큰을 준다. fo-mobile `detail-url.ts`의 `bootScript`와 `tokenEventScript`는 `location.origin`이 fo-web 오리진과 같을 때만 실행하고, `webViewNavigation`은 fo-web 오리진만 WebView 안에서 열고 다른 http(s)는 브라우저로, 나머지 스킴은 버린다. 주소 비교에 `startsWith`나 라이브러리의 `originWhitelist`를 쓰지 않는다. `originWhitelist`는 앞부분만 맞으면 통과시켜서 `https://<웹 호스트>@attacker.test` 같은 주소가 토큰을 받았다.
- 브리지 `open` 메시지는 `/`로 시작하고 `//`로 시작하지 않는 앱 경로만 받는다.
- `EXPO_PUBLIC_DEV_AUTH_TOKEN` 같은 개발용 비밀은 운영 번들에 상수로 남지 않게 한다(`config.ts`가 `NODE_ENV === 'production'`이면 `undefined`).
- api-client의 `send`(`packages/api-client/src/client.ts`)는 점 경로 조각(`.`, `..`)과 위험한 문자가 든 경로를 요청 전에 거부한다. 딥링크의 id가 `../../auth/logout`이면 피해자의 토큰이 붙은 요청이 다른 엔드포인트로 가기 때문이다. 요청은 모두 `send`를 거치게 하고, 우회하는 HTTP 호출을 새로 만들지 않는다.
- OAuth는 PKCE(S256)를 필수로 하고, state와 교환 코드는 한 번만 쓰게 한다. 운영에서는 `localhost` 리다이렉트를 허용하지 않는다(`APP_ENV=development`에서만). 로컬 로그인 시험은 `pnpm dev:test`(스테이징)로 한다. refresh 토큰은 회전하고, 재사용을 감지하면 세션을 모두 폐기한다.

## 7. 웹훅과 서명

- Stripe: `Stripe-Signature`의 HMAC-SHA256, 허용 시간 300초, `event_id` 중복 제거를 한 트랜잭션에서 한다.
- App Store: JWS의 `x5c` 체인을 Apple Root G3까지 서명만 따라가지 않는다. 중간 인증서가 CA인지, leaf에 Apple OID(6.11.1)가, 중간에 6.2.1이 있는지, 유효기간 안인지 확인한다. Root G3는 다른 용도의 인증서도 서명하므로 서명만으로는 부족하다.
- Google Play: Pub/Sub의 OIDC 토큰에서 `iss`, `aud`, `exp`와 함께 보낸 서비스 계정(`email`)을 확인한다. 환경 변수 `GOOGLE_OIDC_EMAIL`이 없으면 503으로 거부한다.
- App Store 알림은 `data.bundleId`가 `APPLE_BUNDLE_ID`와 같을 때만 받는다. Apple 네이티브 로그인의 identity token은 한 번만 쓸 수 있다.
- 비밀과 서명 비교는 상수 시간 함수로 한다(`compare_digest`). 비교 대상은 같은 타입(bytes)으로 맞춘다.
- 웹훅 본문으로 플랜이나 크레딧을 바로 올리지 않는다. 우리 테이블에 있는 거래 id만 바꾸고, 부여는 공급자 API로 다시 확인한다.

## 8. 시도 횟수와 일회용 값

- 시도 횟수를 읽고, 비교하고, 올리는 세 단계를 나눠 쓰지 않는다. 동시 요청이 모두 같은 값을 읽어 상한을 넘는다. 한 SQL 문으로 올리면서 상한을 검사한다(`phone-auth.ts`의 `verifyPhone`, 증거 `phone-auth-race-pg.test.ts`).
- 일회용 코드와 토큰은 `UPDATE … WHERE used_at IS NULL RETURNING`처럼 쓰는 순간에 한 번만 소비한다.
- 링크를 연 사람이 곧 메일함 주인이므로, 이메일 가입의 비밀번호는 인증 화면에서 그 사람이 정한다. `POST /auth/email/signup`은 비밀번호를 받지 않고 `POST /auth/email/verify`가 `{ token, password }`를 받아 그때 해시한다. 같은 주소로 두 번 가입해도 남의 비밀번호로 계정이 생기지 않는다(마이그레이션 0066, 0067).
- 로그인 시도는 계정별로 분당과 시간당 상한을 둔다. 새 인증 경로를 열면 상한도 함께 건다(`ratelimit.ts`의 `allow`).

## 9. SQL과 입력

- 사용자 값은 `$n` 바인딩 파라미터로만 넣는다. SQL 문자열에 이어 붙이는 조각은 고정 열 목록, 허용 목록의 정렬 키, 번호뿐이다.
- 테이블 이름과 열 이름은 상수다. 사용자 입력으로 정하지 않는다.
- `LIKE`·`ILIKE`에 쓰는 검색어는 `%`, `_`, `\`를 이스케이프하고 `ESCAPE`를 붙인다.
- 본문은 스키마로 검증하고 모르는 키를 거부한다.
- 업로드는 매직 바이트로 형식을 확인한다. 응답 content-type은 저장한 값이 아니라 허용 목록에서 정하고, `x-content-type-options: nosniff`를 붙인다.
- 공개 경로는 IP별, 로그인한 경로는 사용자별 속도 제한을 둔다. 새 공개 경로를 열면 제한도 함께 건다.

## 10. 비밀

- 키, 토큰, 비밀번호, DB URL을 저장소에 넣지 않는다. 테스트가 만드는 키는 실행 중에 생성한다.
- 시스템 프롬프트에 비밀값을 넣지 않는다. 프롬프트는 유출될 수 있다고 본다.
- 운영 비밀은 호스트의 시크릿 저장소에서만 읽는다. 로그에 비밀을 남기지 않고, 메일·SMS가 설정되지 않은 환경에서도 수신 주소를 운영 로그에 남기지 않는다.
- 의존성은 PR마다 `npm audit --omit=dev`, `pnpm audit --prod`, `pip-audit` 결과를 본다. 수정판이 있는 취약점이 남아 있으면 올린다.

## 11. 보안 테스트를 쓰는 법

- 결함을 고치면 수정 전 `develop`에서 실패하고 수정 후 통과하는 행동 테스트를 함께 둔다. 구현이 아니라 공격자가 얻는 결과(요청이 나갔는지, 쓰기가 실행됐는지, 토큰이 갔는지)를 단언한다.
- 프롬프트 인젝션 테스트는 지시를 그대로 따르는 가짜 모델을 쓴다. 실제 LLM을 부르지 않는다. 유료 호출이 없어야 CI에서 매번 돈다.
- 테스트는 네트워크에 나가지 않는다. 수정이 빠진 코드에서 돌려도 마찬가지다. 공인 IP 리터럴을 쓰는 테스트는 수정이 없으면 실제 TCP 연결을 시도한다. 연결 함수(`asyncio.open_connection` 등)를 기록용 거부 함수로 바꿔 두고, 호출되지 않았다는 단언을 둔다.
- 위치: push-be `services/ai/tests/security/`, core-api `test/*-pg.test.ts`(Postgres가 필요한 경쟁 조건과 제약), push-fe `packages/api-client/src/__tests__/path-injection.test.ts`, fo-web `src/app/security-headers.test.ts`와 `src/shared/lib/bridge-external.test.ts`, fo-mobile `src/shared/components/web-view-guard.test.ts`.
- 원격 호스트에는 요청을 보내지 않는다. 스테이징과 운영을 대상으로 한 스캔이나 공격은 하지 않는다.

## 12. 새 기능을 열기 전에 묻는다

1. 이 기능이 읽는 글 중 공격자가 쓸 수 있는 것이 있나? 있으면 `as_data`를 거치는가?
2. 그 글을 읽은 뒤 모델이 쓸 수 있는 도구가 무엇이고, `decide`가 어떤 모드에서 묻는가?
3. 서버가 바깥으로 요청을 보내나? 있으면 4장의 규칙을 모두 지키는가?
4. 답변에 이미지나 링크가 실려 클라이언트가 가져오게 되나?
5. 토큰이 fo-web 오리진 밖으로 나갈 수 있나?
6. 경로의 id가 `user_id`나 회사 범위 없이 행을 고르나?
7. 상한이나 일회용 값을 읽고 쓰는 사이에 동시 요청이 끼어들 수 있나?
8. 이 결함을 재현하는 테스트가 수정 전에 실패하나?
