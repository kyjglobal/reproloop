# A Day 7 제보 상태 변경 API·UI 입문자 가이드

## 1. 이번 단계에서 만든 것

Day 7의 A 작업은 게임 개발자가 웹의 제보 상세 화면에서 제보 상태를 바꾸는 기능이다.

이번 단계에서 연결한 액션은 다음 세 가지다.

| 화면의 처리 | API `action` | 변경되는 상태 |
|---|---|---|
| 추가 정보 요청 | `request_information` | `needs_info` |
| 조사 시작 | `start_investigation` | `investigating` |
| 재현 완료 | `mark_reproduced` | `reproduced` |

중복 병합과 병합 취소는 B가 같은 API에 핸들러를 연결한다. 수정 완료는 알림 레코드와 Worker 작업을 같은 트랜잭션으로 처리해야 하므로 Day 8에서 구현한다.

## 2. 사용자가 상태를 바꾸면 일어나는 일

```text
제보 상세 화면
  ↓ 처리와 메모 입력
POST /api/v1/reports/{reportId}/transitions
  ↓ reportId와 JSON 본문 검사
공용 action dispatcher
  ↓ A 상태 action handler 선택
제보 조회 → 프로젝트 멤버 권한 확인
  ↓
Domain 상태 전이 규칙과 expectedVersion 확인
  ↓
DB transaction
  ├─ bug_reports 상태와 version 변경
  └─ status_events 처리 이력 추가
  ↓
화면 새로고침 → 새 상태와 처리 이력 표시
```

제보 상태만 바뀌고 처리 이력이 저장되지 않으면 누가 왜 바꿨는지 알 수 없다. 반대로 이력만 저장되고 제보 상태가 그대로여도 잘못된 데이터가 된다. 그래서 두 SQL 작업은 하나의 DB transaction 안에서 실행한다.

## 3. 주요 파일

| 파일 | 역할 |
|---|---|
| `packages/shared/src/reports/commands.ts` | 모든 상태 변경 요청의 Zod 계약 |
| `packages/shared/src/reports/responses.ts` | 상태 변경 성공 응답 계약 |
| `packages/domain/src/reports/state-transition.ts` | 허용 상태, 역할, 버전 규칙 |
| `packages/db/src/repositories/drizzle-report-repository.ts` | 제보 갱신과 처리 이력 저장 |
| `apps/web/src/app/api/v1/reports/[reportId]/transitions/route.ts` | POST API 입구와 공통 오류 처리 |
| `apps/web/src/server/reports/transition-dispatcher.ts` | action별 담당 handler 선택 |
| `apps/web/src/server/reports/service.ts` | 권한·도메인·DB 작업 연결 |
| `apps/web/src/app/projects/[projectId]/reports/[reportId]/report-status-transition-panel.tsx` | 상세 화면 상태 변경 폼 |
| `apps/web/test/report-transition.test.ts` | 서비스와 dispatcher 단위 테스트 |
| `apps/web/test/report-transition.integration.test.ts` | 실제 PostgreSQL transaction 통합 테스트 |

## 4. API 요청 방법

주소와 HTTP method는 모든 action이 같다.

```http
POST /api/v1/reports/{reportId}/transitions
Content-Type: application/json
```

추가 정보 요청은 제보자에게 전달할 `message`가 반드시 필요하다.

```json
{
  "action": "request_information",
  "message": "문제가 발생한 해상도와 그래픽 설정을 알려주세요.",
  "expectedVersion": 0
}
```

조사 시작과 재현 완료의 `note`는 선택 사항이다.

```json
{
  "action": "start_investigation",
  "note": "Windows 11 환경에서 확인 시작",
  "expectedVersion": 1
}
```

```json
{
  "action": "mark_reproduced",
  "note": "1.0.0-test에서 3회 재현",
  "expectedVersion": 2
}
```

성공 응답은 변경 결과와 다음 요청에 사용할 새 `version`을 돌려준다.

```json
{
  "data": {
    "reportId": "제보 UUID",
    "action": "start_investigation",
    "previousStatus": "new",
    "status": "investigating",
    "version": 1
  }
}
```

## 5. `expectedVersion`이 필요한 이유

두 개발자가 버전 2인 제보를 동시에 열었다고 가정한다.

1. A가 `expectedVersion: 2`로 조사 시작을 저장한다.
2. DB의 제보 버전이 3으로 증가한다.
3. B의 화면에는 아직 버전 2가 보인다.
4. B가 `expectedVersion: 2`로 다시 요청하면 서버가 `409 CONFLICT`를 반환한다.

이 규칙이 없으면 나중 요청이 먼저 저장된 변경을 조용히 덮어쓸 수 있다. 화면은 충돌 응답을 받으면 서버 데이터를 새로 불러온다.

## 6. 현재 상태별 가능한 처리

| 현재 상태 | A 화면에서 가능한 처리 |
|---|---|
| `new` | 추가 정보 요청, 조사 시작, 재현 완료 |
| `needs_info` | 조사 시작 |
| `investigating` | 추가 정보 요청, 재현 완료 |
| `reproduced` | 없음. Day 8의 수정 완료 대상 |
| `fixed` | 없음 |
| `duplicate` | 없음. B의 병합 취소 대상 |

화면에서 버튼을 숨기는 것만으로 권한을 보장할 수는 없다. 사용자는 브라우저 밖에서 API를 직접 호출할 수도 있으므로 서버가 같은 규칙을 다시 검사한다.

## 7. 서버가 확인하는 순서

1. `reportId`가 UUID인지 확인한다.
2. 본문이 `ReportTransitionSchema`와 일치하는지 확인한다.
3. 제보가 존재하고 삭제되지 않았는지 확인한다.
4. 로그인 사용자가 제보의 프로젝트 멤버인지 확인한다.
5. 역할이 해당 action을 실행할 수 있는지 확인한다.
6. 현재 상태에서 action이 허용되는지 확인한다.
7. `expectedVersion`이 DB의 현재 버전과 같은지 확인한다.
8. 제보 갱신과 상태 이력을 한 transaction으로 저장한다.

오류는 기존 API와 같은 형태로 반환된다.

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "다른 사용자가 먼저 제보를 수정했습니다.",
    "requestId": "req_..."
  }
}
```

주요 오류 코드는 다음과 같다.

| HTTP | 코드 | 의미 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | UUID 또는 JSON 본문이 계약과 다름 |
| 401 | `UNAUTHENTICATED` | Discord 로그인이 필요함 |
| 403 | `FORBIDDEN` | 프로젝트 멤버가 아니거나 역할 권한이 없음 |
| 404 | `NOT_FOUND` | 제보가 없거나 삭제됨 |
| 409 | `CONFLICT` | `expectedVersion`이 오래됨 |
| 409 | `INVALID_STATUS_TRANSITION` | 현재 상태에서 실행할 수 없는 action |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type`이 `application/json`이 아님 |

## 8. 웹 화면에서 확인하는 방법

개발 서버를 실행한다.

```powershell
pnpm --filter @reproloop/web dev
```

브라우저에서 다음 순서로 이동한다.

1. `http://127.0.0.1:3000/projects`를 연다.
2. 프로젝트를 선택한다.
3. 제보 목록에서 `new` 상태의 제보를 연다.
4. `상태 변경`에서 `조사 시작`을 선택한다.
5. 필요한 경우 처리 메모를 입력하고 `적용`을 누른다.
6. 상단 상태가 `조사 중`으로 바뀌는지 확인한다.
7. 처리 이력에 `조사를 시작했습니다`와 메모가 추가됐는지 확인한다.

화면에 상태 변경 영역이 없으면 현재 제보가 `reproduced`, `fixed`, `duplicate` 중 하나인지 먼저 확인한다. 이 상태들은 현재 A Day 7 액션이 없다.

## 9. 자동 테스트

전체 기본 검사는 저장소 루트에서 실행한다.

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

상태 변경 테스트만 빠르게 실행하려면 다음 명령을 사용한다.

```powershell
pnpm --filter @reproloop/web test -- report-transition.test.ts
```

실제 개발 DB에 대한 선택적 통합 테스트는 `TEST_DATABASE_URL`이 있을 때만 실행된다. `apps/web/.env.local`의 값을 화면이나 문서에 출력하지 말고 현재 PowerShell 프로세스에만 전달한 뒤 실행한다.

```powershell
$env:TEST_DATABASE_URL = $env:DATABASE_URL
pnpm --filter @reproloop/web test -- report-transition.integration.test.ts
Remove-Item Env:TEST_DATABASE_URL
```

`DATABASE_URL`이 `.env.local`에만 있고 PowerShell 환경에는 없다면 프로젝트에서 이미 사용하는 안전한 env 로드 방식으로 `TEST_DATABASE_URL`을 설정한다. `.env.local` 자체는 Git에 커밋하지 않는다.

## 10. B가 연결할 부분

B는 공용 API 주소나 `ReportTransitionSchema`를 새로 만들 필요가 없다. 최신 `main`을 받은 뒤 `transition-dispatcher.ts`의 아래 두 action을 B의 handler로 연결한다.

```text
merge_duplicate   → B 병합 handler
unmerge_duplicate → B 병합 취소 handler
```

B handler 내부에서 대표 제보 검색, 같은 프로젝트 검증, 자기 자신 병합 차단, 순환 관계 차단, 병합 직전 상태 기록을 담당한다. 공용 route에는 이 업무 규칙을 복사하지 않는다.

교차 검증에서는 다음을 확인한다.

1. A의 상태 변경 세 action이 계속 동작한다.
2. B의 병합과 취소가 같은 endpoint에서 동작한다.
3. 잘못된 본문은 action 종류와 관계없이 같은 오류 형식으로 응답한다.
4. A와 B 작업 모두 `expectedVersion` 충돌을 거부한다.

## 11. Day 8로 남긴 부분

`mark_fixed`는 단순히 상태만 `fixed`로 바꾸면 안 된다. 수정 빌드 연결, 완료 시각, 알림 레코드, Worker 작업을 함께 저장해야 한다. 중간 일부만 저장되면 제보는 수정됨으로 보이지만 제보자가 알림을 받지 못할 수 있다.

따라서 Day 8에서 다음 항목을 한 transaction으로 연결한 뒤 화면에 수정 완료를 노출한다.

- 수정 빌드가 같은 프로젝트 소속인지 확인
- 제보 상태, `fixedBuildId`, `resolvedAt`, version 갱신
- `report_fixed` 상태 이력 생성
- 알림 레코드 생성
- Worker가 처리할 작업 등록

## 12. Day 7 완료 기준

- [x] 공용 transition API가 `ReportTransitionSchema`를 사용한다.
- [x] 프로젝트 멤버만 A 상태 action을 실행할 수 있다.
- [x] 허용되지 않은 상태 변경과 오래된 version이 거부된다.
- [x] 제보 상태와 처리 이력이 한 transaction으로 저장된다.
- [x] 상세 화면에서 상태 변경 후 최신 상태와 이력을 확인할 수 있다.
- [x] B의 병합 handler를 연결할 dispatcher 경계가 있다.
- [ ] 실제 로그인 계정과 개발 DB에서 화면 상태 변경을 한 번 확인한다.
- [ ] B handler 병합 후 상태 변경·병합 통합 시나리오를 교차 검증한다.
