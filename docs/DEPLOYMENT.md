# Deployment

## GitHub Pages

1. 저장소 Settings → Pages에서 GitHub Actions를 선택합니다.
2. Actions Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 등록합니다.
3. Supabase Authentication URL Configuration에 Pages URL과 `/**` redirect URL을 추가합니다.
4. `main` 또는 `master`에 push하거나 workflow dispatch를 실행합니다.
5. typecheck, lint, test, build가 모두 성공한 경우에만 배포됩니다.

커스텀 도메인을 추가하면 Vite base 설정을 환경 변수 기반으로 조정하고 Supabase redirect allowlist도 갱신합니다. Repository variable은 anon key에만 사용하며 service-role key는 절대 등록하지 않습니다.
