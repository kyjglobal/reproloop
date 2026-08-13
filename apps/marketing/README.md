# ReproLoop Marketing

ReproLoop의 공개 홍보용 Next.js 랜딩 페이지입니다. ChatGPT Pages용 프로젝트에서 UI와 이미지 자산을 가져오고, Vercel에서 실행되는 표준 Next.js 앱으로 전환했습니다.

## 로컬 실행

저장소 루트에서 실행합니다.

```powershell
pnpm --filter @reproloop/marketing dev
```

## Vercel 설정

Git 저장소를 Vercel 프로젝트에 연결하고 다음 값을 설정합니다.

- Framework Preset: `Next.js`
- Root Directory: `apps/marketing`
- Production Branch: `main`
- Optional Environment Variable: `NEXT_PUBLIC_SITE_URL=https://reproloop.com`

빌드 명령과 출력 디렉터리는 Next.js 기본값을 사용합니다. 모노레포 루트의 `pnpm-lock.yaml`을 기준으로 의존성이 설치됩니다.

`NEXT_PUBLIC_SITE_URL`을 생략하면 Vercel의 `VERCEL_PROJECT_PRODUCTION_URL`을 사용합니다. 커스텀 도메인을 연결한 뒤 주소를 명시적으로 고정하고 싶을 때만 `NEXT_PUBLIC_SITE_URL`을 설정합니다.
