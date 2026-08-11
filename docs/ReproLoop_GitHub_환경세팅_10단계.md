# ReproLoop GitHub 저장소 및 환경 세팅 10단계

이 문서는 ReproLoop 프로젝트를 새 GitHub 저장소로 만들고, 로컬 개발 환경부터 배포 준비까지 초기 설정하는 절차를 10단계로 정리한 것이다.

최종 기준 스택:

```text
TypeScript
pnpm workspace
Next.js App Router
Tailwind CSS + shadcn/ui
Auth.js + Discord OAuth
Discord HTTP Interactions
Supabase PostgreSQL + Private Storage
Drizzle ORM
pg-boss Worker
Railway
Vitest + Playwright
GitHub Actions
```

---

## 1. 프로젝트 전용 폴더 만들기

현재 `C:\Users\yjkor\OneDrive\문서\임시` 폴더에는 Git 저장소가 있지만, OneDrive 동기화 폴더는 `node_modules`, `.next`, 빌드 산출물 때문에 충돌이나 속도 저하가 생길 수 있다.

실제 프로젝트는 OneDrive 밖의 전용 폴더에서 시작하는 것을 권장한다.

```powershell
New-Item -ItemType Directory -Path 'C:\Users\yjkor\Projects\reproloop' -Force
Copy-Item -LiteralPath 'C:\Users\yjkor\OneDrive\문서\임시\ReproLoop_기술스택_제안서.md' -Destination 'C:\Users\yjkor\Projects\reproloop\ReproLoop_기술스택_제안서.md'
Set-Location 'C:\Users\yjkor\Projects\reproloop'
git init -b main
git status
```

권장 저장소 이름은 `reproloop`이다.

---

## 2. GitHub 저장소 새로 만들기

GitHub 웹에서 만드는 방식이 가장 단순하다.

1. https://github.com/new 접속
2. Repository name: `reproloop`
3. Description: `Discord playtest bug reporting and feedback management service`
4. Visibility: `Private` 권장
5. README, `.gitignore`, license는 선택하지 않음
6. 저장소 생성

로컬 저장소에서 원격 저장소를 연결한다.

```powershell
git remote add origin https://github.com/GITHUB_ID/reproloop.git
git remote -v
```

`GITHUB_ID`는 실제 GitHub 사용자명 또는 조직명으로 바꾼다.

GitHub CLI를 사용할 경우:

```powershell
winget install --id GitHub.cli
gh auth login
gh repo create reproloop --private --source=. --remote=origin
```

웹에서 이미 저장소를 만들었다면 `gh repo create`는 실행하지 않는다.

---

## 3. pnpm 모노레포와 Next.js 초기화

저장소 루트에서 Next.js 앱, Worker 앱, 공통 패키지 폴더를 만든다.

```powershell
Set-Location 'C:\Users\yjkor\Projects\reproloop'
pnpm create next-app@latest apps/web --yes
New-Item -ItemType Directory -Path 'apps\worker\src' -Force
New-Item -ItemType Directory -Path 'packages\db\src' -Force
New-Item -ItemType Directory -Path 'packages\domain\src' -Force
New-Item -ItemType Directory -Path 'packages\shared\src' -Force
```

목표 구조:

```text
reproloop/
├─ apps/
│  ├─ web/              # Next.js 대시보드와 API
│  └─ worker/           # 백그라운드 작업 처리
├─ packages/
│  ├─ db/               # Drizzle schema, migration
│  ├─ domain/           # 상태 전이, 권한, 비즈니스 규칙
│  └─ shared/           # Zod schema, 공통 타입
├─ package.json
├─ pnpm-workspace.yaml
├─ .env.example
└─ .gitignore
```

루트에 `pnpm-workspace.yaml`을 만든다.

```yaml
packages:
  - apps/*
  - packages/*
```

루트 `package.json`은 다음처럼 시작한다.

```json
{
  "name": "reproloop",
  "private": true,
  "packageManager": "pnpm@11.9.0",
  "scripts": {
    "dev": "pnpm --parallel --filter @reproloop/web --filter @reproloop/worker dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test"
  }
}
```

`apps/web/package.json`의 `name` 필드는 `@reproloop/web`으로 바꾼다.

---

## 4. 필수 의존성 설치

Web 앱 의존성:

```powershell
pnpm --dir apps/web add next-auth zod drizzle-orm postgres @supabase/supabase-js discord-interactions sharp
pnpm --dir apps/web add -D drizzle-kit vitest @playwright/test
```

shadcn/ui 초기화:

```powershell
Set-Location 'apps\web'
pnpm dlx shadcn@latest init
Set-Location '..\..'
```

Worker 앱 초기화:

```powershell
Set-Location 'apps\worker'
pnpm init
pnpm add pg-boss zod dotenv
pnpm add -D typescript tsx vitest @types/node
Set-Location '..\..'
```

`apps/worker/package.json`의 기본 형태:

```json
{
  "name": "@reproloop/worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

---

## 5. 환경변수 파일 구성

루트에 `.env.example`을 만든다. 실제 비밀 값은 넣지 않는다.

```dotenv
APP_URL=http://localhost:3000
NODE_ENV=development

DATABASE_URL=postgresql://...

SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_STORAGE_BUCKET=attachments

AUTH_SECRET=
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=
AUTH_TRUST_HOST=true

DISCORD_APPLICATION_ID=
DISCORD_PUBLIC_KEY=
DISCORD_BOT_TOKEN=

SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

Auth.js secret 생성:

```powershell
Set-Location 'apps\web'
pnpm exec auth secret
Set-Location '..\..'
```

로컬 실제 값은 다음 파일에 둔다.

```text
apps/web/.env.local
apps/worker/.env
```

루트 `.gitignore`에는 최소한 다음을 포함한다.

```gitignore
node_modules/
.next/
dist/
.env
.env.*
!.env.example
playwright-report/
test-results/
coverage/
*.log
```

`SUPABASE_SECRET_KEY`, `DISCORD_BOT_TOKEN`, `AUTH_SECRET`은 GitHub에 커밋하지 않는다. 특히 `SUPABASE_SECRET_KEY`에는 `NEXT_PUBLIC_` 접두사를 붙이면 안 된다.

---

## 6. Supabase 설정

Supabase에서 프로젝트를 만들고 PostgreSQL과 Private Storage를 준비한다.

초기 설정 순서:

1. Supabase 프로젝트 생성
2. PostgreSQL 연결 문자열 확인
3. `DATABASE_URL`에 연결 문자열 등록
4. Storage bucket 이름을 `attachments`로 생성
5. bucket을 `Private`으로 설정
6. 허용 MIME 타입 제한
7. Drizzle migration으로 테이블 생성

초기 허용 MIME 타입:

```text
text/plain
image/png
image/jpeg
image/webp
```

첨부파일은 브라우저에서 Supabase로 직접 올리지 않는다. Next.js 서버가 파일을 받아 개인정보와 불필요한 메타데이터를 제거한 뒤 Storage에 저장한다.

Transaction Pooler를 사용할 경우 `postgres` 클라이언트의 prepared statement 설정을 꺼야 한다.

---

## 7. Discord 애플리케이션 설정

Discord Developer Portal에서 새 애플리케이션을 만든다.

필요한 값:

```text
Application ID
Public Key
Client Secret
Bot Token
```

환경변수 매핑:

| Discord 값 | 환경변수 |
|---|---|
| Application ID | `DISCORD_APPLICATION_ID`, `AUTH_DISCORD_ID` |
| Public Key | `DISCORD_PUBLIC_KEY` |
| Client Secret | `AUTH_DISCORD_SECRET` |
| Bot Token | `DISCORD_BOT_TOKEN` |

OAuth Callback URL:

```text
http://localhost:3000/api/auth/callback/discord
https://YOUR_DOMAIN/api/auth/callback/discord
```

Discord Interaction Endpoint:

```text
https://TEMPORARY_TUNNEL/api/discord/interactions
https://YOUR_RAILWAY_DOMAIN/api/discord/interactions
```

로컬 `localhost`는 Discord Interaction Endpoint로 직접 등록할 수 없다. 로컬 테스트에는 Cloudflare Tunnel 또는 ngrok 같은 공개 HTTPS 터널이 필요하다.

Interaction API는 요청 서명 검증과 3초 이내 최초 응답이 필수다.

---

## 8. 로컬 실행 확인과 첫 커밋

의존성 설치:

```powershell
pnpm install
```

Web 개발 서버 실행:

```powershell
pnpm --dir apps/web dev
```

확인 주소:

```text
http://localhost:3000
```

초기 확인 항목:

- [ ] Next.js 화면이 열린다.
- [ ] TypeScript 오류가 없다.
- [ ] `.env.local`과 `.env`가 Git 상태에 나타나지 않는다.
- [ ] Supabase PostgreSQL 연결이 성공한다.
- [ ] Discord OAuth Callback URL이 등록되어 있다.
- [ ] Discord Interaction 서명 검증 테스트가 통과한다.

문제가 없으면 첫 커밋과 푸시를 진행한다.

```powershell
git status
git add .
git commit -m "chore: initialize ReproLoop workspace"
git push -u origin main
```

---

## 9. 2인 협업 규칙과 GitHub Actions

GitHub 저장소의 `Settings -> Collaborators`에서 팀원을 초대한다.

권장 규칙:

- `main`에 직접 푸시하지 않는다.
- 기능마다 브랜치를 만든다.
- PR 병합 전 상대방 1명의 승인을 받는다.
- `lint`, `typecheck`, `test`, `build`가 통과해야 병합한다.
- DB migration 충돌은 한 사람이 최종 정리한다.
- 비밀 값은 GitHub가 아니라 비밀번호 관리 도구나 각 서비스의 secret manager로 공유한다.

브랜치 예시:

```text
feature/discord-interactions
feature/report-dashboard
feature/notification-worker
fix/attachment-validation
docs/setup-guide
```

초기 GitHub Actions에서 실행할 항목:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Playwright E2E는 초반에는 수동 또는 main 병합 후 실행으로 시작하고, 핵심 제출 흐름이 안정화되면 PR 필수 검사로 올린다.

---

## 10. Railway 배포 설정

Railway에서 GitHub 저장소를 연결하고 같은 repo에서 서비스 2개를 만든다.

Web 서비스:

```text
Build Command:
pnpm install --frozen-lockfile && pnpm --filter @reproloop/web build

Start Command:
pnpm --filter @reproloop/web start
```

Worker 서비스:

```text
Build Command:
pnpm install --frozen-lockfile && pnpm --filter @reproloop/worker build

Start Command:
pnpm --filter @reproloop/worker start
```

Railway Variables에 등록할 값:

```text
APP_URL
DATABASE_URL
SUPABASE_URL
SUPABASE_SECRET_KEY
SUPABASE_STORAGE_BUCKET
AUTH_SECRET
AUTH_DISCORD_ID
AUTH_DISCORD_SECRET
AUTH_TRUST_HOST=true
DISCORD_APPLICATION_ID
DISCORD_PUBLIC_KEY
DISCORD_BOT_TOKEN
SENTRY_DSN
```

배포 후 확인:

- [ ] Railway Web 서비스가 실행된다.
- [ ] Railway Worker 서비스가 실행된다.
- [ ] Discord OAuth Callback URL이 운영 도메인으로 등록되어 있다.
- [ ] Discord Interaction Endpoint가 운영 도메인으로 등록되어 있다.
- [ ] `/bug` 명령에서 리포트가 생성된다.
- [ ] 생성된 리포트가 대시보드에 표시된다.
- [ ] Worker가 알림 또는 후처리 작업을 처리한다.

---

## 완료 기준

초기 환경 설정은 다음 상태가 되면 완료로 본다.

- [ ] GitHub Private 저장소가 있다.
- [ ] 로컬 기본 브랜치가 `main`이다.
- [ ] `apps/web` Next.js 앱이 실행된다.
- [ ] `apps/worker` Worker 앱이 실행 준비되어 있다.
- [ ] `packages/db`, `packages/domain`, `packages/shared`가 workspace에 포함되어 있다.
- [ ] `.env.example`만 커밋되어 있고 실제 secret은 커밋되지 않았다.
- [ ] Supabase PostgreSQL과 Private Storage가 준비되어 있다.
- [ ] Discord OAuth와 Interaction Endpoint가 등록되어 있다.
- [ ] GitHub Actions 기본 검사가 구성되어 있다.
- [ ] Railway에 Web과 Worker를 나눠 배포할 수 있다.
