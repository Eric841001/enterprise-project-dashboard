# Architecture

```text
Browser / GitHub Pages
  React + Router + charts
          │ anon key + user JWT
          ▼
Supabase Auth ── PostgreSQL + RLS
                    ├─ customers / projects / resources
                    ├─ assignments / milestones / deliverables
                    └─ risks / notes / activity logs
```

정적 호스팅과 데이터 계층을 분리합니다. 브라우저는 공개 anon key와 로그인 세션만 사용하고 모든 쓰기 권한은 RLS가 다시 확인합니다. `src/data.ts`는 Supabase 연결 전 UX 검증을 위한 읽기 전용 초기 포트폴리오이며 운영 저장소가 아닙니다.

라우트는 `/`, `/projects`, `/projects/:id`, `/schedule`, `/resources`, `/customers`, `/reports`, `/settings`로 구성됩니다. GitHub Pages의 직접 URL 접근은 `public/404.html`이 원래 경로를 query string으로 전달하고 `index.html`이 복원합니다.
