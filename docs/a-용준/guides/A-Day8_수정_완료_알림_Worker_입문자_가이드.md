# A Day 8 수정 완료·알림 Worker 입문자 가이드

## 1. 이번 단계에서 만든 기능

재현이 끝난 제보를 관리자가 `수정 완료`로 바꾸면 다음 작업이 한 흐름으로 처리된다.

1. 같은 프로젝트의 수정 빌드인지 확인한다.
2. 제보 상태를 `reproduced`에서 `fixed`로 변경한다.
3. 수정 빌드와 완료 시각을 제보에 저장한다.
4. `report_fixed` 처리 이력을 저장한다.
5. 대표 제보자와 중복 제보자의 Discord ID를 중복 제거한다.
6. 제보자별 알림 레코드와 pg-boss 작업을 같은 DB transaction에 저장한다.
7. 별도 Worker가 Discord DM을 전송하고 알림 상태를 기록한다.

웹 요청이 Discord API를 직접 호출하지 않는 이유는 Discord 장애가 제보 상태 변경까지 실패시키지 않도록 하기 위해서다. DB에는 먼저 보낼 작업을 확실히 기록하고 Worker가 재시도한다.

## 2. 전체 처리 흐름

```text
상세 화면에서 수정 빌드 선택
  -> POST /api/v1/reports/{reportId}/transitions
  -> 권한, 현재 상태, version, 빌드 프로젝트 검증
  -> 하나의 DB transaction
       bug_reports 갱신
       status_events 생성
       notifications 생성
       pg-boss job 생성
  -> Worker가 notification.send.v1 소비
  -> Discord DM 전송
  -> notifications.status를 sent 또는 failed로 변경
```

## 3. 누가 실행할 수 있나

`mark_fixed`는 조직의 `owner`와 `admin`만 실행할 수 있다. `member`에게는 상세 화면의 수정 완료 메뉴가 표시되지 않으며 API를 직접 호출해도 `FORBIDDEN` 오류가 반환된다.

제보 상태가 반드시 `reproduced`여야 한다. 다른 상태에서 호출하면 `INVALID_STATUS_TRANSITION`이 반환된다.

## 4. 주요 파일

| 파일 | 역할 |
|---|---|
| `apps/web/src/server/reports/service.ts` | 수정 완료 transaction 순서를 조립한다. |
| `packages/db/src/repositories/drizzle-report-repository.ts` | 상태·이력·알림·job을 실제 DB에 저장한다. |
| `apps/web/src/server/jobs/notification-queue.ts` | pg-boss에 `notification.send.v1` 작업을 넣는다. |
| `report-status-transition-panel.tsx` | 수정 빌드 선택 UI와 API 요청을 담당한다. |
| `apps/worker/src/index.ts` | pg-boss Worker를 시작한다. |
| `apps/worker/src/notification-service.ts` | 중복 전송 방지와 성공·실패 처리를 담당한다. |
| `apps/worker/src/discord-client.ts` | Discord DM 채널 생성과 메시지 전송을 담당한다. |

## 5. 필요한 환경변수

Web과 Worker가 같은 PostgreSQL을 사용해야 한다.

```dotenv
DATABASE_URL=postgresql://...
DISCORD_BOT_TOKEN=...
```

- Web: `DATABASE_URL`을 사용해 상태·알림·pg-boss job을 저장한다.
- Worker: `DATABASE_URL`과 `DISCORD_BOT_TOKEN`을 사용한다.
- 로컬에서는 Web 값은 `apps/web/.env.local`, Worker 값은 `apps/worker/.env`에 둔다. 배포 환경에서는 서비스별 비밀 환경변수로 등록하고 Git에 커밋하지 않는다.

Discord 앱의 Bot 설정에서 DM 전송에 사용할 토큰이 준비되어야 한다. 제보자가 봇과 공통 서버에 없거나 개인 메시지를 차단한 경우 전송은 실패할 수 있으며, DB에는 `failed`와 오류 내용이 기록된다.

## 6. 로컬 실행

터미널 1에서 Web을 실행한다.

```powershell
pnpm --filter @reproloop/web dev
```

터미널 2에서 Worker를 실행한다.

```powershell
pnpm --filter @reproloop/worker dev
```

Worker 터미널에 아래 문구가 나오면 작업을 기다리는 상태다.

```text
reproloop-worker ready
```

## 7. 화면에서 테스트하는 순서

1. Discord로 로그인한다.
2. owner 또는 admin으로 등록된 조직의 프로젝트를 연다.
3. 제보 상세 화면에서 상태를 `재현 완료`까지 변경한다.
4. 다시 나타난 `수정 완료` 처리에서 수정 빌드를 선택한다.
5. `적용`을 누른다.
6. 화면 상태가 `수정됨`이고 수정 빌드가 표시되는지 확인한다.
7. 대표 제보자와 연결된 중복 제보자에게 DM이 각각 한 번 도착하는지 확인한다.

등록된 빌드가 없으면 먼저 프로젝트 DB에 빌드를 등록해야 하며 수정 완료 버튼은 비활성화된다.

## 8. API로 테스트하는 방법

로그인 세션이 있는 브라우저 개발자 도구에서 실행한다.

```js
await fetch("/api/v1/reports/REPORT_UUID/transitions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    action: "mark_fixed",
    fixedBuildId: "BUILD_UUID",
    note: "1.2.0에서 수정",
    expectedVersion: 1,
  }),
}).then((response) => response.json());
```

`expectedVersion`은 상세 화면에 표시되는 현재 제보 version이다. 다른 사용자가 먼저 변경했다면 `CONFLICT`가 발생하므로 화면을 새로고침하고 다시 시도한다.

## 9. DB에서 확인할 값

수정 완료 후 아래 네 가지를 확인한다.

- `bug_reports.status = fixed`
- `bug_reports.fixed_build_id`와 `resolved_at`이 저장됨
- `status_events.event_type = report_fixed`
- 대상자별 `notifications.status`가 처음에는 `queued`, 전송 후 `sent`

동일한 상태 이벤트·알림 종류·수신자 조합은 `idempotency_key` unique index로 중복 생성이 차단된다. Worker도 이미 `sent`인 알림은 다시 보내지 않는다.

## 10. 자동 테스트

```powershell
pnpm typecheck
pnpm test
pnpm build
```

실제 PostgreSQL transaction 테스트까지 실행하려면 테스트 DB URL을 별도로 지정한다.

```powershell
$env:TEST_DATABASE_URL="postgresql://..."
pnpm --filter @reproloop/web test
```

운영 DB를 `TEST_DATABASE_URL`로 사용하면 테스트 데이터가 들어가므로 반드시 별도 개발·테스트 DB를 사용한다.

## 11. B 작업과 만나는 지점

B가 구현한 `resolveReportFixNotificationAudience`는 대표 제보와 그 대표를 가리키는 중복 제보를 조회해 canonical report ID, 관련 report ID, 중복 제거된 Discord 수신자 ID를 반환한다. A의 수정 완료 서비스는 이 결과를 같은 transaction 안에서 알림과 Worker job으로 저장한다.

교차 검증에서는 대표 제보 1건에 중복 제보 1건 이상을 연결하고, 같은 사람이 여러 제보를 작성해도 DM이 한 번만 가는지 확인한다.

## 12. 현재 범위

이번 Day 8 구현은 `report_fixed` DM을 처리한다. `information_requested` 알림은 같은 notification/Worker 구조를 사용할 수 있지만 메시지와 생성 로직 연결은 별도 후속 작업이다. 실패 알림 수동 재시도 화면도 MVP 후순위다.
