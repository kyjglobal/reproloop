# B 2단계 DB·도메인 기반 완료 보고서

## 1. 한눈에 보는 결과

| 항목 | 결과 |
|---|---|
| 작업일 | 2026-08-16 |
| 작업 브랜치 | `feat/report-domain-foundation` |
| 기준 브랜치 | `main` |
| 완료 범위 | `B-DB-01` ~ `B-DB-07`, **7/7 완료** |
| 개발 DB migration | 적용 완료 |
| 다음 단계 | 3단계 Discord `/bug` 접수 |

2단계 종료 조건인 전체 schema, 보정 migration, DB factory, Drizzle repository, 멱등 제보 생성 command와 실제 PostgreSQL 회귀 검사를 모두 완료했다.

## 2. 단계별 완료 내용

### B-DB-01 · schema와 enum 정렬

- 단일 `packages/db/src/schema.ts`를 기능별 schema 모듈로 분리했다.
- MVP의 11개 테이블과 관계를 정의했다.
- `report_status`를 Shared 계약의 `new`, `needs_info`, `investigating`, `reproduced`, `fixed`, `duplicate`와 일치시켰다.
- DB package 루트에서 schema와 타입을 계속 import할 수 있도록 공개 export를 정리했다.

### B-DB-02 · 제약, 인덱스, 멱등성

- Discord interaction ID, 프로젝트별 report number, 빌드 버전, 조직 멤버, notification idempotency key에 unique 제약을 추가했다.
- 상태·생성 시각·대표 제보·빌드 조회용 인덱스를 추가했다.
- 낙관적 잠금을 위한 `bug_reports.version`과 병합·해결·soft delete 필드를 반영했다.

### B-DB-03 · DB 생성 factory

- `createDatabase(databaseUrl)`가 DB 인스턴스와 종료 함수 `close()`를 반환하도록 구현했다.
- package import 시 환경변수를 읽거나 연결하는 전역 singleton은 만들지 않았다.

### B-DB-04 · migration

- 기존 `0000_military_omega_flight.sql`을 보존하고 `0001_full_schema_alignment.sql` 보정 migration을 추가했다.
- 기존 bootstrap 테이블에 데이터가 있으면 migration이 중단되는 안전장치를 넣었다. 데이터가 있는 DB를 추정 변환하지 않는다.
- Drizzle Kit의 기존 schema rename 비교 과정에서 내부 오류가 발생해, 최종 schema로 생성한 전체 SQL과 snapshot을 기준으로 보정 migration을 구성했다.
- 생성 후 `db:generate`를 다시 실행하여 **추가 schema diff가 0**임을 확인했다.

개발 DB 적용 결과:

| 확인 항목 | 결과 |
|---|---:|
| 적용된 migration 수 | 2 |
| MVP 테이블 수 | 11 |
| `report_status` enum 값 수 | 6 |
| 기존 organization 데이터 | 0 |
| 기존 bug report 데이터 | 0 |

### B-DB-05 · ReportRepository

- 조회, 대표 제보 조상 탐색, 관련 제보자 조회를 구현했다.
- transaction 안에서 report 갱신과 status event 추가를 지원한다.
- `id + expectedVersion` 조건으로 갱신하고 stale version은 `CONFLICT`로 처리한다.

### B-DB-06 · 제보 생성 command

- guild·project·build 검증, 프로젝트별 번호 발급, report와 최초 event 저장을 한 transaction에서 처리한다.
- 프로젝트 단위 PostgreSQL advisory lock과 DB unique 제약을 함께 사용한다.
- 같은 Discord interaction의 재요청은 기존 report를 반환하며 report와 event를 추가하지 않는다.

### B-DB-07 · 회귀 테스트

- Shared enum과 DB enum의 일치 여부를 검사한다.
- 실제 PostgreSQL에서 중복 interaction, transaction rollback, stale version 충돌을 검증한다.
- 통합 테스트 fixture는 실행 후 삭제되며, 완료 뒤 개발 DB의 organization과 bug report가 모두 0건임을 확인했다.

## 3. 자동 검사 결과

| 검사 | 결과 |
|---|---|
| `corepack pnpm lint` | 통과 |
| `corepack pnpm typecheck` | 통과 |
| `corepack pnpm test` | 통과 — 일반 실행 42개 테스트 |
| DB 통합 테스트 | 통과 — DB package 7개 테스트 |
| `corepack pnpm build` | 통과 |
| Drizzle schema diff | 0 |

일반 `pnpm test`에서는 안전을 위해 `TEST_DATABASE_URL`이 없으면 DB 통합 테스트 3개를 건너뛴다. 아래 절차처럼 테스트 DB URL을 명시하면 3개도 함께 실행된다.

## 4. 직접 테스트하는 방법

### 4-1. 준비

1. 저장소 루트 `C:\Users\Kang\reproloop`에서 PowerShell을 연다.
2. `.env`에 개발 또는 테스트용 `DATABASE_URL`이 있는지 확인한다.
3. 운영 DB URL은 사용하지 않는다. 통합 테스트가 fixture를 생성하고 삭제하기 때문이다.

### 4-2. 기본 검사

아래 명령을 순서대로 실행한다.

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

모든 명령이 종료 코드 0으로 끝나면 성공이다. `build`는 Google Fonts를 내려받으므로 인터넷 연결이 필요할 수 있다.

### 4-3. 실제 PostgreSQL 통합 테스트

아래 명령은 `.env`의 값을 화면에 출력하지 않고 현재 PowerShell 프로세스에만 주입한다.

```powershell
$databaseLine = Get-Content .env | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
$env:TEST_DATABASE_URL = ($databaseLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
corepack pnpm --filter @reproloop/db test
Remove-Item Env:TEST_DATABASE_URL
```

성공 기준은 DB package의 **2개 test file, 7개 test가 모두 통과**하는 것이다.

### 4-4. migration 상태 확인

이미 migration을 적용한 동일 개발 DB에서 다음 명령을 실행한다.

```powershell
corepack pnpm --filter @reproloop/db db:migrate
```

이미 적용된 migration은 다시 실행되지 않아야 한다. 단, 기존 bootstrap 테이블에 실제 데이터가 있는 별도 DB에는 `0001`을 바로 적용하지 않는다. 안전장치가 중단시키면 데이터를 검토한 뒤 별도 변환 migration을 작성해야 한다.

Supabase SQL Editor에서 구조를 눈으로 확인하려면 다음 쿼리를 사용할 수 있다.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select enumlabel
from pg_enum
join pg_type on pg_type.oid = pg_enum.enumtypid
where pg_type.typname = 'report_status'
order by pg_enum.enumsortorder;

select indexname
from pg_indexes
where schemaname = 'public'
order by indexname;
```

첫 번째 결과에는 MVP 테이블 11개가, 두 번째 결과에는 6개 report 상태가 보여야 한다.

## 5. 보안과 인계 사항

- `.env`와 실제 비밀값은 Git 변경사항에 포함하지 않았다.
- 개발 DB에는 migration만 남고 통합 테스트 fixture는 남지 않았다.
- 3단계에서는 이번에 만든 `createBugReport` command를 Discord modal submit 처리에서 호출하면 된다.
