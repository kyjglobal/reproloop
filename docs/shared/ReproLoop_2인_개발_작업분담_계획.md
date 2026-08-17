# ReproLoop 2인 개발 작업분담 실행 계획

> 작성 기준일: 2026-08-09
> 환경설정 완료 예상: 2026-08-09~2026-08-10
> 기능 개발 기간: 환경설정 완료 다음 작업일부터 10일
> 인원 A: 환경설정과 개발자 관리 흐름 담당
> 인원 B: 공통 계약과 플레이테스터 제보·중복 관리 흐름 담당

## 1. 전제와 목표

인원 A는 `ReproLoop_GitHub_환경세팅_10단계.md`에 따라 저장소, pnpm workspace, Web·Worker, 외부 서비스, CI와 Railway 설정을 진행한다. 이 작업은 오늘 또는 내일 완료될 예정이므로 기능 개발 일정과 섞지 않고 **환경설정 인계 시점 T0**로 분리한다.

기능 개발의 목표는 10일 안에 다음 핵심 흐름을 실제 Discord와 Railway 환경에서 시연하는 것이다.

```text
Discord /bug 제출
→ DB에 한 번만 저장
→ 로그인한 개발자가 목록·상세 확인
→ 상태 변경 또는 중복 병합
→ 수정 빌드 등록
→ 관련 제보자에게 Discord 알림
```

첨부파일 업로드는 10일 MVP의 필수 범위에서 제외한다.

## 2. T0 이전: 환경설정 인계 구간

### 인원 A가 완료할 작업

인원 A는 환경설정 10단계를 끝내고 `chore/environment-bootstrap` PR 하나로 인계한다.

- [x] `apps/web`이 `@reproloop/web` 이름으로 실행된다.
- [x] `apps/worker`에 `package.json`, `tsconfig.json`, `src/index.ts`와 기본 스크립트가 있다.
- [x] `packages/db`, `packages/domain`, `packages/shared`에 각각 `package.json`, `tsconfig.json`, `src/index.ts`가 있다.
- [x] 루트 `pnpm-workspace.yaml`이 `apps/*`, `packages/*`를 인식한다.
- [x] Web·Worker·공통 개발 의존성이 설치되고 `pnpm-lock.yaml`이 갱신되어 있다.
- [x] `.env.example`과 `.gitignore`가 준비되어 있다.
- [ ] Supabase PostgreSQL과 Private Storage가 준비되어 있다.
- [ ] Discord Application, OAuth Callback과 테스트 서버가 준비되어 있다.
- [ ] GitHub 협업 권한과 기본 CI가 준비되어 있다.
- [ ] Railway Web·Worker 서비스의 기본 연결이 준비되어 있다.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 실행 가능한 상태다.

실제 비밀 값은 PR이나 문서에 넣지 않는다. A는 B에게 비밀번호 관리 도구로 값을 전달하거나, B가 자신의 로컬 환경에 직접 등록하도록 초대한다.

### 인원 B가 T0 전에 할 작업

환경설정 완료까지 최대 하루이므로 B는 A가 수정 중인 workspace 파일을 건드리지 않는다. 다음 설계만 확정한다.

- [x] API 계약 초안에서 공통 enum 목록을 확정한다.
- [x] API 단건 성공, 목록 성공, 오류 응답의 필드와 nullable·optional 규칙을 표로 만든다.
- [x] `severity`, 멤버 상태 변경 권한 등 미정 사항을 A에게 질문하고 결론을 기록한다.
- [x] 상태 전이와 중복 병합의 정상·실패 테스트 사례를 작성한다. 세부 내용은 `ReproLoop_B_PR1_PR2_구현명세.md`를 따른다.
- [x] 첫 두 PR의 파일 목록과 공개 export 이름을 정한다. 세부 내용은 `ReproLoop_B_PR1_PR2_구현명세.md`를 따른다.

T0 전에는 다음 파일을 수정하지 않는다.

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
apps/web/**
apps/worker/**
packages/**
.env.example
.gitignore
.github/**
```

### T0 인계 절차

1. A가 환경설정 PR에서 모든 기본 검사를 실행한다.
2. B가 PR에서 secret 포함 여부와 workspace script를 확인한다.
3. A가 PR을 `main`에 병합한다.
4. 두 사람이 같은 `main` 커밋 해시를 확인한다.
5. 이후 기능 개발 Day 1을 시작한다.

각자 실행할 명령:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git rev-parse --short HEAD
```

위 명령 중 하나라도 실패하면 기능 개발을 시작하기 전에 A의 환경설정 PR에서 수정한다.

## 3. 기능 개발 담당 범위

### 인원 A: 개발자 관리·알림 흐름

```text
Discord OAuth 로그인
→ 조직·프로젝트 권한 확인
→ 제보 목록과 필터
→ 상태 변경
→ 수정 빌드 등록
→ 알림 작업 생성과 Worker 전송
```

| 계층 | 담당 작업 | 주 파일 영역 |
|---|---|---|
| 인증 | Auth.js Discord 로그인과 세션 | `apps/web/src/auth*`, API auth 영역 |
| DB | 사용자, 조직, 멤버, 프로젝트, 빌드, 알림 | `packages/db/src/schema` |
| 도메인 | 조직 권한, 상태 변경 승인, 수정 완료와 알림 생성 | `packages/domain/src` |
| API | 내 정보, 프로젝트, 빌드, 제보 목록, 상태 전이 | `apps/web/src/app/api` |
| Web | 로그인, 프로젝트 선택, 목록, 필터, 상태·수정 UI | `apps/web/src/app` |
| Worker | pg-boss 소비, Discord 전송, 재시도·멱등성 | `apps/worker/src` |
| 테스트 | 권한 차단, 상태 변경, 알림 중복 방지 | 해당 package와 app 테스트 |

인원 A 완료 조건:

- 조직 멤버만 해당 프로젝트 제보를 조회할 수 있다.
- 상태와 빌드로 목록을 필터링할 수 있다.
- 수정 완료와 알림 작업 생성이 하나의 트랜잭션으로 처리된다.
- Worker 재실행이나 재시도에도 같은 알림이 중복 전송되지 않는다.

### 인원 B: 공통 기반·제보·중복 관리 흐름

```text
공통 enum·Zod 계약
→ Drizzle 스키마와 첫 migration
→ Discord /bug 수신
→ 제보 저장과 상세 조회
→ 중복 병합·취소
→ 대표·중복 제보자 알림 대상 계산
```

| 계층 | 담당 작업 | 주 파일 영역 |
|---|---|---|
| 공통 | enum, API 성공·오류, 요청 DTO Zod 스키마 | `packages/shared/src` |
| DB 기반 | 전체 테이블 관계, 공통 컬럼, 첫 migration | `packages/db` |
| DB 기능 | 버그 제보, 상태 이력, 대표·중복 관계 | `packages/db/src/schema` |
| 도메인 | 제보 생성, 상태 전이 규칙, 중복 병합·취소, 순환 방지 | `packages/domain/src` |
| API | Discord Interaction, 제보 생성·상세, 중복 병합 | `apps/web/src/app/api` |
| Web | 상세, 상태 이력, 대표 제보 검색·병합 UI | `apps/web/src/app` |
| 테스트 | 서명 검증, 중복 제출 방지, 잘못된 병합 거부 | 해당 package와 app 테스트 |

인원 B 완료 조건:

- 공통 계약을 Web, Worker, Domain이 같은 package에서 import한다.
- 같은 Discord Interaction ID로 제보가 두 번 저장되지 않는다.
- 제보 상세에서 입력 내용과 상태 이력을 조회할 수 있다.
- 같은 프로젝트의 일반 제보만 대표 제보로 선택할 수 있다.
- 자기 참조, 순환 참조와 이미 중복인 제보를 대표로 지정하는 요청을 거부한다.
- 대표 버그 수정 시 대표·중복 제보자의 알림 대상이 중복 없이 계산된다.

## 4. 공통 파일 소유권과 충돌 방지

| 영역 | 최초 작성자 | 리뷰어 | 규칙 |
|---|---|---|---|
| 환경설정·workspace | A | B | T0 이후 변경은 별도 `chore` PR |
| `pnpm-lock.yaml` | 의존성을 추가한 사람 | 상대방 | 동시에 `pnpm add`를 실행하지 않음 |
| 공통 enum·Zod 계약 | B | A | 기능 PR보다 먼저 계약 PR 병합 |
| Drizzle 전체 관계 | B | A | 첫 migration까지 B가 단독 생성 |
| 추가 migration | 스키마 변경자 | 상대방 | 한 시점에 migration PR 하나만 열기 |
| 상태 전이 규칙 | B | A | API에서 별도 규칙을 복제하지 않음 |
| 인증·세션 | A | B | B는 공개된 `requireProjectMember` 인터페이스 사용 |
| Worker 실행 기반 | A | B | B는 공유 job payload 계약만 수정 |
| CI·Railway 설정 | A | B | 기능 코드와 같은 PR에서 수정하지 않음 |

두 사람이 동시에 `apps/web/src/app`을 수정할 때는 라우트 폴더를 나눈다.

- A: 로그인, 프로젝트, 제보 목록, 상태 변경
- B: 제보 상세, 중복 병합, Discord Interaction

공용 layout, navigation, 전역 CSS는 작업 시작 전에 담당자를 한 명 지정하고 그날에는 다른 사람이 수정하지 않는다.

## 5. PR 순서

### PR 0 — A 환경설정 인계

- 브랜치: `chore/environment-bootstrap`
- 담당: A
- 병합 조건: T0 체크리스트와 루트 기본 검사 통과

### PR 1 — 공통 계약

- 브랜치: `feat/shared-contracts`
- 담당: B
- 내용: 공통 enum, API 응답·오류, 핵심 요청 DTO, Zod 테스트
- 리뷰: A
- 병합 조건: `@reproloop/shared`를 Web과 Worker에서 import 가능

### PR 2 — DB·도메인 기반

- 브랜치: `feat/report-domain-foundation`
- 담당: B
- 내용: Drizzle schema, 첫 migration, 상태 전이, repository interface, 단위 테스트
- 리뷰: A
- 병합 조건: A가 자신의 Supabase 개발 DB에 migration 적용 확인

PR 2가 병합된 뒤부터 아래 PR은 같은 번호끼리 병렬로 진행한다.

| 순서 | 인원 A | 인원 B | 통합 기준 |
|---:|---|---|---|
| 3 | `feat/auth-project-access` | `feat/discord-bug-submit` | 로그인과 `/bug`가 각각 동작 |
| 4 | `feat/report-inbox` | `feat/report-detail` | 제출한 제보가 목록·상세에 표시 |
| 5 | `feat/report-status-fix` | `feat/duplicate-merge` | 상태 변경과 병합 규칙 통과 |
| 6 | `feat/notification-worker` | `feat/duplicate-recipients` | 대표·중복 제보자 알림 성공 |
| 7 | `chore/production-deploy` | `test/core-e2e` | 운영 시나리오 전체 통과 |

## 6. 10일 실행 일정

환경설정 완료일은 Day 0이며 10일 일정에 포함하지 않는다.

| 일차 | 인원 A | 인원 B | 당일 종료 조건 |
|---:|---|---|---|
| Day 1 | 공통 계약 리뷰, Supabase·Discord 접근 인계 | 공통 enum, API 응답·오류 Zod 스키마와 테스트 | PR 1 병합 |
| Day 2 | DB 관계와 migration 리뷰·실행 | 전체 Drizzle schema, 첫 migration, repository interface | 개발 DB migration 성공 |
| Day 3 | Auth.js, 조직·프로젝트 권한 | 상태 전이와 중복 병합 도메인 테스트 | 권한·도메인 단위 테스트 성공 |
| Day 4 | 내 정보·프로젝트·제보 목록 API | Discord PING·서명 검증·`/bug` modal | 로그인 API와 Discord PING 성공 |
| Day 5 | 목록 필터 API와 목록 화면 | 제보 생성 트랜잭션과 Interaction 연결 | `/bug` 제보가 목록에 표시 |
| Day 6 | 프로젝트 선택과 목록 UI 보완 | 상세 API, 상세·상태 이력 화면 | `제보 → 목록 → 상세` 통합 성공 |
| Day 7 | 상태 변경 API·UI | 중복 병합 API와 대표 제보 검색 UI | 화면에서 상태 변경·병합 성공 |
| Day 8 | 수정 빌드, 알림 레코드, Worker 전송 | 병합 취소와 중복 제보자 알림 대상 조회 | 대표·중복 제보자 알림 성공 |
| Day 9 | Railway Web·Worker·migration 배포 | 핵심 API 통합 테스트와 운영 Discord 확인 | 운영 전체 흐름 1회 성공 |
| Day 10 | 인증·목록·상태·알림 결함 수정 | 접수·상세·병합 결함 수정 | 전체 검사와 실제 데모 성공 |

## 7. 매일 작업 절차

### 시작 전

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c 브랜치명
pnpm install --frozen-lockfile
```

### PR 전

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git status
```

### 매일 공유할 내용

```text
완료: 오늘 병합하거나 확인한 항목
진행: 현재 브랜치와 남은 작업
차단: 상대의 결정·키·API가 필요한 항목
내일 첫 작업: 다음 시작점 한 줄
```

PR 설명에는 다음을 반드시 포함한다.

- 변경 목적과 범위
- 실행한 검사와 결과
- migration 또는 환경변수 변경 여부
- 상대방이 직접 확인할 한 가지 시나리오
- 후속 PR에서 처리할 항목

## 8. 인계 계약

### A가 B에게 제공

| 제공 항목 | 전달 기준 | B가 확인할 것 |
|---|---|---|
| 환경설정 PR | T0 기본 검사 통과 | 같은 커밋에서 로컬 실행 |
| Supabase 접근 | 비밀 채널로 프로젝트 초대·연결 정보 전달 | migration·query 성공 |
| Discord 앱·서버 | 개발자 권한과 테스트 채널 제공 | PING·서명 검증·명령 실행 |
| 인증 helper | 사용법과 실패 응답 명시 | 상세·병합 API에서 재사용 |
| Worker job 결과 | job 이름과 처리 상태 명시 | 알림 대상 payload 연동 |

### B가 A에게 제공

| 제공 항목 | 전달 기준 | A가 확인할 것 |
|---|---|---|
| shared 계약 | export 목록과 예제 포함 | Web·Worker import 성공 |
| 첫 migration | 생성 파일과 적용·rollback 주의사항 포함 | 개발 DB 적용 성공 |
| 상태 전이 함수 | 허용·거부 표와 테스트 포함 | 상태 API에서 재사용 |
| repository interface | 입력·출력과 트랜잭션 경계 명시 | 목록·상태 API 구현 가능 |
| 알림 대상 조회 | 중복 제거 규칙과 테스트 포함 | Worker payload 생성 가능 |

## 9. 지연 또는 차단 시 대체 작업

| 차단 항목 | 기다리는 동안 진행할 작업 |
|---|---|
| 환경설정 T0 지연 | B는 계약·테스트 표만 확정하고 repo 공용 파일은 수정하지 않음 |
| Supabase 접근 지연 | Drizzle schema, SQL 생성, repository mock 테스트 |
| Discord 키 지연 | 고정 fixture로 Interaction 파싱과 잘못된 서명 거부 테스트 |
| Auth.js 지연 | B의 API는 `Actor` fixture와 권한 interface로 테스트 |
| 제보 생성 API 지연 | A는 합의된 DTO와 fixture로 목록 화면 구현 |
| Worker 지연 | B는 알림 대상 계산과 job payload 생성까지만 구현 |
| Railway 지연 | 로컬 E2E, seed, 오류 응답과 데모 스크립트 작성 |

차단이 반나절을 넘으면 기능을 임시 mock으로 연결하되, mock 제거 조건과 담당자를 PR에 기록한다.

## 10. MVP 범위 조정

일정이 밀리면 다음 순서로 제외한다.

1. 첨부파일 업로드·정제·삭제
2. 알림 수동 재시도 화면
3. 제품 분석 이벤트
4. 고급 검색과 다중 필터
5. 중복 병합 취소 UI
6. 프로젝트 생성 UI — seed로 대체

다음 기능은 제외하지 않는다.

- Discord `/bug` 제보 저장
- 로그인과 조직·프로젝트 권한
- 제보 목록과 상세
- 최소 상태 변경
- 중복 병합
- 수정 빌드와 Discord 알림

## 11. 최종 완료 기준

### 코드 품질

- [ ] `pnpm lint`가 통과한다.
- [ ] `pnpm typecheck`가 통과한다.
- [ ] `pnpm test`가 통과한다.
- [ ] `pnpm build`가 통과한다.
- [ ] 실제 secret이 Git 이력에 없다.

### 핵심 기능

- [ ] 같은 Discord 요청으로 제보가 두 번 생성되지 않는다.
- [ ] 조직 외 사용자가 프로젝트 데이터에 접근하지 못한다.
- [ ] 목록·상세·상태 이력·중복 관계를 확인할 수 있다.
- [ ] 잘못된 상태 변경과 중복 병합이 거부된다.
- [ ] 수정 완료 시 대표·중복 제보자에게 알림이 한 번씩 전송된다.

### 운영 확인

- [ ] Railway Web과 Worker가 실행된다.
- [ ] 운영 DB migration이 적용된다.
- [ ] 실제 Discord에서 `/bug → 목록 → 상세 → 병합 또는 상태 변경 → 수정 알림`을 시연한다.
- [ ] A와 B가 상대 담당 기능을 로컬에서 한 번 이상 검증한다.

## 12. 시작 기준 요약

```text
8월 9~10일
A: 환경설정 10단계 완료와 PR 병합
B: 계약·테스트 사례 확정, 공용 코드 수정 금지

T0 다음 작업일
B: feat/shared-contracts 시작
A: 계약 리뷰와 외부 서비스 접근 인계

PR 1 병합 후
B: DB·도메인 기반
A: 인증·권한 기반

PR 2 병합 후
A와 B가 각 기능을 API·화면·테스트까지 병렬 개발
```

핵심 원칙은 **A의 환경설정을 하루 안에 깨끗하게 인계받고, 그다음부터 공통 계약과 첫 migration은 B가 선행하며, 이후 기능 단위로 병렬화하는 것**이다.
