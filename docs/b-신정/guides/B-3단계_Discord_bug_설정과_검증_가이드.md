# B 3단계 Discord `/bug` 설정과 검증 가이드

## 1. 이 단계에서 동작하는 흐름

```text
Discord /bug 입력
  → project autocomplete
  → 활성 build autocomplete
  → 5개 입력 필드 modal
  → 서명된 modal submit
  → 입력과 guild 연결 재검증
  → report + report_created event transaction 저장
  → 나에게만 보이는 BUG-{번호} 응답
```

Discord는 인터넷에서 서버로 요청을 보낸다. 따라서 `localhost` 주소만으로는 실제 Discord 테스트를 할 수 없고, Discord가 접근할 수 있는 HTTPS URL이 필요하다.

## 2. 필요한 환경변수

```dotenv
DATABASE_URL=
APP_URL=
DISCORD_APPLICATION_ID=
DISCORD_PUBLIC_KEY=
DISCORD_BOT_TOKEN=
DISCORD_TEST_GUILD_ID=
```

| 변수 | 서로 맞아야 하는 대상 | 주의사항 |
|---|---|---|
| `DATABASE_URL` | project·build가 준비된 개발 DB | 운영 DB 사용 금지 |
| `APP_URL` | 실제 배포 HTTPS 주소 | Discord는 localhost 호출 불가 |
| `DISCORD_APPLICATION_ID` | Developer Portal의 Application ID | `AUTH_DISCORD_ID`와 같은 앱 권장 |
| `DISCORD_PUBLIC_KEY` | Developer Portal의 Public Key | route 서명 검증에 사용 |
| `DISCORD_BOT_TOKEN` | 같은 Discord Application의 Bot token | 절대 공유·커밋 금지 |
| `DISCORD_TEST_GUILD_ID` | smoke test를 수행할 서버 ID | 비밀값은 아니지만 환경별로 다를 수 있음 |

Discord에서 서버 ID를 복사하려면 사용자 설정의 개발자 모드를 켠 뒤 테스트 서버를 우클릭하고 **서버 ID 복사**를 선택한다.

## 3. 자동 테스트

저장소 루트의 PowerShell에서 실행한다.

```powershell
cd C:\Users\Kang\reproloop
$env:CI = 'true'
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
Remove-Item Env:CI
```

DB를 사용하는 Web 통합 테스트는 `.env`의 값을 노출하지 않고 다음처럼 실행한다.

```powershell
$databaseLine = Get-Content .env | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1

if (-not $databaseLine) {
  throw '.env에서 DATABASE_URL을 찾지 못했습니다.'
}

$env:TEST_DATABASE_URL = ($databaseLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
$env:CI = 'true'

try {
  corepack pnpm --filter @reproloop/web test
} finally {
  Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:CI -ErrorAction SilentlyContinue
}
```

성공 기준:

```text
Test Files  11 passed (11)
Tests       42 passed (42)
```

## 4. DB 준비 상태 확인

Supabase SQL Editor에서 아래 조회 전용 SQL을 실행한다. `<테스트-guild-id>`는 실제 Discord 서버 ID로 바꾼다.

```sql
select
  dg.discord_guild_id,
  gp.id as project_id,
  gp.name as project_name,
  b.id as build_id,
  b.version,
  b.is_active
from discord_guilds dg
join game_projects gp on gp.discord_guild_id = dg.id
join builds b on b.project_id = gp.id
where dg.discord_guild_id = '<테스트-guild-id>'
  and dg.removed_at is null
  and gp.archived_at is null
  and b.is_active = true
order by gp.name, b.version;
```

성공 기준은 테스트하려는 project와 build가 최소 한 행 나오는 것이다. 결과가 없다면 `/bug` autocomplete가 비어 있는 것이 정상이다. 임의 ID를 DB에 직접 넣기 전에 팀의 project·guild 설정 흐름을 확인한다.

## 5. 배포와 Interaction Endpoint 설정

1. 이 브랜치를 HTTPS를 제공하는 preview 또는 개발 환경에 배포한다.
2. 배포 환경에도 `DATABASE_URL`과 `DISCORD_PUBLIC_KEY`를 설정한다.
3. 배포된 다음 주소가 외부에서 접근 가능한지 확인한다.

```text
https://<배포-host>/api/discord/interactions
```

4. Discord Developer Portal에서 해당 Application을 연다.
5. **General Information → Interactions Endpoint URL**에 위 주소를 입력하고 저장한다.
6. Discord가 보내는 PING 검증을 통과하면 저장이 성공한다.

`DISCORD_PUBLIC_KEY`가 다른 Application의 값이면 PING 서명 검증이 실패한다.

## 6. 테스트 guild에 `/bug` 등록

`.env`에 `DISCORD_TEST_GUILD_ID`를 설정한 뒤 저장소 루트에서 실행한다.

```powershell
$env:CI = 'true'
corepack pnpm --filter @reproloop/web discord:register-bug
Remove-Item Env:CI
```

예상 결과:

```text
Discord /bug command created.
```

이미 같은 이름의 명령이 있으면 다음처럼 표시된다.

```text
Discord /bug command updated.
```

이 스크립트는 해당 guild의 다른 명령을 삭제하거나 일괄 덮어쓰지 않는다.

## 7. Discord에서 직접 확인

### 7-1. 정상 흐름

1. 테스트 guild의 채널에서 `/bug`를 입력한다.
2. `project`에 현재 guild와 연결된 프로젝트만 나오는지 확인한다.
3. project를 고른 뒤 `build`에 활성 build만 나오는지 확인한다.
4. `/bug`를 실행한다.
5. 다음 5개 필드가 있는 modal이 열리는지 확인한다.
   - 실제 현상
   - 기대 결과
   - 재현 방법
   - 플랫폼
   - 발생 빈도
6. 내용을 입력하고 제출한다.
7. 본인에게만 `BUG-{번호}이 접수되었습니다.`가 보이는지 확인한다.

### 7-2. DB 확인

Supabase SQL Editor에서 방금 받은 번호로 확인한다.

```sql
select
  br.id,
  br.report_number,
  br.title,
  br.status,
  br.severity,
  br.discord_interaction_id,
  se.event_type
from bug_reports br
join status_events se on se.report_id = br.id
where br.report_number = <Discord에서-받은-번호>
order by se.created_at;
```

성공 기준:

- report가 한 건이다.
- 상태는 `new`다.
- severity는 `medium`이다.
- 최초 event는 `report_created`다.
- title은 입력한 실제 현상의 공백을 정리한 최대 200자다.

### 7-3. 오류 흐름

- 다른 guild와 연결된 project/build는 autocomplete에 나오지 않아야 한다.
- 비활성 build는 나오지 않아야 한다.
- 필수 modal 항목을 비우면 Discord 또는 서버가 제출을 거절해야 한다.
- 동일 interaction이 재전송돼도 같은 `discord_interaction_id`의 report는 한 건이어야 한다.
- 내부 오류가 발생해도 SQL이나 DB 주소 대신 문의 코드만 표시되어야 한다.

## 8. 자주 발생하는 문제

| 증상 | 확인할 것 |
|---|---|
| Endpoint URL 저장 실패 | 배포 URL, `DISCORD_PUBLIC_KEY`, HTTPS 여부 |
| `/bug`가 보이지 않음 | 등록 스크립트, Application ID, guild ID, Bot 설치 여부 |
| project가 하나도 안 나옴 | `discord_guilds.discord_guild_id`, archived/removed 상태 |
| build가 하나도 안 나옴 | project 선택 여부, `builds.is_active` |
| 제출 후 일반 오류만 표시 | 응답의 문의 코드와 서버 로그의 request ID 비교 |
| 로컬에서는 되지만 Discord에서 실패 | Discord는 `localhost`에 접근할 수 없음 |

비밀값을 문의 메시지나 스크린샷에 포함하지 않는다. 오류를 공유할 때는 request ID, 실행한 명령, HTTP 상태, 실패한 테스트 이름만 전달한다.
