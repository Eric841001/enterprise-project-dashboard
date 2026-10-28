export type ProjectStatus = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Confirmed' | 'Planning' | 'In Progress' | 'On Hold' | 'At Risk' | 'Completed' | 'Cancelled' | 'Archived'
export type RiskLevel = 'Low' | 'Medium' | 'High'
export type WorkMode = 'resident' | 'non_resident'
export type FollowUpStatus = 'Not Required' | 'Pending' | 'Waiting' | 'Done'
export type VerificationState = 'unverified' | 'tentative' | 'confirmed'
export interface EvidenceBasis { source: 'gmail' | 'teams'; reference: string; checkedAt: string }
export interface DatedAssignment {
  id?: string; resourceId?: string; allocation: number; startDate: string; endDate: string;
  verification?: VerificationState | 'legacy'; kind?: 'allocation' | 'included'; parentId?: string | null; basis?: EvidenceBasis | null
}

export interface Project {
  id: string
  customer: string
  name: string
  category: string
  probability: number
  status: ProjectStatus
  startDate: string | null
  endDate: string | null
  progress: number
  progressEstimated?: boolean
  workMode?: WorkMode
  manager: string
  resources: string[]
  resourceAllocations?: Record<string, number>
  resourceAssignments?: Record<string, DatedAssignment[]>
  version?: string
  contractStartDate?: string | null
  contractEndDate?: string | null
  contractState?: VerificationState
  contractBasis?: EvidenceBasis | null
  scheduleBasis?: EvidenceBasis | null
  risk: RiskLevel
  scope: string
  phase: string
  updatedAt: string
  workMonths?: number[]
  workPeriods?: Array<{ startDate: string; endDate: string }>
  importNote?: string
  followUpStatus?: FollowUpStatus
  nextAction?: string
  nextActionDueDate?: string | null
  evidenceLastAt?: string | null
  evidenceSummary?: string
}

export interface Resource { id: string; name: string; role: string; skill: string; capacity: number }
