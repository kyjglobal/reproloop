# ReproLoop 인원 B 기능 개발 세부 계획

> 작성 기준: 2026-08-13, `main` 커밋 `1498e4d`
> 원본 계획: [ReproLoop 2인 개발 작업분담 실행 계획](./ReproLoop_2인_개발_작업분담_계획.md)
> 구현 계약: [ReproLoop B 담당 PR 1·2 구현 명세](./ReproLoop_B_PR1_PR2_구현명세.md)
> 목적: 각 작업 ID 하나만 전달해도 구현, 테스트, 인계까지 독립적으로 수행할 수 있게 B 담당 범위를 나눈다.

## 목차

### 핵심 개발 단계

| 순서 | 단계 | 무엇을 끝내는가 | 작업 ID | 관련 PR |
|---:|---|---|---|---|
| 0 | [전체 지도](#overview) | 현재 상태와 전체 진행 순서 확인 | - | - |
| 1 | [착수 준비](#phase-1) | 환경·권한·미정 정책·migration 경로 확정 | `B-00-*` | 없음 |
| 2 | [DB·도메인 기반](#phase-2) | schema, migration, DB client·repository 완성 | `B-DB-*` | PR 2R |
| 3 | [Discord `/bug` 접수](#phase-3) | 서명 검증, modal, 멱등 제보 저장 | `B-DIS-*` | PR 3 |
| 4 | [제보 상세·상태 이력](#phase-4) | 상세 API, 이력 query, 상세 화면 완성 | `B-DET-*` | PR 4 |
| 5 | [중복 병합·취소](#phase-5) | 대표 검색, 병합·취소 API/UI 완성 | `B-DUP-*` | PR 5 |
| 6 | [알림 대상 연동](#phase-6) | 대표·중복 제보자의 알림 대상 계산 | `B-NOT-*` | PR 6 |
| 7 | [E2E·운영 검증](#phase-7) | 전체 자동 테스트와 실제 환경 검증 | `B-E2E-*` | PR 7 |

### 협업·완료 기준

- [A와의 접점·충돌 방지](#appendix-a)
- [작업별 공통 완료 정의](#appendix-b)
- [매일 실행·보고 형식](#appendix-c)
- [일정 압축 시 우선순위](#appendix-d)
- [최종 B 인계물](#appendix-e)

### 읽는 순서

1. 먼저 [전체 진행 지도](#progress-map)에서 현재 단계를 찾는다.
2. 해당 단계의 `목표 → 시작 조건 → 작업 ID → 종료 조건`을 확인한다.
3. 상세 작업은 작업 ID 하나씩 위에서 아래로 수행한다.
4. 작업이 끝날 때마다 [공통 완료 정의](#appendix-b)를 확인한다.

<a id="overview"></a>

## 0. 한눈에 보는 전체 지도

### 0-1. 현재 기준선

원본 계획의 Day 1과 Day 3 일부는 이미 구현되어 있다. 완료된 작업을 다시 만들지 않고 아래 기준에서 이어서 진행한다.

| 구분 | 현재 상태 | 처리 원칙 |
|---|---|---|
| 공통 enum·Zod·API 응답·job 계약 | 완료 | `packages/shared`를 단일 원본으로 유지한다. 계약 변경이 필요하면 기능 PR과 분리한다. |
| 상태 전이·역할 권한·중복 병합·알림 대상 도메인 규칙 | 완료 | `packages/domain`의 함수를 API에서 재사용하고 규칙을 복제하지 않는다. |
| 공통·도메인 자동 테스트 | 완료 | 현재 Shared 10개, Domain 28개 테스트를 회귀 기준으로 삼는다. |
| Drizzle schema·첫 migration | 부분 완료 | 현재 스키마는 MVP 계약보다 작고 상태 enum도 불일치한다. 먼저 보정한다. |
| DB client·repository 구현 | 미구현 | 환경변수를 import 시점에 읽지 않는 factory와 실제 Drizzle repository가 필요하다. |
| Discord `/bug` | 미구현 | 서명 검증, PING, modal, 멱등 저장을 구현한다. |
| 제보 상세·상태 이력 화면 | 미구현 | A의 인증 helper와 프로젝트 접근 검사를 사용한다. |
| 중복 병합·취소 API/UI | 미구현 | 기존 Domain 판단 함수와 낙관적 잠금을 사용한다. |
| 대표·중복 제보자 알림 대상 DB 조회 | 미구현 | B가 조회·중복 제거까지 제공하고 A의 알림 생성·Worker에 인계한다. |
| 핵심 E2E·운영 Discord 검증 | 미구현 | 로컬 자동화 후 실제 Discord·Railway smoke test를 수행한다. |

현재 가장 먼저 해결할 불일치는 다음과 같다.

```text
현재 DB enum:       new, triaged, in_progress, fixed, closed, duplicate
승인된 공통 계약:  new, needs_info, investigating, reproduced, fixed, duplicate
```

또한 현재 `packages/db/src/schema.ts`에는 `users`, `organization_members`, `discord_guilds`, `notifications`, `product_events`와 제보의 `version`, `canonical_report_id`, `discord_interaction_id` 등 핵심 필드가 없다.

### 0-2. 반드시 지킬 실행 원칙

1. 각 작업은 아래 작업 ID 단위로 수행한다. 한 번에 여러 PR 범위를 섞지 않는다.
2. 외부 입력은 `@reproloop/shared` Zod 스키마를 통과한 뒤에만 사용한다.
3. 상태·권한·병합 판단은 `@reproloop/domain`에서만 한다.
4. 생성·상태 변경·병합처럼 여러 행을 바꾸는 작업은 DB transaction 하나로 처리한다.
5. `expectedVersion`을 SQL `WHERE` 조건에도 넣어 실제 낙관적 잠금을 보장한다. 영향 행이 0개면 `CONFLICT`로 처리한다.
6. Discord ID는 `text`, 내부 ID는 UUID, 시각은 `timestamptz`를 사용한다.
7. migration은 한 시점에 B만 생성한다. 이미 적용된 migration 파일은 수정하지 않는다.
8. API route는 인증·입력 검증·서비스 호출·응답 변환만 담당한다.
9. 실제 secret, Discord 요청 본문, 버그 원문을 로그나 fixture에 남기지 않는다.
10. 각 PR 전 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 실행한다.

<a id="progress-map"></a>

### 0-3. 단계별 진행 지도

```text
B-00 착수 점검·결정 잠금
  → PR 2R DB·도메인 기반 완성
  → PR 3 Discord /bug 접수
  → PR 4 제보 상세·상태 이력
  → PR 5 중복 병합·취소
  → PR 6 알림 대상 연동
  → PR 7 핵심 E2E·운영 검증
```

| 상태 | 단계 | 관련 PR·브랜치 | 핵심 산출물 | 시작 조건 |
|:---:|---|---|---|---|
| **완료 (4/4)** | 1단계 | PR 없음 | 결정 기록, 환경 접근 확인, 기준선 검사 | A의 환경 인계 |
| **다음 작업** | 2단계 | PR 2R — `feat/report-domain-foundation` 또는 `fix/db-contract-alignment` | 완전한 schema, migration, DB client·repository | 1단계 완료 |
| 대기 | 3단계 | PR 3 — `feat/discord-bug-submit` | 서명 검증, `/bug` modal, 멱등 제보 저장 | 2단계 완료, Discord 접근 |
| 대기 | 4단계 | PR 4 — `feat/report-detail` | 상세 API, 이력 조회, 상세 화면 | 2단계 완료, A의 인증 helper |
| 대기 | 5단계 | PR 5 — `feat/duplicate-merge` | 대표 검색, 병합·취소 서비스/API/UI | 4단계 완료, transition route 합의 |
| 대기 | 6단계 | PR 6 — `feat/duplicate-recipients` | 대표·중복 제보자 조회와 알림 payload 연동 | 5단계 완료, A의 Worker job 계약 |
| 대기 | 7단계 | PR 7 — `test/core-e2e` | 자동 통합 테스트, 운영 smoke 기록 | 3~6단계와 A의 P0 기능 완료 |

1단계는 2026-08-14에 완료했다. 현재 시작점은 **2단계 DB·도메인 기반 완성**이다. 세부 결과는 [B 1단계 착수 점검 보고서](./B-1단계_착수_점검_보고서.md)에 기록한다.

<a id="phase-1"></a>

## 1단계. 착수 준비와 결정 잠금

| 구분 | 내용 |
|---|---|
| 목표 | 구현 전에 필요한 접근 권한, 정책, migration 처리 경로를 확정한다. |
| 작업 ID | `B-00-01` ~ `B-00-04` |
| 시작 조건 | A가 환경설정 결과와 외부 서비스 접근을 인계한다. |
| 주요 산출물 | 기준선 검사 결과, 의존 항목 목록, 정책 결정 기록 |
| 종료 조건 | 네 작업이 모두 끝나고 2단계의 migration 경로가 하나로 결정된다. |

### B-00-01. 저장소 기준선 확인

> 상태: **완료 — 2026-08-13**

- 실행: 최신 `main` 동기화, frozen install, 루트 4대 검사, `git status` 확인
- 기록: 시작 커밋, Node·pnpm 버전, 실패한 검사와 담당자
- 완료 기준: 깨끗한 worktree에서 기존 검사가 통과하거나, 기존 실패가 별도 이슈로 분리되어 담당자가 정해짐

### B-00-02. A에게 받을 의존 항목 확인

> 상태: **완료 — 2026-08-14, Supabase DB·Storage와 Discord Application 접근 확인**

- Supabase 개발 DB 접근과 `DATABASE_URL`
- 초기 migration의 실제 DB 적용 여부와 적용 환경
- Discord Application 개발자 권한, 테스트 guild·channel, public key
- `requireProjectMember`의 입력·출력·오류 형식
- 프로젝트·빌드 조회 API의 경로와 응답 형태
- 알림 Worker의 job 이름, payload, enqueue 방식
- `apps/web` 공용 layout·navigation·전역 CSS 당일 소유자
- 완료 기준: 값 자체는 비밀 채널에만 있고, 코드에는 필요한 환경변수 이름만 남아 있음

### B-00-03. 미정 정책 확정

> 상태: **완료 — 아래 권장 기본안을 MVP 구현 기준으로 확정**

다음 기본안을 A와 확인하고 결정 문서 또는 PR 설명에 남긴다.

| 항목 | 권장 기본안 | 이유 |
|---|---|---|
| `/bug` 프로젝트·빌드 선택 | slash command의 필수 option과 autocomplete로 먼저 선택 | modal의 5개 입력칸을 제보 내용에 모두 사용하면서 한 guild의 다중 프로젝트를 지원할 수 있음 |
| 접수 응답 | 제보자에게만 보이는 ephemeral 응답 | 버그 원문과 내부 번호의 불필요한 채널 노출 방지 |
| 첨부 파일 | 이번 MVP에서 제외 | 원본 계획의 범위 조정 원칙 준수 |
| Discord DM 실패 대체 채널 | MVP에서는 자동 대체 없음 | 개인정보 노출 가능성이 있어 실패 상태만 기록하고 후속 범위로 둠 |

### B-00-04. migration 처리 경로 결정

> 상태: **완료 — 2026-08-14, 경로 B(기존 migration 보존 + 새 보정 migration) 확정**

- `0000_military_omega_flight.sql`이 어느 공유 DB에도 적용되지 않았다면: schema를 계약에 맞춘 뒤 초기 migration과 metadata를 재생성한다.
- 하나의 공유 DB라도 적용됐다면: 기존 `0000`을 보존하고 새 migration을 만든다.
- 기존 데이터가 있다면 상태 변환은 `triaged → needs_info`, `in_progress → investigating`를 기본으로 하며, `closed` 행은 자동 추정하지 않고 A가 각 행의 `fixed` 전환 가능 여부를 확인한다.
- 완료 기준: PR 본문에 선택한 경로, 적용 환경, rollback 주의사항이 명시됨

<a id="phase-2"></a>

## 2단계. DB·도메인 기반 완성

| 구분 | 내용 |
|---|---|
| 목표 | 공통 계약과 일치하는 DB schema, migration, repository를 완성한다. |
| 작업 ID | `B-DB-01` ~ `B-DB-07` |
| 관련 PR | PR 2R — `feat/report-domain-foundation` 또는 `fix/db-contract-alignment` |
| 시작 조건 | 1단계 완료, 기존 migration 적용 여부 확인 |
| 주요 산출물 | 전체 schema, migration, `createDatabase`, repository·command |
| 종료 조건 | A의 개발 DB에 migration을 적용하고 DB·Domain 회귀 검사가 통과한다. |

### B-DB-01. schema 구조와 enum 정렬

- 대상: `packages/db/src/schema/**`, `packages/db/src/index.ts`
- 작업:
  - 현재 단일 `schema.ts`를 기능별 파일로 나누되 public export 이름을 명세와 맞춘다.
  - `report_status`를 Shared 계약의 6개 값과 일치시킨다.
  - 조직 역할, 상태 event, 알림 종류·상태 등 DB enum도 Shared 값과 일치시킨다.
  - `users`, `organizations`, `organizationMembers`, `discordGuilds`, `gameProjects`, `builds`, `bugReports`, `attachments`, `statusEvents`, `notifications`, `productEvents`를 정의한다.
  - 모든 주요 테이블에 필요한 `createdAt`, `updatedAt`, soft delete, FK 삭제 정책을 명시한다.
- 완료 기준: 명세의 `@reproloop/db` 공개 export를 루트에서 import할 수 있고, enum 값 비교 테스트가 통과함

### B-DB-02. 제약·인덱스·멱등성 정의

- `discord_interaction_id` unique: 같은 Discord modal submit의 중복 저장 방지
- `(project_id, report_number)` unique: 프로젝트 안의 `BUG-n` 식별자 보장
- `(organization_id, user_id)` unique: 조직 멤버 중복 방지
- `(project_id, version)` unique: 빌드 버전 중복 방지
- notification `idempotency_key` unique: Worker 재시도 중복 전송 방지
- 프로젝트·상태·생성시각, canonical report, build에 필요한 인덱스 추가
- `bug_reports`에 `version`, `canonical_report_id`, `fixed_build_id`, `resolved_at`, `deleted_at` 추가
- `status_events`에 `event_type`, actor, 이전·이후 상태, note와 병합 직전 상태를 복원할 metadata 추가
- 완료 기준: 중복 Interaction과 중복 notification key insert가 DB 제약으로 실패하고, 계획된 조회가 인덱스를 사용할 수 있음

### B-DB-03. DB 생성 factory 구현

- 대상: `packages/db/src/client.ts`, `packages/db/src/index.ts`
- 구현: `createDatabase(databaseUrl)`와 `Database` 타입
- 금지: package import 시 `process.env`를 읽거나 연결하는 singleton `db`
- 종료 처리: 테스트와 Worker 종료 때 connection을 닫을 수 있는 인터페이스 제공
- 완료 기준: Web·Worker smoke test에서 각자 검증한 URL로 DB 인스턴스를 생성할 수 있음

### B-DB-04. migration 생성·검증

- B-00-04의 경로에 따라 Drizzle migration과 metadata 생성
- 빈 DB 적용, 동일 DB 재실행 시 동작, 실패 시 부분 적용 여부 확인
- 실제 개발 DB 적용은 A가 수행하고 B가 결과를 확인
- 완료 기준: 빈 PostgreSQL에 migration 적용 후 모든 테이블·enum·unique/FK가 존재하며 schema diff가 0임

### B-DB-05. ReportRepository의 Drizzle 구현

- 대상 권장: `packages/db/src/repositories/drizzle-report-repository.ts`
- 구현 항목:
  - `findById`
  - `listCanonicalAncestorIds`
  - `listRelatedReporterDiscordUserIds`
  - `transaction`과 `ReportTransaction.updateReport`, `addStatusEvent`
  - `updateReport`의 `WHERE id = ? AND version = ?` 검사
- Domain interface가 실제 상세·생성 기능과 섞이지 않도록, Discord 생성과 상세 조회용 query/command 함수는 별도 모듈로 둔다.
- 완료 기준: Domain이 Drizzle을 import하지 않고, repository adapter의 통합 테스트가 실제 PostgreSQL에서 통과함

### B-DB-06. 제보 생성 command 구현

- 대상 권장: `packages/db/src/reports/create-bug-report.ts`
- 한 transaction에서 처리:
  1. guild·project·build 연결과 활성 상태 확인
  2. Interaction ID 중복 확인
  3. 프로젝트별 report number 발급
  4. `bug_reports` insert
  5. `report_created` status event insert
- 경쟁 요청은 사전 조회만 믿지 않고 unique constraint를 최종 안전장치로 사용한다.
- 같은 Interaction의 재시도에는 기존 제보 식별자를 반환하고 새 이력을 만들지 않는다.
- 완료 기준: 동시 또는 연속 중복 제출 테스트에서 제보와 생성 이력이 각각 한 건뿐임

### B-DB-07. DB·도메인 회귀 테스트

- 기존 `ST-*`, `DM-*` ID를 테스트 이름에 유지
- 추가 필수 테스트:
  - schema enum과 Shared enum의 완전 일치
  - stale version update가 0행이며 `CONFLICT`
  - transaction 중 event insert 실패 시 report 변경 rollback
  - 다른 프로젝트 build·canonical report 거부
  - soft-deleted report 조회·병합 제외
- 완료 기준: package 검사와 루트 4대 검사 통과, A의 개발 DB migration 확인 완료

<a id="phase-3"></a>

## 3단계. Discord `/bug` 접수

| 구분 | 내용 |
|---|---|
| 목표 | 실제 Discord 요청을 검증하고 동일 제보를 DB에 한 번만 저장한다. |
| 작업 ID | `B-DIS-01` ~ `B-DIS-05` |
| 관련 PR | PR 3 — `feat/discord-bug-submit` |
| 시작 조건 | 2단계 완료, Discord Application·테스트 guild 접근 가능 |
| 주요 산출물 | interaction route, 서명 검증, modal, 멱등 저장 테스트 |
| 종료 조건 | 테스트 guild에서 `/bug` 제출과 중복 요청 방지가 확인된다. |

### B-DIS-01. Discord interaction 경계 모듈 작성

- 대상 권장:
  - `apps/web/src/app/api/discord/interactions/route.ts`
  - `apps/web/src/server/discord/verify-request.ts`
  - `apps/web/src/server/discord/interaction-parser.ts`
- raw request body, `X-Signature-Ed25519`, `X-Signature-Timestamp`로 서명 검증
- body parse 전에 서명을 검증하고 잘못된 서명·누락 header는 401 처리
- `PING`은 Discord 규격의 `PONG`으로 응답
- 완료 기준: 공식 방식으로 생성한 정상 서명은 통과하고 본문·timestamp 변조와 header 누락은 거부됨

### B-DIS-02. `/bug` 명령·autocomplete·modal 흐름 구현

- B-00-03에서 확정한 project·build 선택 방식을 사용
- guild에서 접근 가능한 project만, 선택한 project의 활성 build만 후보로 반환
- `/bug` 실행 시 5개 필드의 modal을 반환하고 custom ID를 상수로 관리
- modal 필드는 `DiscordBugModalInputSchema` 제한과 동일하게 맞춤
- 완료 기준: 테스트 guild에서 `/bug` 실행 → project/build 선택 → modal 표시가 성공함

### B-DIS-03. modal submit을 command로 변환

- Discord component tree를 안전하게 순회해 5개 필드를 추출
- Discord가 제공한 reporter/guild/channel/interaction ID와 사전 선택 project/build를 서버가 조합
- `CreateBugReportCommandSchema`로 최종 검증
- client가 보낸 project/build가 guild 연결과 맞는지 DB에서 다시 검증
- 완료 기준: 필드 누락·초과 길이·다른 guild의 project/build가 저장 전에 거부됨

### B-DIS-04. 멱등 저장과 응답 연결

- B-DB-06 command를 호출해 제보와 최초 event를 transaction으로 저장
- 성공 시 `BUG-{reportNumber}`를 포함한 ephemeral 응답 반환
- 동일 Interaction 재전송 시 기존 번호를 반환하고 2건째를 만들지 않음
- 내부 DB 오류는 사용자에게 일반화된 메시지만 반환하고 request ID로 서버 로그를 연결
- 완료 기준: 같은 요청 2회 전송 시 Discord 응답은 성공하고 DB 제보는 1건임

### B-DIS-05. Discord route 테스트

- PING 성공
- 잘못된 서명·변조된 body·오래된 timestamp 정책 검증
- 알 수 없는 interaction type 처리
- command와 modal custom ID 불일치 거부
- modal validation error
- 같은 Interaction ID 중복 방지
- 완료 기준: 외부 Discord 호출 없이 fixture 테스트가 통과하고, 실제 테스트 guild smoke test를 PR에 기록함

<a id="phase-4"></a>

## 4단계. 제보 상세·상태 이력

| 구분 | 내용 |
|---|---|
| 목표 | 로그인한 프로젝트 멤버가 제보 원문과 처리 이력을 확인하게 한다. |
| 작업 ID | `B-DET-01` ~ `B-DET-05` |
| 관련 PR | PR 4 — `feat/report-detail` |
| 시작 조건 | 2단계 완료, A의 `requireProjectMember` 사용 가능 |
| 주요 산출물 | 상세 계약·query·API·화면·테스트 |
| 종료 조건 | `목록 → 상세` 흐름과 조직 외 접근 차단이 확인된다. |

### B-DET-01. 상세 응답 계약 확정

- 목록 기본 정보, 입력 원문, 발생 build, canonical report, fixed build, attachment metadata, status event를 포함한 응답 DTO를 정의
- 값이 없을 수 있는 관계는 `null`, 응답 자체에서 생략할 수 있는 확장 필드만 optional로 구분
- API 응답은 `{ data: detail }` envelope를 사용
- Shared 변경이 필요하면 기능 코드보다 먼저 작은 계약 PR로 병합
- 완료 기준: 응답 fixture가 Zod schema를 통과하고 미등록 필드를 거부함

### B-DET-02. 상세 query 구현

- 대상 권장: `packages/db/src/reports/get-report-detail.ts`
- 제보, build, canonical/fixed 관계, attachment metadata, 상태 이력을 조회
- 상태 이력은 `createdAt`, 안정적인 보조 키 순으로 정렬
- soft-deleted 제보는 `NOT_FOUND`
- route에 넘기기 전에 DB row를 명시적인 DTO로 매핑
- 완료 기준: 정상·관계 없음·삭제됨·다른 프로젝트 접근의 통합 테스트 통과

### B-DET-03. 상세 API 구현

- 경로: `GET /api/v1/reports/{reportId}`
- A의 `requireProjectMember`를 사용해 report의 project 접근 권한 확인
- UUID route param 검증, 401/403/404를 구분하고 공통 오류 envelope 사용
- `report_viewed` 제품 event는 P0 완료 후 추가하며 버그 원문은 event payload에 넣지 않음
- 완료 기준: 조직 멤버만 상세를 조회하고 조직 외 사용자는 데이터 존재 여부를 추측할 수 없는 응답을 받음

### B-DET-04. 상세·상태 이력 화면 구현

- 대상: A와 합의한 `apps/web/src/app`의 report 상세 route 폴더
- 표시: 번호·제목·상태·심각도·build·제보자·입력 5개 필드·환경·canonical/fixed 정보·시간순 이력
- loading, empty, not-found, forbidden, server-error 상태를 각각 처리
- 사용자 입력은 일반 텍스트로 렌더링하고 HTML로 주입하지 않음
- 반응형에서 긴 재현 단계와 Discord 이름이 layout을 깨지 않게 처리
- 완료 기준: 목록에서 상세로 이동하고 새로고침해도 동일 내용을 볼 수 있음

### B-DET-05. 상세 기능 테스트

- API: 인증 없음, 멤버 아님, 정상 상세, 삭제 제보, 이력 정렬
- UI: nullable 필드, 긴 본문, 이력 없음, 대표 제보 링크
- 완료 기준: API 통합 테스트와 주요 UI component 테스트 또는 수동 검증표가 PR에 포함됨

<a id="phase-5"></a>

## 5단계. 중복 병합·취소

| 구분 | 내용 |
|---|---|
| 목표 | 같은 프로젝트의 제보를 안전하게 대표 제보에 병합하고 복원한다. |
| 작업 ID | `B-DUP-01` ~ `B-DUP-06` |
| 관련 PR | PR 5 — `feat/duplicate-merge` |
| 시작 조건 | 4단계 완료, A와 transition route 소유권 합의 |
| 주요 산출물 | 대표 검색, 병합·취소 service/API/UI |
| 종료 조건 | 정상 병합·취소와 자기 참조·순환·stale version 거부가 확인된다. |

### B-DUP-01. 대표 제보 검색 query 구현

- 같은 프로젝트 안에서 검색하고 자기 자신과 soft-deleted report를 제외
- canonical 후보는 `duplicate`가 아닌 제보만 반환
- 결과에 ID, `BUG-n`, 제목, 상태, build, 생성 시각을 포함
- A의 목록 API를 재사용할 수 있으면 query 옵션만 합의하고, 불가능하면 상세 화면 전용 endpoint를 계약에 추가
- 완료 기준: 다른 프로젝트·중복·삭제·자기 자신이 후보에 나타나지 않음

### B-DUP-02. 병합 transaction service 구현

- target, canonical, actor role, version을 읽고 `validateDuplicateMerge` 호출
- transaction 안에서 version 조건부 update와 `duplicate_merged` event insert
- event metadata에 병합 직전 상태와 canonical ID를 저장
- 검증과 update 사이 경쟁이 발생하면 조건부 update 실패를 `CONFLICT`로 변환
- 완료 기준: 자기 참조, 프로젝트 불일치, 중복을 대표로 선택, 순환, stale version, member 권한이 모두 DB 변경 없이 거부됨

### B-DUP-03. 병합 취소 transaction service 구현

- 가장 최근의 유효한 `duplicate_merged` event에서 병합 직전 상태를 읽음
- client가 복원 상태를 지정하지 못하게 함
- `validateDuplicateUnmerge` 후 status와 canonical ID를 원자적으로 복원하고 `duplicate_unmerged` event 추가
- 완료 기준: 직전 상태 복원, stale version, 이력 누락, 이미 취소된 제보 테스트 통과

### B-DUP-04. transition API에 중복 action 연결

동시 수정 충돌을 피하기 위해 route와 handler를 분리한다.

- A 또는 먼저 병합된 공통 PR: `transitions/route.ts`의 Zod 검증·인증·action dispatcher
- B 소유 모듈: `merge-duplicate`와 `unmerge-duplicate` handler/service
- A의 상태 변경 PR이 먼저 병합되면 B가 최신 `main`에 rebase한 뒤 두 action만 등록
- B의 PR이 먼저 준비되면 handler를 먼저 병합하고 route 등록은 A의 dispatcher 병합 뒤 작은 후속 커밋으로 처리
- 완료 기준: 하나의 endpoint가 Shared의 `ReportTransitionSchema`를 사용하며 route에 병합 규칙이 복제되지 않음

### B-DUP-05. 대표 검색·병합 UI 구현

- 상세 화면에서 owner/admin에게만 병합 control 표시
- 검색 결과에서 후보를 선택하고 현재 `version`과 함께 요청
- 성공 시 상태, canonical 링크, 이력, version을 갱신
- 409에는 최신 상세를 다시 불러오도록 안내
- member에게 버튼을 숨기되 서버 권한 검사를 반드시 유지
- 완료 기준: 상세 화면에서 검색 → 확인 → 병합이 가능하고 잘못된 대상·경쟁 수정 오류가 이해 가능한 메시지로 표시됨

### B-DUP-06. 병합 취소 UI 구현

- 원본 계획상 일정 지연 시 잘릴 수 있는 첫 B UI이므로 backend 완성 후 착수
- duplicate 상세에서 owner/admin에게만 취소 버튼과 확인 dialog 제공
- 복원 상태는 서버 응답을 사용
- 완료 기준: 취소 후 병합 직전 상태와 이력이 화면에 반영됨

<a id="phase-6"></a>

## 6단계. 대표·중복 제보자 알림 대상 연동

| 구분 | 내용 |
|---|---|
| 목표 | 대표 버그가 수정될 때 관련된 모든 고유 제보자를 정확히 계산한다. |
| 작업 ID | `B-NOT-01` ~ `B-NOT-04` |
| 관련 PR | PR 6 — `feat/duplicate-recipients` |
| 시작 조건 | 5단계 완료, A의 notification·Worker job 계약 확정 |
| 주요 산출물 | recipient query, idempotency 입력, 연동 테스트 |
| 종료 조건 | 대표·중복 제보자가 실제 Discord 알림을 각각 한 번만 받는다. |

### B-NOT-01. 관련 제보자 DB 조회 구현

- 입력이 canonical report면 자기 자신과 직접 연결된 duplicate report의 reporter ID 조회
- 입력이 duplicate report면 canonical ID를 먼저 확인한 뒤 같은 집합 조회
- soft-deleted report와 빈 ID 제외
- 반환 전 `collectNotificationRecipientIds`로 중복 제거
- 완료 기준: 대표·중복에 같은 사용자가 반복되어도 Discord ID가 한 번만 반환됨

### B-NOT-02. 알림 생성 입력 계약 인계

- A에게 제공: canonical report ID, 관련 report ID, recipient Discord user ID의 중복 제거된 목록
- A의 `mark_fixed` transaction 안에서 recipient별 notification과 job/outbox를 생성하도록 연결
- idempotency key 구성요소를 `eventId + notificationType + recipientId`로 고정
- B는 Discord 전송 로직을 구현하지 않고 A의 Worker job payload 계약을 사용
- 완료 기준: 대표 제보 수정 시 대표·중복 제보자 수만큼 notification이 생성되고 동일 recipient 중복은 없음

### B-NOT-03. 알림 대상 통합 테스트

- 대표만 있는 경우
- 중복 제보 여러 건
- 같은 reporter가 여러 제보 제출
- duplicate ID로 조회 시작
- soft-deleted 중복 제보
- 동일 event 재시도 시 unique key 충돌로 추가 생성 방지
- 완료 기준: A의 Worker를 mock한 상태에서 정확한 payload 목록이 만들어짐

### B-NOT-04. A와 실제 Worker 연동 확인

- A의 `NotificationSendJobV1Schema` 사용 여부 확인
- sent notification 재처리 방지와 실패 attempt 증가 확인
- 실제 테스트 Discord 계정에 한 번만 도착하는지 확인
- 완료 기준: 대표·중복 제보자가 각각 정확히 한 번 알림을 받고 DB 상태가 `sent`로 바뀜

<a id="phase-7"></a>

## 7단계. 핵심 E2E와 운영 검증

| 구분 | 내용 |
|---|---|
| 목표 | B 담당 기능과 A 담당 기능이 연결된 MVP 전체 흐름을 검증한다. |
| 작업 ID | `B-E2E-01` ~ `B-E2E-06` |
| 관련 PR | PR 7 — `test/core-e2e` |
| 시작 조건 | 3~6단계와 A의 인증·목록·상태·Worker P0 기능 완료 |
| 주요 산출물 | seed, 자동 통합 테스트, Discord·Railway smoke 기록 |
| 종료 조건 | 실제 환경에서 전체 데모가 성공하고 최종 회귀 검사가 통과한다. |

### B-E2E-01. 테스트 fixture·seed 준비

- 조직 2개, 사용자 역할 owner/admin/member, 프로젝트 2개, guild 1개 이상, active build, 일반·중복 제보를 최소 세트로 구성
- 고정 secret이나 실제 사용자 ID를 커밋하지 않음
- 반복 실행 시 기존 fixture와 충돌하지 않게 고유 namespace 또는 정리 전략 사용
- 완료 기준: 로컬 DB에서 동일 seed를 반복 적용해도 예측 가능한 상태가 됨

### B-E2E-02. Discord 접수 통합 시나리오 자동화

```text
서명된 /bug 요청 → modal 응답
→ 서명된 modal submit → 제보 생성
→ 같은 submit 재전송 → 동일 제보 반환
→ DB 제보 1건 + report_created 이력 1건 확인
```

- 실제 private key를 저장하지 않고 테스트용 key pair를 런타임에 사용
- 완료 기준: CI에서 외부 Discord 없이 재현 가능

### B-E2E-03. 상세·병합 통합 시나리오 자동화

```text
owner 로그인 → 상세 조회 → 대표 후보 검색 → 병합
→ duplicate 상태·canonical 관계·event 확인
→ stale version 병합 재시도 409 확인
→ 병합 취소 후 직전 상태 복원 확인
```

- 조직 외 사용자 403/404 정책과 member 병합 거부도 포함
- 완료 기준: API와 DB 결과가 모두 일치함

### B-E2E-04. 알림 대상 시나리오 자동화

```text
대표 + 중복 제보 여러 건 준비
→ 대표를 fixed로 변경
→ 고유 recipient별 notification/job 생성 확인
→ Worker 재시도 fixture에서 중복 전송 없음 확인
```

- 완료 기준: 동일 recipient·event 조합당 notification과 전송이 각각 한 번임

### B-E2E-05. 실제 Discord·Railway smoke test

- 실제 guild에서 `/bug` 제출
- Railway Web에서 로그인 후 목록(A) → 상세(B) 확인
- 중복 병합(B) 또는 상태 변경(A)
- 수정 build 등록(A) 후 대표·중복 제보자 알림 확인
- request ID, report number, notification 결과만 기록하고 본문·token은 남기지 않음
- 완료 기준: 전체 흐름을 한 번 성공시키고 A와 B가 상대 담당 기능을 각 1회 확인함

### B-E2E-06. 최종 회귀와 결함 정리

- 루트 4대 검사와 migration dry run 수행
- secret scan과 `git status` 확인
- P0 결함은 수정, P1은 재현 절차·예상 동작·후속 담당자를 기록
- 완료 기준: 최종 완료 체크리스트를 모두 갱신하고 데모 순서를 문서화함

<a id="appendix-a"></a>

## 부록 A. A와의 접점·충돌 방지표

| 접점 | A가 제공 | B가 제공 | 병합 규칙 |
|---|---|---|---|
| 인증·권한 | `requireProjectMember`와 actor role | 상세·병합 route에서 사용 결과 | B가 별도 세션 파서를 만들지 않음 |
| 프로젝트·빌드 | 접근 가능한 목록 API·query | `/bug` 선택 흐름의 요구 필드 | 응답 계약부터 합의 |
| 제보 목록 | 목록 route·화면 | 상세 링크와 canonical 후보 조건 | 목록 DTO 변경은 별도 계약 커밋 |
| 상태 transition route | 공통 dispatcher와 일반 action | 병합·취소 handler | 같은 `route.ts` 동시 수정 금지 |
| DB migration | 적용 환경과 결과 | schema·migration 파일 | 한 시점에 B만 migration 생성 |
| 알림 | notification 생성·queue·Worker | 관련 recipient query | payload schema로만 연결 |
| 공용 UI | layout·navigation 소유 | 상세 route 내부 UI | 당일 공용 파일 소유자 1명 |

A의 의존 작업이 지연될 때는 다음처럼 진행한다.

- 인증 지연: `Actor` fixture와 `requireProjectMember` 호환 interface로 API service 테스트
- Discord 키 지연: 테스트 key pair로 서명·파싱 자동 테스트
- Supabase 지연: 로컬 PostgreSQL에 migration·repository 통합 테스트
- 목록 API 지연: 합의한 DTO fixture로 상세 링크·화면 구현
- Worker 지연: recipient 계산과 job payload 생성까지만 구현
- Railway 지연: 로컬 E2E와 운영 smoke 절차 작성

<a id="appendix-b"></a>

## 부록 B. 작업별 공통 완료 정의

각 작업 ID는 아래 조건을 모두 충족해야 완료로 표시한다.

- [ ] 구현이 해당 작업의 대상 파일과 책임 범위를 벗어나지 않는다.
- [ ] 정상 경로와 최소 1개 실패 경로 테스트가 추가된다.
- [ ] 기존 Shared·Domain 테스트가 회귀하지 않는다.
- [ ] 입력 Zod 검증, Domain 판단, DB 저장의 경계가 분리되어 있다.
- [ ] 오류가 공통 API code와 envelope로 변환된다.
- [ ] secret·개인정보·버그 원문이 로그와 Git에 없다.
- [ ] migration·환경변수·계약 변경 여부가 PR 설명에 기록된다.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` 결과가 기록된다.
- [ ] A가 직접 확인할 한 가지 시나리오가 PR 설명에 있다.
- [ ] 후속 작업과 남은 mock 제거 조건이 기록된다.

<a id="appendix-c"></a>

## 부록 C. 매일 실행·보고 형식

### 시작

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c <branch-name>
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

### 일일 공유

```text
완료: [작업 ID] 병합 또는 검증한 결과
진행: [작업 ID] 현재 branch와 남은 하위 항목
차단: 필요한 결정, API, key, migration 적용 결과
다음: 다음에 바로 시작할 작업 ID와 첫 행동
```

<a id="appendix-d"></a>

## 부록 D. 일정 압축 시 우선순위

반드시 유지할 B 작업은 다음 순서다.

1. DB 계약 정렬과 migration
2. Discord 서명 검증과 멱등 `/bug` 저장
3. 제보 상세·상태 이력 API
4. 중복 병합 backend와 최소 UI
5. 대표·중복 제보자 알림 대상 계산
6. 핵심 API 통합 테스트와 실제 Discord smoke test

일정이 부족하면 다음 순서로 줄인다.

1. 병합 취소 UI만 제외하고 backend·테스트는 유지
2. 상세 화면의 부가 metadata 표현 축소
3. canonical 검색의 고급 필터 제거
4. UI 자동화 범위를 줄이고 API·DB 통합 테스트와 수동 smoke 기록으로 보완

첨부 파일, 제품 분석 event, 수동 알림 재시도 화면은 이 계획의 P0 구현 범위에 포함하지 않는다.

<a id="appendix-e"></a>

## 부록 E. 최종 B 인계물

- `@reproloop/shared` 공통 계약과 변경 이력
- 계약과 일치하는 전체 Drizzle schema·migration·적용 주의사항
- `createDatabase`와 ReportRepository Drizzle adapter
- Discord interaction route와 서명·멱등 테스트
- 제보 상세 API·화면·상태 이력
- 중복 병합·취소 service/API와 최소 UI
- 대표·중복 제보자 알림 대상 query와 테스트
- 핵심 E2E 결과, 실제 Discord·Railway smoke 기록
- A가 재사용할 import 예제와 남은 P1 목록

이 계획의 실행 완료 기준은 B 코드만 존재하는 것이 아니라, A의 인증·목록·상태 변경·Worker와 연결된 다음 흐름이 실제 환경에서 한 번 성공하는 것이다.

```text
/bug 제출 → 한 번만 저장 → 목록 → 상세 → 중복 병합
→ 대표 제보 수정 완료 → 모든 고유 제보자에게 알림 한 번
```
