# A Day 5 제보 목록 UI 입문자 가이드

## 1. 이번 단계의 목표

Day 5의 목표는 로그인한 개발자가 웹 화면에서 프로젝트를 고르고, Discord `/bug`로 접수된 제보 목록을 확인하는 것이다.

```text
/projects
  -> 접근 가능한 프로젝트 목록
  -> 프로젝트 선택
  -> /projects/{projectId}/reports
  -> 제보 목록, 상태 필터, 빌드 필터, 검색
```

## 2. 새로 추가된 화면

### 프로젝트 목록

파일: `apps/web/src/app/projects/page.tsx`

역할:

- 로그인하지 않은 사용자는 Discord 로그인 버튼을 본다.
- 로그인한 사용자는 접근 가능한 프로젝트 목록을 본다.
- 프로젝트를 누르면 해당 프로젝트의 제보 목록으로 이동한다.

### 제보 목록

파일: `apps/web/src/app/projects/[projectId]/reports/page.tsx`

역할:

- 프로젝트 멤버인지 확인한다.
- 제보 목록을 테이블로 표시한다.
- 상태, 빌드, 제목 검색 필터를 제공한다.
- 다음 페이지가 있으면 `더 보기` 링크를 표시한다.

## 3. 새로 추가된 API

### 빌드 목록

```text
GET /api/v1/projects/{projectId}/builds
```

파일:

- `apps/web/src/app/api/v1/projects/[projectId]/builds/route.ts`
- `apps/web/src/server/builds/service.ts`
- `apps/web/src/server/builds/drizzle-build-query-repository.ts`

이 API는 제보 목록 화면의 빌드 필터에 사용된다. 프로젝트 멤버만 조회할 수 있고, 활성·비활성 빌드를 모두 반환한다. 비활성 빌드도 과거 제보의 필터 기준이 될 수 있기 때문이다.

## 4. 새로 추가된 Shared DTO

파일: `packages/shared/src/builds/responses.ts`

```text
BuildSummary
  id
  projectId
  version
  isActive
  releasedAt
```

Web 화면과 API가 같은 데이터 모양을 사용하도록 `@reproloop/shared`에서 export한다.

## 5. 화면에서 데이터가 흐르는 순서

```text
Next.js page
  -> getAuthGuards()
  -> requireUser 또는 requireProjectMember
  -> service
  -> repository
  -> DB
  -> page 렌더링
```

이번 화면은 서버 컴포넌트다. 브라우저에서 별도 JavaScript로 API를 다시 호출하지 않고, 서버에서 권한 확인과 DB 조회를 끝낸 뒤 HTML을 만든다.

## 6. 필터 기준

제보 목록 화면은 기존 Day 4 API의 query를 그대로 사용한다.

```text
status: new, needs_info, investigating, reproduced, fixed, duplicate
buildId: UUID
search: 제목 검색어
limit: 한 번에 가져올 개수
cursor: 다음 페이지 기준값
```

필터 form은 `GET` 방식이라 주소창 query string으로 상태가 남는다. 새로고침하거나 링크를 공유해도 같은 필터 상태를 다시 볼 수 있다.

## 7. 로컬 확인 방법

저장소 루트에서 실행한다.

```powershell
pnpm --dir apps/web dev
```

브라우저에서 확인한다.

```text
http://localhost:3000/projects
```

로그인하지 않은 상태라면 로그인 안내가 보이는 것이 정상이다. 로그인 후 프로젝트가 없으면 조직 멤버십 또는 DB seed가 아직 없는 것이다.

## 8. 자동 검증

Day 5 구현 후 다음 명령이 통과해야 한다.

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

이번 단계에서 추가된 테스트:

- build DTO 응답 검증
- build service 권한 확인
- build repository 날짜 직렬화 확인

## 9. Day 5 완료 기준

다음이 모두 되면 Day 5를 완료로 볼 수 있다.

- `/projects`가 열린다.
- 로그인하지 않은 사용자는 로그인 안내를 본다.
- 로그인한 사용자는 접근 가능한 프로젝트 목록을 본다.
- 프로젝트를 선택하면 `/projects/{projectId}/reports`로 이동한다.
- 제보 목록에 `BUG-{번호}`, 제목, 상태, 심각도, 빌드, 제보자, 생성일이 표시된다.
- 상태 필터, 빌드 필터, 검색이 동작한다.
- `/bug`로 접수된 제보가 같은 프로젝트 목록에 표시된다.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 통과한다.
