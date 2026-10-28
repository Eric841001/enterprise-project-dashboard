import type { Project } from './types'
import { ProjectFormDialog } from './ManagementDialogs'

// One editor and one atomic save path for every assignment entry point.
export function ProjectAssignmentEditor({ project, open, onClose }: {project:Project;open:boolean;onClose:()=>void}) {
  return <ProjectFormDialog project={project} open={open} onClose={onClose} />
}
