# A 2단계 인증-DB 연동 입문자 가이드

## 1. 이 단계에서 만든 것

1단계에서 Discord 로그인과 세션 확인 구조를 만들었다. 2단계에서는 로그인 정보를 실제 ReproLoop 데이터와 연결했다.

- Discord 세션의 사용자를 `users` 테이블에 생성하거나 갱신한다.
- 사용자가 어느 조직에 속했는지 `organization_members`에서 확인한다.
- 조직 소속을 기준으로 프로젝트 접근 가능 여부를 판단한다.
- `GET /api/v1/me`에서 현재 사용자와 소속 조직을 반환한다.
- 로그인하지 않은 요청에는 공통 형식의 `401 UNAUTHENTICATED` 오류를 반환한다.

## 2. 먼저 알아둘 용어

| 용어 | 쉬운 의미 |
|---|---|
| Discord OAuth | Discord 계정으로 로그인하는 절차 |
| session | 서버가 현재 요청을 보낸 Discord 사용자를 알아보는 로그인 정보 |
| application user | Discord 사용자를 ReproLoop의 `users` 행으로 바꾼 결과 |
| membership | 사용자가 특정 조직에 속한다는 기록 |
| repository | SQL 세부 내용을 숨기고 사용자·권한 데이터를 조회하는 코드 |
| guard | 로그인이나 권한이 없으면 요청을 중단하는 함수 |
| upsert | 행이 없으면 생성하고, 이미 있으면 갱신하는 처리 |

## 3. 전체 흐름

```text
브라우저 요청
  -> Auth.js가 Discord session 확인
  -> requireUser()가 Discord 사용자 ID 확인
  -> DrizzleAuthAccessRepository가 users를 upsert
  -> organization_members와 organizations 조회
  -> GET /api/v1/me가 JSON 응답 반환
```

중요한 식별자는 두 종류다.

- `discordUserId`: Discord가 발급한 사용자 ID
- `users.id`: ReproLoop DB에서 사용하는 UUID

로그인 직후에는 `discordUserId`만 알고 있다. `resolveUser()`가 이 값으로 `users` 행을 찾아 ReproLoop UUID를 확보한다.

## 4. 데이터베이스 관계

```text
users
  id
  discord_user_id
       |
       | organization_members.user_id
       v
organization_members ------> organizations
  organization_id              id
  user_id                       name
  role
       |
       | 같은 organization_id
       v
game_projects
  id
  organization_id
```

프로젝트별 멤버 테이블은 없다. 사용자가 프로젝트의 조직에 속해 있으면 그 조직의 프로젝트에 접근할 수 있다. 따라서 프로젝트 권한 검사는 `game_projects.organization_id`와 `organization_members.organization_id`를 연결한다. 보관 처리된 프로젝트(`archived_at`이 있는 프로젝트)는 접근 대상에서 제외한다.

## 5. 코드를 읽는 권장 순서

### 5.1 DB 연결

파일: `apps/web/src/server/db/connection.ts`

- `DATABASE_URL`이 있는지 확인한다.
- 첫 DB 작업 때만 연결 객체를 만든다.
- 개발 중 모듈이 다시 로드되어도 전역 연결 객체를 재사용한다.
- URL 값은 오류 응답이나 로그에 직접 출력하지 않는다.

### 5.2 DB 인증 저장소

파일: `apps/web/src/server/auth/drizzle-auth-access-repository.ts`

주요 함수:

| 함수 | 역할 |
|---|---|
| `resolveUser()` | Discord 사용자 ID로 `users`를 생성 또는 갱신 |
| `findOrganizationMembership()` | 특정 조직의 멤버인지 확인 |
| `findProjectMembership()` | 프로젝트가 속한 조직의 멤버인지 확인 |
| `listOrganizationMemberships()` | 현재 사용자의 모든 조직과 역할 조회 |

### 5.3 기본 실행 객체 연결

파일: `apps/web/src/server/auth/runtime.ts`

기존 guard는 테스트하기 쉽도록 저장소를 외부에서 받는다. 이 파일은 실제 실행 환경에서 다음 조합을 한 번 만들어 준다.

```text
getCurrentSession + DrizzleAuthAccessRepository -> AuthGuards
```

저장소는 지연 생성된다. 로그인하지 않은 요청은 `users` 조회 전에 `UNAUTHENTICATED`로 종료된다.

### 5.4 내 정보 변환

파일: `apps/web/src/server/auth/current-user.ts`

DB의 멤버십 필드 이름을 API 계약의 필드 이름으로 바꾼다.

```text
organizationId   -> id
organizationName -> name
role             -> role
```

### 5.5 API route

파일: `apps/web/src/app/api/v1/me/route.ts`

처리 순서:

1. 요청 ID를 가져오거나 새로 만든다.
2. `requireUser()`로 로그인을 확인한다.
3. 사용자를 DB에 upsert한다.
4. 사용자의 조직 목록을 조회한다.
5. `{ data: ... }` 형식으로 반환한다.
6. 오류가 나면 공통 API 오류 형식으로 바꾼다.

성공 응답 예시:

```json
{
  "data": {
    "id": "사용자-uuid",
    "discordUserId": "123456789012345678",
    "displayName": "dev_kim",
    "organizations": [
      {
        "id": "조직-uuid",
        "name": "Small Moon Studio",
        "role": "owner"
      }
    ]
  }
}
```

조직에 아직 속하지 않은 사용자는 `organizations: []`를 받는다. 이는 로그인 실패가 아니다.

비로그인 응답 예시:

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "로그인이 필요합니다.",
    "requestId": "req_..."
  }
}
```

## 6. 필요한 환경 변수

`apps/web/.env.local`에 다음 이름이 필요하다.

```dotenv
DATABASE_URL=
APP_URL=
AUTH_SECRET=
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=
```

실제 값이 들어간 `.env.local`은 Git에 올리거나 메신저로 공유하지 않는다. 필요한 값은 팀의 비밀 관리 수단으로 전달하고, 저장소에는 값이 비어 있는 `.env.example`만 둔다.

## 7. 로컬에서 확인하는 순서

저장소 루트에서 실행한다.

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --dir apps/web dev
```

`predev`가 `@reproloop/db`와 그 의존 패키지를 먼저 빌드한다. 개발 서버가 뜨면 다음 주소를 확인한다.

```text
http://localhost:3000/api/v1/me
```

확인할 결과:

| 상태 | 예상 결과 |
|---|---|
| 로그인 전 | HTTP 401, `UNAUTHENTICATED` |
| 로그인 후, 조직 없음 | HTTP 200, `organizations: []` |
| 로그인 후, 조직 있음 | HTTP 200, 조직의 `id`, `name`, `role` 반환 |

## 8. 테스트 파일

| 파일 | 확인 내용 |
|---|---|
| `apps/web/test/auth-guards.test.ts` | 로그인·조직·프로젝트 guard 동작 |
| `apps/web/test/drizzle-auth-access-repository.test.ts` | 사용자 upsert와 조직 기반 프로젝트 권한 쿼리 |
| `apps/web/test/current-user.test.ts` | DB 결과를 `/api/v1/me` 응답으로 변환 |
| `apps/web/test/api-error-response.test.ts` | 401 오류 형식과 요청 ID 유지 |

단위 테스트는 실제 DB 데이터를 변경하지 않는다. 실제 PostgreSQL 연결까지 확인하는 통합 테스트는 별도의 테스트 DB와 `TEST_DATABASE_URL`을 사용해야 한다.

## 9. 자주 생기는 문제

### `DATABASE_URL is missing or empty`

`apps/web/.env.local`에 `DATABASE_URL`이 없거나 빈 값이다. 실제 접속 문자열이 설정되었는지 확인한다.

### `relation "users" does not exist`

DB 접속은 됐지만 마이그레이션이 적용되지 않았다. 대상 DB를 다시 확인한 뒤 DB 담당 절차에 따라 마이그레이션을 실행한다.

### 로그인했는데 `organizations`가 빈 배열이다

`users` 생성은 성공했지만 해당 사용자의 `organization_members` 행이 없는 상태다. `users.id`와 멤버십의 `user_id`가 연결되어 있는지 확인한다.

### 프로젝트 접근이 403이다

다음을 차례로 확인한다.

1. 프로젝트가 보관 처리되지 않았는가?
2. 프로젝트의 `organization_id`가 올바른가?
3. 사용자의 `organization_members.organization_id`가 같은가?

## 10. 다음 작업

2단계가 끝난 다음 A의 작업은 프로젝트 목록 API로 이어진다.

1. `GET /api/v1/projects` 구현
2. 로그인 사용자의 조직에 속한 활성 프로젝트만 조회
3. 프로젝트별 권한 guard를 목록·상세 API에 적용
4. 로그인 화면과 프로젝트 선택 UI에서 `/api/v1/me` 사용