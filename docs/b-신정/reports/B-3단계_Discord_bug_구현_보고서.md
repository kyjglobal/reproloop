# B 3단계 Discord `/bug` 구현 보고서

## 1. 결과 요약

| 항목 | 결과 |
|---|---|
| 작업일 | 2026-08-17 |
| 브랜치 | `feat/discord-bug-submit` |
| 구현 범위 | `B-DIS-01` ~ `B-DIS-05`, 5/5 |
| 코드·자동 검증 | 완료 |
| 실제 PostgreSQL 검증 | 완료 |
| 실제 Discord guild smoke | 대기 |

실제 guild smoke가 남은 이유는 현재 `APP_URL`이 `localhost`이고 `.env`에 `DISCORD_TEST_GUILD_ID`가 없기 때문이다. Discord가 호출할 수 있는 공개 HTTPS 배포 URL을 준비하고 테스트 guild ID를 설정하면 [설정과 검증 가이드](../guides/B-3단계_Discord_bug_설정과_검증_가이드.md)에 따라 마지막 확인을 진행할 수 있다.

## 2. 구현 내용

### B-DIS-01 · 요청 경계와 서명 검증

- `POST /api/discord/interactions` route를 추가했다.
- JSON parse 전에 raw body, `X-Signature-Ed25519`, `X-Signature-Timestamp`를 검증한다.
- 누락된 header, 변조된 body, 유효하지 않거나 5분보다 오래된 timestamp를 `401`로 거절한다.
- Discord `PING`에는 규격에 맞는 `PONG`을 반환한다.

### B-DIS-02 · `/bug`, autocomplete, modal

- `/bug` 명령 정의와 안전한 테스트 guild 등록 스크립트를 추가했다.
- 현재 Discord guild에 연결된 project만 autocomplete에 표시한다.
- 선택한 project에 속한 활성 build만 표시한다.
- project와 build가 유효할 때 확정된 5개 입력 필드 modal을 반환한다.
- 명령 등록 스크립트는 다른 guild command를 일괄 덮어쓰지 않고 `/bug`만 생성하거나 갱신한다.

### B-DIS-03 · modal 변환과 검증

- component tree를 순회하면서 필드 중복·누락·알 수 없는 필드를 거절한다.
- Shared의 `DiscordBugModalInputSchema`와 `CreateBugReportCommandSchema`로 최종 검증한다.
- project/build ID는 modal custom ID에서 복원하지만 저장 transaction에서 guild 연결과 활성 상태를 다시 확인한다.
- 별도 제목 필드가 없는 계약에 따라 실제 현상을 공백 정리한 최대 200자 문자열을 title로 사용한다.
- severity는 Shared 계약 기본값 `medium`을 사용한다.

### B-DIS-04 · 저장과 응답

- 2단계의 `createBugReport` command에 연결했다.
- 성공과 재시도 모두 `BUG-{번호}이 접수되었습니다.`라는 ephemeral 응답을 반환한다.
- 동일 modal interaction 재전송 시 report와 `report_created` event는 각각 한 건만 저장된다.
- 내부 오류는 응답에 노출하지 않고 request ID가 포함된 일반 메시지만 반환한다.

### B-DIS-05 · 테스트

- 실제 Ed25519 key pair로 정상 서명·변조·header 누락·오래된 timestamp를 검사한다.
- PING, 알 수 없는 type, autocomplete, modal custom ID, 입력 검증, 일반화된 오류를 검사한다.
- 실제 개발 PostgreSQL에서 guild 격리, 활성 build 필터, 중복 interaction 저장 방지를 검사한다.

## 3. 검증 결과

| 검사 | 결과 |
|---|---|
| frozen install | 통과 |
| 전체 lint | 통과 |
| 전체 typecheck | 통과 |
| 전체 일반 테스트 | 85개 통과, DB 연동 6개 skip |
| Web 일반 테스트 | 39개 통과, DB 테스트 3개 skip |
| Web 실제 DB 테스트 | 42개 전체 통과 |
| DB fixture 정리 | 통과 |
| 전체 production build | 통과 — `/api/discord/interactions` dynamic route 확인 |

일반 테스트의 skip은 실패가 아니다. `TEST_DATABASE_URL`이 없을 때 개발 DB 변경 가능성이 있는 통합 테스트를 의도적으로 실행하지 않는 동작이다.

## 4. 추가된 환경변수

| 이름 | 용도 | 비밀값 여부 |
|---|---|---|
| `DISCORD_TEST_GUILD_ID` | `/bug`를 즉시 반영할 테스트 Discord 서버 | 비밀값 아님 |

기존 `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`을 그대로 사용한다. Bot token은 비밀값이므로 코드, 로그, PR, 스크린샷에 포함하지 않는다.

## 5. 남은 외부 확인

다음 조건이 준비되면 실제 guild smoke를 수행한다.

1. 이 브랜치가 공개 HTTPS 환경에 배포됨
2. Discord Developer Portal의 Interactions Endpoint URL이 배포 URL의 `/api/discord/interactions`를 가리킴
3. `DISCORD_TEST_GUILD_ID`가 설정됨
4. DB의 `discord_guilds.discord_guild_id`가 테스트 guild ID와 일치함
5. 해당 guild에 연결된 project와 활성 build가 최소 한 건 존재함

이 확인 전까지 3단계의 코드와 자동 검증은 완료 상태지만, 계획의 최종 종료 조건인 실제 guild 시연은 완료로 표시하지 않는다.
