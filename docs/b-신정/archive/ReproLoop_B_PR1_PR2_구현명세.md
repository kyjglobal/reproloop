# ReproLoop B 담당 PR 1·2 구현 명세

> 상태: 구현 전 확정 명세 v1.0
> 선행 조건: A의 `chore/environment-bootstrap` PR이 `main`에 병합되고 루트 기본 검사가 통과할 것

## 1. 고정된 정책

- 제보 심각도: `low`, `medium`, `high`, `critical`; 기본값 `medium`
- 제보 최종 상태: `fixed`; MVP에서는 `closed`를 사용하지 않음
- `member` 허용 action: `request_information`, `start_investigation`, `mark_reproduced`
- `owner`, `admin` 전용 action: `merge_duplicate`, `unmerge_duplicate`, `mark_fixed`
- 한 Discord 서버에 여러 프로젝트 연결 허용
- 공통 enum의 단일 원본은 Zod enum이며 TypeScript 타입은 `z.infer`로 생성

## 2. 상태 전이 규칙

### 2.1 허용 전이

| 현재 상태 | action | 다음 상태 | 추가 입력·조건 | 생성 event |
|---|---|---|---|---|
| `new` | `request_information` | `needs_info` | 비어 있지 않은 `message` | `information_requested` |
| `new` | `start_investigation` | `investigating` | 없음 | `investigation_started` |
| `new` | `mark_reproduced` | `reproduced` | 없음 | `report_reproduced` |
| `needs_info` | `start_investigation` | `investigating` | 없음 | `investigation_started` |
| `investigating` | `request_information` | `needs_info` | 비어 있지 않은 `message` | `information_requested` |
| `investigating` | `mark_reproduced` | `reproduced` | 없음 | `report_reproduced` |
| `reproduced` | `mark_fixed` | `fixed` | 같은 프로젝트의 `fixedBuildId` | `report_fixed` |
| `new`, `needs_info`, `investigating`, `reproduced` | `merge_duplicate` | `duplicate` | 유효한 `canonicalReportId` | `duplicate_merged` |
| `duplicate` | `unmerge_duplicate` | 병합 직전 상태 | 저장된 병합 직전 상태가 존재 | `duplicate_unmerged` |

`expectedVersion`은 모든 전이에서 필수다. 성공하면 version을 정확히 1 증가시킨다. 병합 취소 상태는 클라이언트가 지정하지 않고, `duplicate_merged` 이력에 저장한 병합 직전 상태를 서버가 복원한다.

### 2.2 역할별 action

| action | owner | admin | member |
|---|:---:|:---:|:---:|
| `request_information` | O | O | O |
| `start_investigation` | O | O | O |
| `mark_reproduced` | O | O | O |
| `merge_duplicate` | O | O | X |
| `unmerge_duplicate` | O | O | X |
| `mark_fixed` | O | O | X |

## 3. 상태 전이 테스트 사례

### 3.1 정상 사례

| ID | 사전 상태·입력 | 기대 결과 |
|---|---|---|
| ST-S01 | `new` + `request_information`, message 존재, version 일치 | `needs_info`, version +1, `information_requested` 이력과 알림 생성 |
| ST-S02 | `new` + `start_investigation`, version 일치 | `investigating`, version +1, `investigation_started` 이력 생성 |
| ST-S03 | `new` + `mark_reproduced`, version 일치 | `reproduced`, version +1, `report_reproduced` 이력 생성 |
| ST-S04 | `needs_info` + `start_investigation`, version 일치 | `investigating`, version +1 |
| ST-S05 | `investigating` + `request_information`, message 존재 | `needs_info`, version +1, 정보 요청 알림 생성 |
| ST-S06 | `investigating` + `mark_reproduced`, version 일치 | `reproduced`, version +1 |
| ST-S07 | `reproduced` + `mark_fixed`, 같은 프로젝트의 빌드 | `fixed`, `fixedBuildId`·`resolvedAt` 저장, version +1, 이력·알림·job 생성 |
| ST-S08 | `member`가 `request_information` 실행 | 권한 승인 후 정상 전이 |
| ST-S09 | `owner` 또는 `admin`이 `mark_fixed` 실행 | 권한 승인 후 정상 전이 |

### 3.2 실패 사례

| ID | 사전 상태·입력 | 기대 오류 | DB 변경 |
|---|---|---|---|
| ST-F01 | `new` + `mark_fixed` | `INVALID_STATUS_TRANSITION` | 없음 |
| ST-F02 | `fixed`에서 임의 action 실행 | `INVALID_STATUS_TRANSITION` | 없음 |
| ST-F03 | `duplicate`에서 `unmerge_duplicate` 외 action 실행 | `INVALID_STATUS_TRANSITION` | 없음 |
| ST-F04 | `request_information`에 message 누락·공백 | `VALIDATION_ERROR`, `fieldErrors.message` | 없음 |
| ST-F05 | `mark_fixed`에 `fixedBuildId` 누락 | `VALIDATION_ERROR`, `fieldErrors.fixedBuildId` | 없음 |
| ST-F06 | 다른 프로젝트의 수정 빌드 사용 | `NOT_FOUND` | 없음 |
| ST-F07 | 저장 version과 다른 `expectedVersion` | `CONFLICT` | 없음 |
| ST-F08 | `member`가 `mark_fixed` 실행 | `FORBIDDEN` | 없음 |
| ST-F09 | `member`가 `merge_duplicate` 실행 | `FORBIDDEN` | 없음 |
| ST-F10 | 존재하지 않거나 소프트 삭제된 제보 | `NOT_FOUND` | 없음 |
| ST-F11 | 이력 저장 또는 알림 생성이 실패 | 트랜잭션 실패 | 상태·version·이력·알림 모두 rollback |

`ST-F06`은 다른 프로젝트의 리소스 존재 여부를 노출하지 않기 위해 `NOT_FOUND`로 통일한다.

## 4. 중복 병합 테스트 사례

### 4.1 정상 사례

| ID | 사전 상태·입력 | 기대 결과 |
|---|---|---|
| DM-S01 | 같은 프로젝트의 `new` 제보를 일반 대표 제보에 병합 | 대상 상태 `duplicate`, canonical 연결, version +1, `duplicate_merged` 이력 |
| DM-S02 | `needs_info`, `investigating`, `reproduced` 각각 병합 | 각 상태에서 정상 병합되고 병합 직전 상태 저장 |
| DM-S03 | `duplicate` 제보를 병합 취소 | canonical 연결 제거, 병합 직전 상태 복원, version +1, `duplicate_unmerged` 이력 |
| DM-S04 | 대표 제보에 중복 제보가 여러 건 연결됨 | 대표와 모든 중복 제보자의 Discord ID 조회 |
| DM-S05 | 동일 제보자가 대표·중복 제보를 여러 번 제출 | 알림 대상 Discord ID가 한 번만 반환됨 |
| DM-S06 | `owner` 또는 `admin`이 병합·취소 | 권한 승인 후 정상 처리 |

### 4.2 실패 사례

| ID | 사전 상태·입력 | 기대 오류 | DB 변경 |
|---|---|---|---|
| DM-F01 | 자기 자신을 canonical로 지정 | `VALIDATION_ERROR` | 없음 |
| DM-F02 | 다른 프로젝트 제보를 canonical로 지정 | `NOT_FOUND` | 없음 |
| DM-F03 | 이미 `duplicate`인 제보를 canonical로 지정 | `CONFLICT` | 없음 |
| DM-F04 | A→B 연결이 있는 상태에서 B→A 요청 | `CONFLICT` | 없음 |
| DM-F05 | 두 단계 이상을 거쳐 순환 관계가 생기는 요청 | `CONFLICT` | 없음 |
| DM-F06 | 이미 `duplicate`인 대상을 다시 병합 | `INVALID_STATUS_TRANSITION` | 없음 |
| DM-F07 | 일반 제보에 `unmerge_duplicate` 요청 | `INVALID_STATUS_TRANSITION` | 없음 |
| DM-F08 | 병합 직전 상태 이력이 없는 중복 제보를 취소 | `CONFLICT` | 없음 |
| DM-F09 | 오래된 `expectedVersion`으로 병합·취소 | `CONFLICT` | 없음 |
| DM-F10 | `member`가 병합·취소 | `FORBIDDEN` | 없음 |
| DM-F11 | 대상 또는 canonical이 소프트 삭제됨 | `NOT_FOUND` | 없음 |
| DM-F12 | canonical 연결 후 이력 저장 실패 | 트랜잭션 실패 | 상태·canonical·version·이력 모두 rollback |

## 5. PR 1 — 공통 계약

- 브랜치: `feat/shared-contracts`
- 커밋 권장: `feat(shared): add API contracts and common enums`
- 변경 허용 범위: `packages/shared/**`, 필요한 workspace dependency 항목, `pnpm-lock.yaml`

### 5.1 파일 목록

```text
packages/shared/
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ enums/
│  │  ├─ organization.ts
│  │  ├─ report.ts
│  │  ├─ notification.ts
│  │  ├─ product-event.ts
│  │  ├─ worker-job.ts
│  │  ├─ api-error.ts
│  │  └─ index.ts
│  ├─ api/
│  │  ├─ response.ts
│  │  ├─ error.ts
│  │  └─ index.ts
│  ├─ reports/
│  │  ├─ commands.ts
│  │  ├─ queries.ts
│  │  └─ index.ts
│  ├─ discord/
│  │  ├─ bug-modal.ts
│  │  └─ index.ts
│  ├─ attachments/
│  │  ├─ upload-session.ts
│  │  └─ index.ts
│  ├─ jobs/
│  │  ├─ notification-send-v1.ts
│  │  ├─ attachment-delete-v1.ts
│  │  └─ index.ts
│  └─ index.ts
└─ test/
   ├─ enums.test.ts
   ├─ api-response.test.ts
   └─ request-contracts.test.ts
```

환경설정 PR이 위 파일 일부를 만들었다면 삭제 후 재생성하지 않고 해당 파일을 수정한다.

### 5.2 루트 공개 export

`@reproloop/shared`의 루트 `src/index.ts`는 아래 이름만 공개한다.

#### enum 상수·스키마·타입

```text
ORGANIZATION_ROLES, OrganizationRoleSchema, OrganizationRole
REPORT_STATUSES, ReportStatusSchema, ReportStatus
REPORT_SEVERITIES, ReportSeveritySchema, ReportSeverity
REPORT_TRANSITION_ACTIONS, ReportTransitionActionSchema, ReportTransitionAction
STATUS_EVENT_TYPES, StatusEventTypeSchema, StatusEventType
NOTIFICATION_TYPES, NotificationTypeSchema, NotificationType
NOTIFICATION_STATUSES, NotificationStatusSchema, NotificationStatus
PRODUCT_EVENT_TYPES, ProductEventTypeSchema, ProductEventType
WORKER_JOB_NAMES, WorkerJobNameSchema, WorkerJobName
API_ERROR_CODES, ApiErrorCodeSchema, ApiErrorCode
```

#### API 응답

```text
ApiPaginationMetaSchema, ApiPaginationMeta
ApiErrorDetailsSchema, ApiErrorDetails
ApiErrorSchema, ApiErrorResponse
createApiDataResponseSchema
createApiListResponseSchema
```

payload가 endpoint마다 다르므로 고정된 빈 `ApiSuccessSchema`는 만들지 않는다. 성공 응답은 두 factory에 실제 payload 스키마를 전달해 생성한다.

#### 요청·job 계약

```text
DiscordBugModalInputSchema, DiscordBugModalInput
CreateBugReportCommandSchema, CreateBugReportCommand
ReportListQuerySchema, ReportListQuery
UpdateReportSchema, UpdateReport
ReportTransitionSchema, ReportTransition
CreateUploadSessionSchema, CreateUploadSession
NotificationSendJobV1Schema, NotificationSendJobV1
AttachmentDeleteJobV1Schema, AttachmentDeleteJobV1
```

### 5.3 PR 1 완료 조건

- [ ] 모든 enum이 계약 문서의 값만 허용한다.
- [ ] 단건·목록·오류 응답이 필수·nullable·optional 규칙을 검증한다.
- [ ] object 스키마가 알 수 없는 필드를 거부한다.
- [ ] 각 스키마와 `z.infer` 타입이 루트에서 import된다.
- [ ] Web과 Worker에서 `@reproloop/shared` import smoke test가 통과한다.
- [ ] package 단위 test·typecheck·build와 루트 기본 검사가 통과한다.

## 6. PR 2 — DB·도메인 기반

- 브랜치: `feat/report-domain-foundation`
- 커밋 권장: `feat(domain): add report schema and workflow rules`
- 선행 조건: PR 1 병합 후 최신 `main`에서 분기
- 변경 허용 범위: `packages/db/**`, `packages/domain/**`, 필요한 workspace dependency 항목, `pnpm-lock.yaml`

### 6.1 파일 목록

```text
packages/db/
├─ package.json
├─ tsconfig.json
├─ drizzle.config.ts
├─ drizzle/
│  ├─ 0000_initial.sql
│  └─ meta/                    # drizzle-kit 생성 metadata
├─ src/
│  ├─ client.ts
│  ├─ schema/
│  │  ├─ common.ts
│  │  ├─ users.ts
│  │  ├─ organizations.ts
│  │  ├─ organization-members.ts
│  │  ├─ discord-guilds.ts
│  │  ├─ game-projects.ts
│  │  ├─ builds.ts
│  │  ├─ bug-reports.ts
│  │  ├─ attachments.ts
│  │  ├─ status-events.ts
│  │  ├─ notifications.ts
│  │  ├─ product-events.ts
│  │  └─ index.ts
│  └─ index.ts
└─ test/
   └─ schema.test.ts

packages/domain/
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ errors.ts
│  ├─ reports/
│  │  ├─ types.ts
│  │  ├─ report-repository.ts
│  │  ├─ state-transition.ts
│  │  ├─ duplicate-merge.ts
│  │  ├─ notification-recipients.ts
│  │  └─ index.ts
│  └─ index.ts
└─ test/
   ├─ state-transition.test.ts
   ├─ duplicate-merge.test.ts
   └─ notification-recipients.test.ts
```

### 6.2 `@reproloop/db` 루트 공개 export

```text
createDatabase, Database
users
organizations
organizationMembers
discordGuilds
gameProjects
builds
bugReports
attachments
statusEvents
notifications
productEvents
usersRelations
organizationsRelations
organizationMembersRelations
discordGuildsRelations
gameProjectsRelations
buildsRelations
bugReportsRelations
attachmentsRelations
statusEventsRelations
notificationsRelations
productEventsRelations
```

환경변수를 import 시점에 읽는 singleton `db`는 공개하지 않는다. Web과 Worker가 자신의 환경을 검증한 뒤 `createDatabase(databaseUrl)`로 인스턴스를 생성한다.

### 6.3 `@reproloop/domain` 루트 공개 export

```text
ReportDomainError, ReportDomainErrorCode
ReportRepository, ReportTransaction
ALLOWED_REPORT_TRANSITIONS
getAllowedReportTransitionActions
canRolePerformReportAction
validateReportTransition
validateDuplicateMerge
validateDuplicateUnmerge
collectNotificationRecipientIds
ReportSnapshot
ReportTransitionInput, ReportTransitionDecision
DuplicateMergeInput, DuplicateUnmergeInput
```

도메인 package는 Next.js, Auth.js, Discord SDK와 Drizzle 구현체를 직접 import하지 않는다. 인증된 actor 정보와 repository interface만 입력받는다.

### 6.4 PR 2 완료 조건

- [ ] schema enum 값이 `@reproloop/shared`와 일치한다.
- [ ] 고유 제약, 외래키, soft delete와 version 컬럼이 정의되어 있다.
- [ ] 첫 migration이 한 번 생성되어 있고 A의 개발 DB에서 적용된다.
- [ ] 섹션 3·4의 테스트 사례가 자동화되어 통과한다.
- [ ] 실패 사례에서 부분 DB 변경이 남지 않는다.
- [ ] Domain이 DB·Web 구현 세부사항 없이 단위 테스트된다.
- [ ] package 단위 test·typecheck·build와 루트 기본 검사가 통과한다.

## 7. PR 분리 규칙

- PR 1에 Drizzle schema나 상태 전이 구현을 넣지 않는다.
- PR 2에서 PR 1의 enum 값을 임의 변경하지 않는다. 변경이 필요하면 계약 PR을 먼저 만든다.
- PR 1과 PR 2에서 Web 화면이나 API route를 구현하지 않는다.
- `pnpm-lock.yaml`은 각 PR에서 실제 dependency 변경이 있을 때만 포함한다.
- 생성된 migration을 수동 편집했다면 이유와 변경 내용을 PR 본문에 기록한다.
- 테스트 ID는 테스트 이름에 포함한다. 예: `ST-F07 rejects a stale expectedVersion`.
