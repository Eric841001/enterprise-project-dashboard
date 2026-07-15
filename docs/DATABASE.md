# Database

초기 마이그레이션은 UUID 기본키, 외래키, 확률·진행률·할당률 범위 제약, 날짜 순서 제약, 조회 인덱스와 RLS를 생성합니다.

- `profiles`: 인증 사용자 역할
- `customers`, `resources`, `projects`: 핵심 마스터
- `project_assignments`: 리소스 다대다 배정 및 기간·할당률
- `project_milestones`, `project_deliverables`: 일정과 산출물
- `project_risks`, `project_notes`: 제한된 운영 세부 정보
- `project_activity_logs`: 변경 이력
- `app_settings`: 관리 설정

`is_approved=true`인 Viewer만 운영 데이터를 읽을 수 있고, 승인된 Manager와 Admin만 운영 데이터를 쓸 수 있습니다. 신규 인증 사용자는 기본적으로 미승인 Viewer이며 Admin이 승인과 역할을 관리합니다. 운영 전 Supabase SQL linter와 Security Advisor로 정책을 재검토하십시오.
