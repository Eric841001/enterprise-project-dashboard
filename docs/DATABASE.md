# Database

초기 마이그레이션은 UUID 기본키, 외래키, 확률·진행률·할당률 범위 제약, 날짜 순서 제약, 조회 인덱스와 RLS를 생성합니다.

- `profiles`: 인증 사용자 역할
- `customers`, `resources`, `projects`: 핵심 마스터
- `project_assignments`: 리소스 다대다 배정 및 기간·할당률
- `project_milestones`, `project_deliverables`: 일정과 산출물
- `project_risks`, `project_notes`: 제한된 운영 세부 정보
- `project_activity_logs`: 변경 이력
- `app_settings`: 관리 설정

Viewer는 인증된 읽기만, Manager와 Admin은 운영 데이터 쓰기가 가능합니다. 프로필 역할 변경은 본인 업데이트 정책에서 보존되며 Admin만 전체 관리합니다. 운영 전 Supabase SQL linter와 Security Advisor로 정책을 재검토하십시오.
