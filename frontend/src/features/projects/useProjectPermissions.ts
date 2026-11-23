import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../auth/AuthContext'
import { projectsApi } from '../crud/api'

export function useProjectPermissions(projectId?: string) {
  const { user } = useAuth()
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => projectsApi.get(projectId!), enabled: Boolean(projectId) })
  const members = useQuery({ queryKey: ['members', projectId], queryFn: () => projectsApi.members(projectId!), enabled: Boolean(projectId) })
  const role = members.data?.find((member) => member.user_id === user?.id)?.role_code
  const owner = project.data?.owner_id === user?.id || role === 'propietario'
  return {
    canRead: Boolean(user && projectId),
    canWrite: Boolean(user?.is_admin || owner || role === 'editor'),
    canManage: Boolean(user?.is_admin || owner),
  }
}
