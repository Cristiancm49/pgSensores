import { apiRequest } from '../../services/api'

export type HealthResponse = { status: string; database: string; mqtt: string }

export function getApiHealth() {
  return apiRequest<HealthResponse>('/api/health/ready')
}
