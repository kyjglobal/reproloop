# A Day 4 프로젝트·제보 목록 API 입문자 가이드

## 1. 이번 작업의 목적

Day 3에서는 Discord 로그인 사용자와 조직·프로젝트 권한을 확인하는 기반을 만들었다. Day 4에서는 그 기반을 사용해 로그인한 개발자가 다음 데이터를 읽을 수 있게 했다.

```text
현재 로그인 사용자
  -> 접근 가능한 프로젝트 목록
  -> 프로젝트 한 개
  -> 그 프로젝트의 제보 목록
```

구현 API는 세 개다.

```text
GET /api/v1/projects
GET /api/v1/projects/{projectId}
GET /api/v1/projects/{projectId}/reports
```

`GET /api/v1/me`는 Day 3에서 이미 구현했으며, 이번 API의 로그인 사용자 확인 방식과 동일한 기반을 사용한다.

## 2. 먼저 알아둘 용어

| 용어 | 쉬운 의미 |
|---|---|
| DTO | API가 주고받는 데이터 모양 |
| Zod schema | 외부 입력과 DTO가 약속한 모양인지 검사하는 코드 |
| guard | 로그인·프로젝트 권한이 없으면 요청을 중단하는 코드 |
| service | guard와 repository를 올바른 순서로 연결하는 코드 |
| repository | 실제 DB 조회 방법을 숨기는 코드 |
| cursor | 다음 목록 페이지를 이어서 읽기 위한 불투명 문자열 |
| soft delete | DB 행을 지우지 않고 `deletedAt`으로 삭제 상태를 표시하는 방식 |

## 3. 전체 요청 흐름

```text
브라우저 또는 프론트엔드
  -> Next.js API route
  -> Auth.js session 확인
  -> requireUser 또는 requireProjectMember
  -> service
  -> Drizzle repository
  -> Supabase PostgreSQL
  -> Shared DTO 형태의 JSON 응답
```

각 층을 나눈 이유는 다음과 같다.

- route는 HTTP 요청과 응답만 처리한다.
- guard는 인증과 권한만 처리한다.
- service는 실행 순서를 보장한다.
- repository는 SQL과 Drizzle 조회만 처리한다.
- Shared는 A와 B가 같이 사용하는 데이터 계약을 제공한다.

## 4. 새로 만든 Shared DTO

### 프로젝트 요약

파일: `packages/shared/src/projects/responses.ts`

```text
ProjectSummary
  id
  organizationId
  organizationName
  name
  slug
  defaultLocale
  role
```

`role`은 현재 사용자가 프로젝트 조직에서 가진 `owner`, `admin`, `member` 중 하나다. 이후 UI에서 역할에 따라 버튼을 표시할 때 사용한다.

### 제보 목록 아이템

파일: `packages/shared/src/reports/responses.ts`

```text
ReportListItem
  id
  projectId
  reportNumber
  title
  status
  severity
  build.id
  build.version
  reporterDisplayName
  duplicateCount
  createdAt
  version
```

`version`은 이후 상태 변경 요청의 `expectedVersion`에 사용한다. `duplicateCount`는 해당 제보를 대표 제보로 가리키는 중복 제보 수다.

Shared DTO는 `strictObject`이므로 계약에 없는 필드를 허용하지 않는다. 날짜는 JSON에서 사용할 수 있도록 ISO 8601 문자열로 반환한다.

## 5. 프로젝트 API

### 프로젝트 목록

```text
GET /api/v1/projects
```

처리 순서:

1. `requireUser()`가 로그인 사용자를 확인한다.
2. ReproLoop의 `users.id`를 얻는다.
3. `organization_members`에서 사용자의 조직을 찾는다.
4. 같은 조직의 `game_projects`를 조회한다.
5. `archivedAt`이 있는 프로젝트는 제외한다.

응답 예시:

```json
{
  "data": [
    {
      "id": "프로젝트-uuid",
      "organizationId": "조직-uuid",
      "organizationName": "Small Moon Studio",
      "name": "Repro Quest",
      "slug": "repro-quest",
      "defaultLocale": "ko",
      "role": "admin"
    }
  ],
  "meta": {
    "nextCursor": null
  }
}
```

프로젝트 수는 MVP 단계에서 작다고 가정해 프로젝트 목록에는 아직 pagination을 적용하지 않았다. 공통 목록 envelope를 지키기 위해 `nextCursor`는 항상 `null`이다.

### 프로젝트 단건

```text
GET /api/v1/projects/{projectId}
```

`requireProjectMember(projectId)`를 먼저 호출한다. 사용자가 프로젝트 조직에 속하지 않으면 `403 FORBIDDEN`을 반환한다. URL의 `projectId`만 믿고 DB 데이터를 반환하지 않는다.

## 6. 제보 목록 API

```text
GET /api/v1/projects/{projectId}/reports
```

기본 요청:

```text
/api/v1/projects/{projectId}/reports
```

필터 요청:

```text
/api/v1/projects/{projectId}/reports?status=new,investigating&limit=20
/api/v1/projects/{projectId}/reports?buildId={buildId}
/api/v1/projects/{projectId}/reports?search=inventory
```

처리 규칙:

- `requireProjectMember(projectId)`를 통과해야 한다.
- `deletedAt`이 있는 제보는 제외한다.
- 최신 `createdAt`과 `id` 순서로 정렬한다.
- 기본 `limit`은 20이고 최대 100이다.
- 현재 빌드의 ID와 version을 함께 반환한다.
- 대표 제보마다 삭제되지 않은 중복 제보 수를 계산한다.
- 다음 데이터가 있으면 `meta.nextCursor`를 반환한다.

## 7. Cursor pagination 이해하기

첫 요청에는 cursor가 없다.

```text
GET /reports?limit=20
```

서버가 다음 페이지가 있다고 판단하면 다음 값을 반환한다.

```json
{
  "meta": {
    "nextCursor": "eyJjcmVhdGVkQXQiOi4uLn0"
  }
}
```

클라이언트는 내용을 수정하지 않고 그대로 다음 요청에 넣는다.

```text
GET /reports?limit=20&cursor=eyJjcmVhdGVkQXQiOi4uLn0
```

cursor 안에는 마지막 제보의 `createdAt`과 `id`가 들어 있다. 같은 시간에 생성된 제보가 있어도 `id`를 함께 사용하므로 페이지가 불안정하게 겹치는 문제를 줄인다. 잘못된 cursor는 `400 VALIDATION_ERROR`로 거부한다.

## 8. 공통 오류 처리

파일: `apps/web/src/server/api/error-response.ts`

| 오류 종류 | API 결과 |
|---|---|
| Zod 입력 오류 | `400 VALIDATION_ERROR` |
| 로그인하지 않음 | `401 UNAUTHENTICATED` |
| 프로젝트 권한 없음 | `403 FORBIDDEN` |
| 리소스 없음 | `404 NOT_FOUND` |
| Domain 규칙 위반 | Domain 오류 코드 유지 |
| 예상하지 못한 오류 | `500 INTERNAL_ERROR` |

Zod 오류는 필드별로 묶어 `fieldErrors`에 넣는다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 값이 올바르지 않습니다.",
    "requestId": "req_...",
    "fieldErrors": {
      "limit": ["Too small: expected number to be >=1"]
    }
  }
}
```

DB URL, stack trace, 내부 SQL 오류는 응답에 포함하지 않는다.

## 9. 파일을 읽는 순서

처음 보는 개발자는 다음 순서로 읽는 것이 쉽다.

1. `packages/shared/src/projects/responses.ts`
2. `packages/shared/src/reports/responses.ts`
3. `apps/web/src/app/api/v1/projects/route.ts`
4. `apps/web/src/server/projects/service.ts`
5. `apps/web/src/server/projects/drizzle-project-query-repository.ts`
6. `apps/web/src/app/api/v1/projects/[projectId]/reports/route.ts`
7. `apps/web/src/server/reports/service.ts`
8. `apps/web/src/server/reports/drizzle-report-list-query-repository.ts`
9. `apps/web/src/server/reports/cursor.ts`
10. `apps/web/src/server/api/error-response.ts`

## 10. 로컬 확인 방법

저장소 루트에서 실행한다.

```powershell
pnpm install --frozen-lockfile
pnpm --dir apps/web dev
```

로그인 전에는 다음 세 요청이 모두 `401 UNAUTHENTICATED`여야 한다.

```text
http://localhost:3000/api/v1/projects
http://localhost:3000/api/v1/projects/{projectId}
http://localhost:3000/api/v1/projects/{projectId}/reports
```

Discord 로그인 후에는 다음 순서로 확인한다.

1. `http://localhost:3000/api/auth/signin`에서 Discord 로그인
2. `/api/v1/me`에서 사용자와 조직 확인
3. `/api/v1/projects`에서 접근 가능한 프로젝트 ID 확인
4. `/api/v1/projects/{projectId}` 확인
5. `/api/v1/projects/{projectId}/reports` 확인

조직 멤버십이 없다면 `/api/v1/projects`는 정상적으로 빈 배열을 반환한다. 이는 로그인 실패가 아니다.

## 11. 테스트가 확인하는 것

| 테스트 | 확인 내용 |
|---|---|
| `response-dtos.test.ts` | 프로젝트·제보 DTO와 strict object |
| `project-service.test.ts` | 로그인 사용자 ID와 프로젝트 guard 사용 |
| `project-query-repository.test.ts` | 조직 멤버십 기반 프로젝트 조회 |
| `report-list.test.ts` | 프로젝트 권한, DTO 변환, cursor pagination |
| `api-error-response.test.ts` | Auth·Zod·Domain 오류 응답 |
| `project-report-list.integration.test.ts` | 실제 PostgreSQL에서 프로젝트·제보 조회 후 fixture 정리 |

전체 검사는 다음 명령으로 실행한다.

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

실제 개발 또는 테스트 DB 조회까지 확인할 때만 `TEST_DATABASE_URL`을 설정한다. 통합 테스트는 고유한 `web-list-...` fixture를 만들고 검증 후 삭제한다. 운영 DB에는 실행하지 않는다.

## 12. B와 교차검증할 내용

B가 새로운 enum이나 목록 envelope를 만들 필요는 없다. Shared의 기존 계약과 이번 응답 DTO를 import하면 된다.

교차검증 항목:

1. B의 상세 API가 `ReportListItem.id`를 그대로 받을 수 있는가?
2. B의 상태 변경 흐름이 `ReportListItem.version`을 사용할 수 있는가?
3. B가 만든 `/bug` 제보의 `projectId`가 프로젝트 목록의 ID와 일치하는가?
4. B의 제보 생성이 연결된 뒤 목록 API에서 해당 제보가 한 번만 보이는가?
5. A와 B의 오류 응답이 모두 Shared의 `ApiErrorSchema`를 따르는가?

Day 4에는 Discord modal과 조회 API를 각각 검증한다. 실제 `/bug` 저장부터 목록 표시까지의 연결은 B의 제보 생성 트랜잭션이 붙는 Day 5에 최종 검증한다.

## 13. 이번 작업에서 변경하지 않은 것

- DB schema와 migration
- Discord Interaction endpoint
- `/bug` modal
- 제보 상세 API
- 상태 변경과 중복 병합
- 목록 UI
- Discord 알림

이 기능들은 B 담당 또는 Day 5 이후 범위다.
