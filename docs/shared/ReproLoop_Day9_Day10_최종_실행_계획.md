# ReproLoop Day 9·10 최종 실행 계획

> 작성 기준일: 2026-08-26
> 팀원 A: 용준 — 배포·관리자 흐름·알림 Worker
> 팀원 B: 신정 — E2E·제보/중복 흐름·랜딩·Discord `/bug`
> 원본 계획: [ReproLoop 2인 개발 작업분담 실행 계획](./ReproLoop_2인_개발_작업분담_계획.md)
> B 세부 계획: [B 기능 개발 세부 계획](../b-신정/plans/B-기능%20개발%20세부%20계획.md)

## 1. 현재 기준선

핵심 기능 개발은 Day 8까지 완료되었다. 남은 이틀은 새 핵심 기능을 늘리는 기간이 아니라, **배포·운영 검증·결함 수정·데모 완성도 향상**을 완료하는 기간으로 사용한다.

| 영역 | 현재 상태 | Day 9·10의 목표 |
|---|---|---|
| Discord `/bug` 접수 | 구현 완료 | 운영 URL·실제 guild 검증, 문구·Modal UX 정리 |
| 인증·프로젝트·목록 | 구현 완료 | 운영 권한 검증, 공통 관리자 UI 정리 |
| 상세·이력·중복 병합 | 구현 완료 | 운영 통합 검증, 가독성·오류 표현 정리 |
| 상태 변경·수정 빌드 | 구현 완료 | owner/admin/member 운영 권한과 상태 흐름 확인 |
| 대표·중복 제보자 DM | PR 6 병합·로컬 smoke 완료 | Railway Worker에서 중복 없는 DM 확인 |
| 랜딩 페이지 | 구현됨 | 실제 제품 상태와 문구·CTA·배포 정렬 |
| 자동·수동 E2E | 부분 완료 | 핵심 시나리오, 운영 smoke, 최종 데모 기록 |

Day 9 시작 기준은 PR #16이 병합된 `main` 커밋 `43d5408`이다.

## 2. 이틀 최종 목표

```text
Discord /bug 제출
→ DB에 1번만 저장
→ 관리자 Web 로그인
→ 목록·상세·이력 확인
→ 중복 제보 병합
→ 조사 시작·재현 완료
→ 수정 빌드 선택·수정 완료
→ 고유 제보자별 Discord DM 1회
→ 랜딩·관리자 Web·Discord가 하나의 제품으로 보임
```

이틀의 종료 조건은 다음과 같다.

- [x] PR 6이 `main`에 병합됨 — PR #16, `43d5408`
- [ ] Railway Web·Worker가 최신 `main`으로 실행됨
- [ ] 운영 DB migration 상태가 정상임
- [ ] 운영 Discord 전체 흐름이 1회 성공함
- [ ] owner/admin/member 권한 검증이 성공함
- [ ] 대표·중복 제보자가 DM을 각각 한 번만 받음
- [ ] 랜딩 CTA와 관리자 Web 진입 경로가 정상임
- [ ] 관리자 Web의 주요 화면이 공통 시각 규칙을 사용함
- [ ] Discord Bot·`/bug`·수정 완료 DM의 문구와 브랜드가 일관됨
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 통과함
- [ ] 실제 secret·Discord 사용자 ID·제보 원문이 Git에 없음

## 3. Day 9 전 합의할 결정

Day 9 작업을 시작하기 전에 A와 B가 30분 안에 다음 항목을 잠근다. 결정이 안 나면 권장 기본안을 사용한다.

| 항목 | 권장 기본안 | 최종 결정 |
|---|---|---|
| 랜딩 배포 | Vercel `apps/marketing` |  |
| 관리자 Web·Worker | Railway 유지 |  |
| 랜딩 주 CTA | 관리자 Web 열기, 보조 CTA는 3분 데모 |  |
| 공개 Bot 설치 링크 | 이번에는 비공개, 테스트 서버로 제한 |  |
| 관리자 Web 테마 | 밝은 배경 유지 + 랜딩의 lime 브랜드 포인트 |  |
| 다크 모드 | Day 10 범위에서 제외 |  |
| 수정 완료 DM | 일반 텍스트에서 Discord Embed로 개선 |  |
| DM의 관리자 링크 | 제보자에게는 제공하지 않음 |  |
| 데모 데이터 | 테스트 전용 조직·프로젝트·빌드·Discord 계정 사용 |  |

결정이 코드 계약, DB schema, 환경변수를 바꾸면 꾸미기 PR에 숨기지 않고 별도 계약·설정 커밋으로 분리한다.

## 4. 공통 파일 소유권

| 파일·영역 | Day 9·10 소유자 | 규칙 |
|---|---|---|
| `apps/web/src/app/layout.tsx` | A(용준) | B는 동시 수정하지 않음 |
| `apps/web/src/app/globals.css` | A(용준) | 공통 토큰·배경·focus 규칙은 A가 먼저 병합 |
| 프로젝트·목록·상태·빌드 UI | A(용준) | A 기능 결함과 시각 정리를 같이 처리 |
| 제보 상세·이력·중복 UI | B(신정) | A의 공통 UI PR 병합 후 rebase |
| `apps/marketing/**` | B(신정) | 작업 기간 중 B만 수정 |
| `apps/worker/**` | A(용준) | DM Embed·재시도·Worker 소유 |
| `apps/web/src/server/discord/**` | B(신정) | `/bug`·Modal·응답 문구 소유 |
| Railway·GitHub·CI | A(용준) | 기능·스타일 PR과 설정 변경을 분리 |
| E2E fixture·운영 검증표 | B(신정) | secret·실제 사용자 ID 기록 금지 |
| `pnpm-lock.yaml` | 의존성을 추가하는 사람 1명 | 동시 `pnpm add` 금지 |

## 5. Day 9 — 배포 기준선과 운영 E2E 완성

### 5-1. Day 9 목표

| 구분 | 내용 |
|---|---|
| 핵심 목표 | 최신 `main`을 Railway에 배포하고 운영 전체 흐름을 한 번 성공시킨다. |
| A 주요 산출물 | PR 6 병합 기준선 확인, Railway Web·Worker·migration, 관리자 Web 공통 디자인 기준 |
| B 주요 산출물 | E2E seed·통합 테스트, 운영 Discord smoke, 랜딩 정확성 점검 |
| 종료 조건 | `/bug → Web → 병합 → 수정 완료 → DM`이 운영 환경에서 1회 성공 |

### 5-2. A(용준) Day 9 작업

#### A-D9-01. PR 6 리뷰·병합 — ✅ 완료 (2026-08-26)

- `feat/duplicate-recipients` / `e495b40` 리뷰·PR #16 병합
- 대표·중복 수신자, idempotency key, `NotificationSendJobV1` 연동 확인
- 병합 후 `main` 커밋 해시를 B와 공유
- 완료 기준: PR 6이 `main`에 병합되고 두 사람의 로컬 기준선이 같음

#### A-D9-02. Railway Web·Worker·DB 배포

- 최신 `main`으로 Web·Worker 배포
- Web·Worker의 `DATABASE_URL`이 같은 DB를 가리키는지 확인
- Web의 Auth·Discord Interaction 환경변수 확인
- Worker의 `DISCORD_BOT_TOKEN` 확인
- 운영 migration 적용 상태 확인
- Worker 로그의 `reproloop-worker ready` 확인
- Discord Interaction Endpoint가 Railway Web URL을 가리키는지 확인
- 완료 기준: Web 200, Worker ready, DB query, Discord PING이 모두 정상

#### A-D9-03. 관리자 Web 공통 UI 기준

- 랜딩과 공유할 로고·lime 포인트·버튼·focus 규칙 확정
- 밝은 배경의 관리자 화면을 유지하고 브랜드 포인트만 연결
- 헤더, 로고, 현재 사용자, 프로젝트 breadcrumb 구성 확정
- 상태 badge·severity·주요/보조/위험 버튼 표현 확정
- `layout.tsx`, `globals.css`를 A 단독으로 수정
- 완료 기준: B가 상세 화면에 재사용할 규칙이 병합됨

#### A-D9-04. A 소유 핵심 결함 분류

- 로그인, 프로젝트, 목록, 필터, 상태, 빌드, Worker 결함 재현
- P0는 Day 9 안에 수정
- P1은 Day 10 첫 작업으로 등록
- 완료 기준: P0 차단 결함이 없고 P1의 담당·재현 순서가 있음

### 5-3. B(신정) Day 9 작업

#### B-D9-01 / B-E2E-01. E2E fixture·seed

- 조직 2개, owner/admin/member, 프로젝트 2개, active build, 일반·중복 제보 최소 세트
- 반복 실행 시 충돌하지 않는 namespace·정리 전략
- 실제 Discord ID·secret을 fixture에 저장하지 않음
- 완료 기준: 테스트 DB에서 반복 실행해도 예측 가능한 상태

#### B-D9-02 / B-E2E-02~04. 핵심 통합 시나리오

- 서명된 `/bug` 요청·Modal·멱등 저장
- owner 로그인·상세 조회·중복 병합·stale version 409
- member 병합·수정 완료 거부
- 대표 + 중복 여러 건을 수정 완료한 뒤 고유 수신자별 notification/job 1건
- `sent` 재처리 시 중복 전송 없음
- 완료 기준: API·DB·job 결과가 모두 일치

#### B-D9-03 / B-E2E-05. 운영 Discord·Railway smoke

```text
실제 guild에서 /bug
→ Railway Web 로그인
→ 목록·상세
→ 중복 병합
→ 조사 시작
→ 재현 완료
→ 수정 빌드·수정 완료
→ 대표·중복 제보자 DM
```

- report number, 시각, notification 결과만 기록
- 제보 원문·token·Discord ID는 문서·스크린샷에 남기지 않음
- 완료 기준: 운영 전체 흐름 1회 성공, 고유 제보자별 DM 1회

#### B-D9-04. 랜딩 정확성·CTA 감사

- 현재 랜딩의 “실제 Bot이 아직 없다”는 취지의 문구 찾기
- 현재 실제 MVP 기능과 데모 시뮬레이션 구분
- 주 CTA·보조 CTA·관리자 Web URL 결정을 문서화
- 한국어·영어 문구, 보안·개인정보 설명의 과장 여부 점검
- 완료 기준: Day 10에 수정할 정확한 문구·CTA 목록이 있음

### 5-4. Day 9 공동 마감

1. B가 운영 E2E 결과와 결함 목록을 공유한다.
2. A와 B가 P0/P1/P2를 같이 분류한다.
3. P0는 당일 수정한다.
4. A의 공통 관리자 UI 규칙을 B가 확인한다.
5. Day 10 꾸미기 범위를 결함 수정 이후에 잠근다.

Day 9 보고 형식:

```text
완료: 병합·배포·E2E 결과
결함: P0/P1/P2, 재현 절차, 담당자
결정: 랜딩 CTA, 관리자 테마, Discord DM 형식
Day 10 첫 작업: 각자 첫 P1 결함 또는 UI 파일
```

## 6. Day 10 — 결함 수정, 제품 꾸미기, 최종 데모

### 6-1. Day 10 목표

| 구분 | 내용 |
|---|---|
| 핵심 목표 | P0/P1 결함을 정리하고 랜딩·관리자 Web·Discord의 완성도를 맞춘 뒤 최종 데모를 성공시킨다. |
| A 주요 산출물 | A 소유 결함, 관리자 Web 공통/목록/상태 UI, Bot·DM, 최종 Railway 배포 |
| B 주요 산출물 | B 소유 결함, 상세/중복 UI, `/bug` UX, 랜딩, 최종 E2E 보고 |
| 종료 조건 | 루트 4대 검사와 실제 데모가 성공하고 P0가 없음 |

### 6-2. A(용준) Day 10 작업

#### A-D10-01. 인증·목록·상태·Worker 결함 수정

- 로그인·세션·조직 접근 결함
- 프로젝트 선택·목록·검색·필터 결함
- 상태 변경·수정 빌드·낙관적 잠금 결함
- notification queue·Worker·Discord 전송 결함
- 완료 기준: A 영역 P0 0개, P1은 재현 테스트 통과

#### A-D10-02. 관리자 Web 공통·목록·상태 UI 마감

- 헤더·로고·사용자·breadcrumb·페이지 최대 너비 정리
- 상태·severity badge와 텍스트 대비를 함께 사용
- loading·empty·forbidden·not-found·server-error 표현 일관화
- 기본·주요·위험 버튼 계층 정리
- 390px 모바일, 키보드 focus, 색 대비 확인
- 완료 기준: 프로젝트·목록·상태 화면이 하나의 관리자 제품으로 보임

#### A-D10-03. Discord Bot·수정 완료 DM 마감

- Bot 이름·아이콘·소개 문구 확정
- 수정 완료 DM을 결정된 형식으로 정리
- Embed 사용 시 BUG 번호, 제목, 수정 빌드, 안내 문구만 포함
- 제보자에게 관리자 전용 링크를 보내지 않음
- DM 차단·실패 시 `failed`, attempt, error 기록 확인
- 완료 기준: 정상 DM 1회, `sent` 재처리 시 0회

#### A-D10-04. 최종 Railway 배포·운영 확인

- A 스타일·결함 PR 병합
- B 스타일·E2E PR 병합 후 최신 `main` 배포
- Web·Worker health, migration, 환경변수 재확인
- rollback 기준 커밋 기록
- 완료 기준: 최신 `main`이 운영에 반영되고 치명적 로그가 없음

### 6-3. B(신정) Day 10 작업

#### B-D10-01 / B-E2E-06. 접수·상세·병합 결함 수정

- Discord 서명·Modal·멱등 접수 결함
- 상세·이력·nullable 필드·긴 본문 결함
- 대표 검색·병합·취소·순환·stale version 결함
- 대표·중복 수신자 계산 회귀
- 완료 기준: B 영역 P0 0개, P1은 재현 테스트 통과

#### B-D10-02. 상세·이력·중복 UI 마감

- A의 공통 UI PR 병합 후 최신 `main`에 rebase
- 제보 제목·상태·severity·빌드·제보자 정보 계층 정리
- 재현 단계·결과·환경의 긴 텍스트 가독성
- 상태 변경·중복 병합의 주요/위험 행동 구분
- 검색 결과 없음, 경쟁 충돌 409, 권한 거부 문구 정리
- 390px 모바일과 긴 Discord 이름 확인
- 완료 기준: 상세·중복 화면이 A의 공통 규칙과 일치

#### B-D10-03. Discord `/bug`·Modal·접수 응답 마감

- `/bug` command 설명, project/build option 설명 정리
- Modal 제목·필드명·placeholder·길이 제한 문구 정리
- 접수 성공 응답에 `BUG-n`과 다음 단계 안내
- validation·권한·내부 오류를 사용자용 문구로 표현
- command를 테스트 guild에 재등록하고 실제 Modal 확인
- 완료 기준: 플레이테스터가 추가 설명 없이 `/bug`를 완료할 수 있음

#### B-D10-04. 랜딩 페이지 최종화

- 실제 제품 상태와 맞지 않는 “미연결 MVP” 문구 수정
- 실제 서비스와 브라우저 시뮬레이션을 명확히 구분
- 결정된 관리자 Web URL로 CTA 연결
- 한국어·영어 전환, 데모 초기화, 복사, Modal 접근성 확인
- 390px·768px·desktop 반응형 확인
- title·description·canonical·Open Graph·sitemap·robots 확인
- 공개 Bot 설치 링크는 합의 없이 추가하지 않음
- 완료 기준: Vercel 예정 URL에서 CTA·데모·모바일·OG 확인

#### B-D10-05. 최종 E2E·데모 기록

- 루트 4대 검사 실행
- 테스트 DB 통합 검사 실행
- 최신 운영 배포에서 전체 흐름 재실행
- report number, 성공/실패, 배포 커밋만 기록
- P0 0개, P1 잔여 항목은 재현 순서·담당·후속 일정 기록
- 완료 기준: A와 B가 각각 상대 담당 기능을 1회 검증하고 최종 데모 성공

### 6-4. Day 10 공동 마감

1. A와 B가 서로의 PR을 리뷰한다.
2. 최신 `main`에서 루트 4대 검사를 재실행한다.
3. A가 Railway Web·Worker를 재배포한다.
4. B가 Vercel 랜딩과 운영 전체 흐름을 확인한다.
5. A와 B가 각자 상대 담당 기능을 한 번씩 조작한다.
6. 데모 순서, 테스트 계정, rollback 커밋, 알려진 P1을 기록한다.

## 7. 결함 우선순위

| 등급 | 기준 | 처리 |
|---|---|---|
| P0 | 로그인, 권한, `/bug`, 저장, 상태, 병합, DM, 배포 실패 | 꾸미기를 멈추고 즉시 수정 |
| P1 | 핵심 시나리오는 되지만 오류 표현·모바일·일부 재시도가 깨짐 | Day 10 내 수정 |
| P2 | 미세한 간격, 애니메이션, 부가 설명, 편의 기능 | 시간이 남을 때만 처리 |

P0 결함이 있으면 랜딩·관리자 Web·Discord 꾸미기 작업을 완료로 표시하지 않는다.

## 8. PR·병합 계획

### Day 9

| 순서 | 담당 | 브랜치 | 내용 |
|---:|---|---|---|
| 1 | B → A 리뷰 | `feat/duplicate-recipients` | ✅ PR #16 병합 (`43d5408`) |
| 2 | A | `chore/production-deploy` | Railway Web·Worker·migration·운영 설정 |
| 3 | B | `test/core-e2e` | seed·API/DB/job 통합·운영 smoke |
| 4 | A | `style/admin-shell` | 공통 layout·globals·header·UI 규칙 |

### Day 10

| 순서 | 담당 | 브랜치 | 내용 |
|---:|---|---|---|
| 1 | A | `fix/final-admin-worker` | A 소유 P0/P1 결함 |
| 2 | B | `fix/final-report-discord` | B 소유 P0/P1 결함 |
| 3 | A | `style/admin-notification-polish` | 목록·상태·Bot·DM 마감 |
| 4 | B | `style/report-marketing-polish` | 상세·중복·`/bug`·랜딩 마감 |
| 5 | A+B | `main` | 최종 검사·배포·데모 |

시간이 부족하면 결함 PR과 스타일 PR을 사람별 하나로 합칠 수 있다. 단, Railway·migration·환경변수 변경은 기능·스타일 커밋과 분리한다.

## 9. 실행 명령과 검증

### 작업 시작

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c <branch-name>
pnpm install --frozen-lockfile
```

### PR 전 공통 검사

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git status
```

### 테스트 DB 통합 검사

```powershell
$env:TEST_DATABASE_URL="테스트용 PostgreSQL URL"
pnpm test
Remove-Item Env:TEST_DATABASE_URL
```

운영 DB를 `TEST_DATABASE_URL`로 사용하지 않는다.

### 최종 수동 데모

```text
1. 랜딩 CTA 확인
2. Discord 테스트 guild에서 /bug 제출
3. 관리자 Web에 Discord로 로그인
4. 목록·상세·상태 이력 확인
5. 대표 제보 검색·중복 병합
6. 조사 시작·재현 완료
7. 수정 빌드 선택·수정 완료
8. 대표·중복 제보자 DM 확인
9. DB notification sent·attempt·idempotency 확인
10. member 권한 거부·조직 외 접근 차단 확인
```

## 10. 일정 압축 시 제외 순서

시간이 부족하면 다음 순서로 제외한다.

1. 부가 애니메이션
2. 관리자 Web 다크 모드
3. 랜딩 세부 전환 효과
4. Discord Bot 상태·추가 장식
5. 고급 모바일 최적화

다음은 제외하지 않는다.

- 운영 배포·migration·rollback 확인
- Discord `/bug` 멱등 저장
- 인증·조직 권한
- 목록·상세·상태 변경
- 중복 병합
- 수정 빌드·고유 제보자 DM
- 핵심 E2E와 루트 4대 검사

## 11. 최종 인계물

### A(용준)

- Railway Web·Worker·migration 배포 결과
- 환경변수 이름·서비스별 설정 표(secret 값 제외)
- 관리자 Web 공통 UI 규칙
- 인증·목록·상태·빌드 결함 처리 결과
- Discord Bot·수정 완료 DM 형식
- 배포·rollback 커밋과 알려진 운영 주의사항

### B(신정)

- seed·자동 E2E·운영 smoke 결과
- `/bug`·상세·이력·중복 결함 처리 결과
- 상세·중복 UI 마감
- Discord `/bug`·Modal·접수 응답 문구
- 랜딩 문구·CTA·반응형·메타데이터 결과
- 최종 데모 순서·결함 목록·후속 작업

## 12. 매일 보고 형식

```text
완료: [작업 ID] 병합·배포·검증한 결과
진행: [작업 ID] 현재 브랜치와 남은 항목
결함: P0/P1/P2, 재현 순서, 담당자
결정: 배포·디자인·Discord·CTA 합의 결과
다음: 다음 작업 ID와 첫 행동
```

Day 10 최종 보고에는 다음 한 줄을 반드시 포함한다.

```text
최종 결과: 배포 커밋 / 루트 4대 검사 / 운영 데모 / P0 개수 / 남은 P1 담당
```
