export type ProjectStatus = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Confirmed' | 'Planning' | 'In Progress' | 'On Hold' | 'At Risk' | 'Completed' | 'Cancelled' | 'Archived'
export type RiskLevel = 'Low' | 'Medium' | 'High'
export type WorkMode = 'resident' | 'non_resident'

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
  risk: RiskLevel
  scope: string
  phase: string
  updatedAt: string
  workMonths?: number[]
  workPeriods?: Array<{ startDate: string; endDate: string }>
  importNote?: string
}

export interface Resource { id: string; name: string; role: string; skill: string; capacity: number }
