# Teams 개인 앱 배포

`npm.cmd run build:teams`를 실행하면 `dist/teams/project-dashboard-teams.zip`이 생성됩니다. 이 파일은 개인 탭만 포함하며 팀 또는 채널 탭을 제공하지 않습니다.

## Teams 관리자 센터

1. **Teams 앱 > 앱 관리**에서 `project-dashboard-teams.zip`을 업로드합니다.
2. 업로드된 **Project Dashboard** 앱의 사용자 할당을 **특정 사용자 또는 그룹**으로 변경하고, 설용환님 계정 하나만 선택합니다.
3. **Teams 앱 > 설정 정책**에서 해당 사용자에게만 앱을 설치·고정합니다. 다른 전역 정책에는 앱을 추가하지 않습니다.

Teams의 할당은 앱 검색·설치 범위를 제어합니다. 운영 데이터 열람은 Supabase의 승인 프로필과 RLS가 별도로 제어하므로, Teams에 할당한 것과 같은 계정 하나만 `profiles.is_approved = true`로 유지해야 합니다.

## 배포 전 확인

- `https://eric841001.github.io/enterprise-project-dashboard/`가 HTTPS로 열리는지 확인합니다.
- Teams 탭 안에서 Supabase 로그인과 데이터 조회가 정상인지 확인합니다.
- 다른 계정으로는 Teams에서 앱을 찾거나 설치할 수 없고, 직접 URL에서도 운영 데이터를 읽을 수 없는지 확인합니다.
