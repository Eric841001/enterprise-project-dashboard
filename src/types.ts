export type ProjectStatus = 'Lead' | 'Proposal' | 'Confirmed' | 'Planning' | 'In Progress' | 'At Risk' | 'Completed' | 'On Hold'
export type RiskLevel = 'Low' | 'Medium' | 'High'

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
  manager: string
  resources: string[]
  risk: RiskLevel
  scope: string
  phase: string
  updatedAt: string
  workMonths?: number[]
  importNote?: string
}

export interface Resource { id: string; name: string; role: string; skill: string; capacity: number }
