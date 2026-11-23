import { useQueries, useQuery } from '@tanstack/react-query'
import { devicesApi, locationsApi, projectsApi } from '../crud/api'

export function usePortfolioInventory() {
  const projects = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })
  const projectList = projects.data ?? []
  const deviceQueries = useQueries({
    queries: projectList.map((project) => ({
      queryKey: ['devices', project.id],
      queryFn: () => devicesApi.list(project.id),
    })),
  })
  const locationQueries = useQueries({
    queries: projectList.map((project) => ({
      queryKey: ['locations', project.id],
      queryFn: () => locationsApi.list(project.id),
    })),
  })
  const devices = deviceQueries.flatMap((query) => query.data ?? [])
  const locations = locationQueries.flatMap((query) => query.data ?? [])
  const channelQueries = useQueries({
    queries: devices.map((device) => ({
      queryKey: ['channels', device.id, 'all'],
      queryFn: () => devicesApi.channels(device.id),
    })),
  })
  const channels = channelQueries.flatMap((query) => query.data ?? [])
  const projectById = new Map(projectList.map((project) => [project.id, project]))
  const deviceById = new Map(devices.map((device) => [device.id, device]))
  const locationById = new Map(locations.map((location) => [location.id, location]))
  const loading = projects.isLoading || deviceQueries.some((query) => query.isLoading)
  const loadingChannels = loading || channelQueries.some((query) => query.isLoading)
  const loadingLocations = projects.isLoading || locationQueries.some((query) => query.isLoading)
  const error = projects.isError || deviceQueries.some((query) => query.isError)

  return {
    projects: projectList,
    devices,
    channels,
    locations,
    projectById,
    deviceById,
    locationById,
    loading,
    loadingChannels,
    loadingLocations,
    error,
    refetch: async () => {
      await projects.refetch()
      await Promise.all(deviceQueries.map((query) => query.refetch()))
      await Promise.all(locationQueries.map((query) => query.refetch()))
      await Promise.all(channelQueries.map((query) => query.refetch()))
    },
  }
}
