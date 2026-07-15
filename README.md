# Project Portfolio Dashboard

Microsoft 365, Azure, Security, AI 컨설팅 프로젝트의 고객, 일정, 리소스, 위험을 관리하는 한국어 우선 포트폴리오 대시보드입니다. GitHub Pages에는 정적 React UI를 배포하고, 인증과 영속 데이터는 Supabase가 담당합니다.

## 주요 기능

- 경영 KPI, 상태 분포, 월별 운영 추세와 주의 항목
- 검색·상태 필터·고유 URL을 지원하는 프로젝트 포트폴리오
- 1월~12월 연간 타임라인과 불연속 작업 기간 표시
- 월별 리소스 할당, 100% 초과 과부하 경고
- 고객 포트폴리오, 규칙 기반 월간 경영 요약
- Excel 호환 UTF-8 BOM CSV 내보내기
- Supabase 이메일 인증, Admin/Manager/Viewer RLS 설계
- 모바일 반응형 UI, 라이트/다크 모드, GitHub Pages 라우팅 폴백

## 기술 구성

React 19, TypeScript, Vite, React Router, Recharts, Supabase, Vitest, ESLint를 사용합니다. 서비스 역할 키나 GitHub 토큰은 브라우저 코드에 사용하지 않습니다.

## 로컬 실행

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Supabase 연결 전에는 구조화된 2026 포트폴리오가 **읽기 전용 미리보기**로 표시됩니다. 데이터 변경을 `localStorage`에 가짜로 저장하지 않습니다.

## Supabase 설정

1. Supabase 프로젝트를 만들고 SQL Editor에서 `supabase/migrations/202607150001_initial_schema.sql`을 실행합니다.
2. 이어서 `supabase/seed.sql`을 한 번 실행합니다. `ON CONFLICT`를 사용해 중복 생성을 방지합니다.
3. Authentication에서 이메일 로그인을 활성화하고 첫 사용자를 만듭니다.
4. 해당 사용자 id로 `profiles` 행을 만들고 `role`을 `admin`으로 지정합니다.
5. `.env.local`에 공개 URL과 anon key만 입력합니다.

```sql
insert into public.profiles(id, display_name, role)
values ('AUTH_USER_UUID', '관리자', 'admin');
```

## 검증

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

## GitHub Pages 배포

Repository Settings → Pages → Source에서 **GitHub Actions**를 선택합니다. Actions Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 등록하고 `main` 또는 `master`에 push합니다. Vite base path와 SPA `404.html` 폴백은 프로젝트 저장소 URL에 맞게 자동 적용됩니다.

## 문서

- [아키텍처](docs/ARCHITECTURE.md)
- [데이터베이스](docs/DATABASE.md)
- [배포](docs/DEPLOYMENT.md)
- [보안](docs/SECURITY.md)
- [사용자 가이드](docs/USER_GUIDE.md)
- [테스트 계획](docs/TEST_PLAN.md)

## 현재 범위와 제한

핵심 분석·검색·필터·타임라인·CSV UI와 운영 DB/RLS 기반은 완료되어 있습니다. 실제 CRUD 폼, CSV 가져오기 미리보기, 세부 위험/마일스톤 편집, 사용자 관리 UI는 스키마가 준비된 후속 구현 영역입니다. Supabase와 GitHub 저장소의 수동 설정 없이는 실제 로그인·영속 저장·공개 URL 배포가 활성화되지 않습니다.

향후에는 Supabase 실데이터 쿼리 계층, 감사 트리거, 저장 필터, 다국어, 세부 보고서와 PNG 내보내기를 순차 적용합니다.
