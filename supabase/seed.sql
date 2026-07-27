insert into public.customers(name) values ('Sample Hanseong Manufacturing'),('Sample Mirae Mobility'),('Sample Saerom Logistics'),('Sample Daehan Financial'),('Sample Areum Motors'),('Sample Bluepine Properties'),('Sample Onyu Trading'),('Sample Haneul Investment'),('Sample Solmar Hospitality'),('Sample Nuri Services'),('미래에셋생명'),('젠스타메이트'),('SK렌터카'),('삼양데이타시스템'),('현대차그룹'),('CJ대한통운'),('비엔세라'),('태용엔지니어링'),('보성공업'),('파라다이스'),('영원무역홀딩스'),('한양건설'),('WIZCNS'),('포스코DX') on conflict(name) do nothing;
insert into public.resources(name,role,primary_skill) values ('Consultant A','Project Manager','M365'),('Engineer B','Technical Consultant','Migration'),('Engineer C','M365 Engineer','M365'),('Security Specialist D','Security Engineer','Security'),('Consultant E','Technical Consultant','M365'),('Consultant F','Technical Consultant','M365'),('Cloud Engineer G','Azure Engineer','Azure OpenAI'),('설용환','Technical Consultant','M365'),('김태후','Technical Consultant','M365') on conflict(name) do nothing;
insert into public.projects(customer_id,project_code,name,category,project_type,probability,status,risk_level,phase,progress,start_date,end_date,scope_summary,import_note)
select c.id,v.code,v.name,v.category,v.project_type,v.probability,v.status::public.project_status,v.risk,v.phase,v.progress,v.start_date::date,v.end_date::date,v.scope,v.note from (values
('Sample Hanseong Manufacturing','S-HSM-M365','Microsoft 365 Governance Rollout','M365 Consulting','non_resident',100,'In Progress','Medium','Delivery',28,'2026-07-01','2026-12-31','Tenant governance, adoption, and rollout planning',null),
('Sample Mirae Mobility','S-MIR-M365','Workplace Migration Pilot','M365 Deployment','non_resident',50,'Proposal','Low','Proposal',0,'2026-03-01','2026-11-30','Phased productivity-platform migration pilot','Sample schedule intentionally uses non-contiguous months to exercise timeline behavior.'),
('Sample Saerom Logistics','S-SRM-M365','Microsoft 365 Readiness Assessment','M365 Deployment','non_resident',100,'Confirmed','Medium','Planning',15,'2026-08-01','2026-10-31','Microsoft 365 readiness and implementation planning',null),
('Sample Daehan Financial','S-DHF-SEC','Security Baseline Assessment','Security','non_resident',100,'Planning','High','Planning',8,'2026-07-01','2026-12-31','Identity and security-control baseline assessment',null),
('Sample Areum Motors','S-ARM-EDU','Microsoft 365 Adoption Program','M365 Education','non_resident',50,'Proposal','Low','Proposal',0,'2026-06-01','2026-11-30','End-user and administrator adoption program',null),
('Sample Bluepine Properties','S-BLP-M365','Collaboration Platform Modernization','M365 Deployment','non_resident',100,'In Progress','Medium','Delivery',42,'2026-05-01','2026-11-30','Collaboration-platform modernization and migration',null),
('Sample Onyu Trading','S-ONY-M365','Digital Workplace Discovery','M365 Deployment','non_resident',50,'Lead','High','Discovery',0,null,null,'Requirements discovery and high-level workplace roadmap',null),
('Sample Haneul Investment','S-HNI-AI','Azure AI Discovery Pilot','Azure OpenAI','non_resident',100,'In Progress','Medium','Delivery',18,'2026-07-01','2026-12-31','Azure AI proof-of-concept and governance discovery','Sample record uses the normalized Azure AI service name.'),
('Sample Solmar Hospitality','S-SOL-M365','Cloud Workplace Transition','M365 Deployment','non_resident',50,'Proposal','Medium','Proposal',0,'2026-08-01','2026-10-31','Cloud workplace transition planning',null),
('Sample Nuri Services','S-NUR-M365','Governance and Administrator Workshop','M365 Consulting','non_resident',50,'Proposal','Low','Discovery',0,null,null,'Governance review and administrator workshop',null),
('미래에셋생명','MZC-MAL-M365','업무망 M365 구축 프로젝트','M365 Deployment','resident',0,'Proposal','Low','Proposal',0,'2026-08-01','2027-01-31','Microsoft 365 workplace deployment proposal',null),
('젠스타메이트','MZC-GEN-M365','M365 Document Approval Automation','M365 Consulting','non_resident',0,'In Progress','Low','Delivery',0,null,null,'Microsoft 365 document approval automation',null),
('SK렌터카','MZC-SKR-GCP','GWS BigQuery Dashboard Build','Google Cloud','non_resident',0,'Qualified','Low','Scoping',0,null,null,'Google Workspace reporting dashboard build',null),
('삼양데이타시스템','MZC-SAM-EXO','Exchange Online Transition','M365 Migration','non_resident',0,'Proposal','Low','Proposal',0,null,null,'Exchange Online transition proposal',null),
('현대차그룹','MZC-HMG-COP','M365 Copilot Adoption Program','Copilot','non_resident',0,'Negotiation','Low','SOW Review',0,'2026-08-17',null,'Microsoft 365 Copilot adoption program',null),
('CJ대한통운','MZC-CJL-M365','미국법인 Microsoft 365 전환','M365 Migration','non_resident',0,'Planning','Low','Planning',0,null,null,'Google Workspace to Microsoft 365 transition planning',null),
('비엔세라','MZC-BNC-M365','Microsoft 365 Assessment and Consulting','M365 Consulting','non_resident',0,'In Progress','Low','Delivery',0,'2026-07-15',null,'Microsoft 365 assessment and consulting',null)
,('태용엔지니어링','MZC-TAE-M365','Microsoft 365 Workplace Build Assessment','M365 Deployment','non_resident',0,'Lead','Low','Discovery',0,null,null,'Microsoft 365 workplace, document management, workflow, and migration assessment',null)
,('보성공업','MZC-BOS-M365','Hiworks to Microsoft 365 Migration Scoping','M365 Migration','non_resident',0,'Proposal','Low','Scoping',0,null,null,'Hiworks to Microsoft 365 migration and security-readiness scoping',null)
,('파라다이스','MZC-PAR-SEC','Microsoft 365 Security and Operations Workshop','Security','non_resident',0,'Qualified','Low','Workshop',0,'2026-07-24','2026-07-24','Microsoft 365 security and operations assessment workshop',null)
,('영원무역홀딩스','MZC-YOH-M365','Microsoft 365 Optimization Consulting','M365 Consulting','non_resident',0,'Confirmed','Low','Planning',0,'2026-09-01',null,'Microsoft 365 optimization consulting, security design, PoC, and rollout roadmap',null)
,('한양건설','MZC-HYC-SEC','V3 Endpoint Security Quote','Security','non_resident',0,'Proposal','Low','Proposal',0,null,null,'V3 endpoint and server security license quote',null)
,('WIZCNS','MZC-WIZ-AI','AI OA Helpdesk Service Desk Build','Azure OpenAI','non_resident',0,'Lead','Medium','Discovery',0,null,null,'AI helpdesk with LLM/RAG, Teams, Microsoft 365, AD, and ITAM integration',null)
,('포스코DX','MZC-PDX-SEC','Microsoft Purview Audit Training','Security','non_resident',0,'Qualified','Low','Scoping',0,null,null,'SharePoint Online and OneDrive audit training with Purview role and log operations guidance','Customer requested offline training materials and available dates within three weeks.')) v(customer,code,name,category,project_type,probability,status,risk,phase,progress,start_date,end_date,scope,note) join public.customers c on c.name=v.customer on conflict(project_code) do nothing;

update public.projects p
set project_manager_id = r.id
from (values
('MZC-GEN-M365','설용환'),
('MZC-HMG-COP','김태후'),
('MZC-CJL-M365','설용환'),
('MZC-BNC-M365','김태후')
) m(code,manager_name)
join public.resources r on r.name = m.manager_name
where p.project_code = m.code;
