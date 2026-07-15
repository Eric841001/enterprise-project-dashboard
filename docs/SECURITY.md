# Security

- 비공개 인증이 기본이고 `noindex,nofollow`를 적용합니다.
- anon key는 공개 클라이언트 식별자이며 권한 경계는 사용자 JWT와 RLS입니다.
- service-role key, PAT, 비밀번호는 프런트엔드·Git·로그에 넣지 않습니다.
- Admin/Manager/Viewer 권한은 UI 숨김과 별개로 DB 정책이 강제합니다.
- 사용자 입력은 React의 기본 escaping을 유지하고 `dangerouslySetInnerHTML`을 사용하지 않습니다.
- 고객 연락처, 내부 메모, 위험은 공개 화면을 만들 때 제외해야 합니다.
- 운영 배포에는 CSP(`default-src 'self'`; 필요한 Supabase/API와 폰트 origin만 허용), HTTPS, 의존성 감사와 Supabase Security Advisor 검사를 권장합니다.

취약점 점검: `npm.cmd audit --omit=dev`. 자동 수정은 변경 내용을 검토한 뒤 적용합니다.
