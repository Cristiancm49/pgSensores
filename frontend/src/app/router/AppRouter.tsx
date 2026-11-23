import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'

const AlertsPage = lazy(() => import('../../pages/AlertsPage').then((module) => ({ default: module.AlertsPage })))
const DeviceDetailPage = lazy(() => import('../../pages/DeviceDetailPage').then((module) => ({ default: module.DeviceDetailPage })))
const DeviceConsolePage = lazy(() => import('../../pages/DeviceConsolePage').then((module) => ({ default: module.DeviceConsolePage })))
const DevicesPage = lazy(() => import('../../pages/DevicesPage').then((module) => ({ default: module.DevicesPage })))
const HomePage = lazy(() => import('../../pages/HomePage').then((module) => ({ default: module.HomePage })))
const LocationsPage = lazy(() => import('../../pages/LocationsPage').then((module) => ({ default: module.LocationsPage })))
const LoginPage = lazy(() => import('../../pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const ProfilePage = lazy(() => import('../../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const ProjectDetailPage = lazy(() => import('../../pages/ProjectDetailPage').then((module) => ({ default: module.ProjectDetailPage })))
const ProjectsPage = lazy(() => import('../../pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage })))
const SimulatorPage = lazy(() => import('../../pages/SimulatorPage').then((module) => ({ default: module.SimulatorPage })))
const UsersPage = lazy(() => import('../../pages/UsersPage').then((module) => ({ default: module.UsersPage })))
const ChannelsPage = lazy(() => import('../../pages/ChannelsPages').then((module) => ({ default: module.ChannelsPage })))

function LoadingScreen() {
  return <div className="app-grid-background grid min-h-screen place-items-center"><div className="text-center"><span className="mx-auto block size-7 animate-spin rounded-full border-2 border-[#cce2ff] border-t-[#0b6ffb]" /><p className="mt-3 text-xs font-semibold text-[#617184]">Preparando UDLAIoT…</p></div></div>
}

function ProtectedRoutes() {
  const { loading, user } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function PublicOnlyRoute() {
  const { loading, user } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? <Navigate to="/app/inicio" replace /> : <Outlet />
}

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingScreen />}><Routes>
      <Route element={<PublicOnlyRoute />}><Route path="/login" element={<LoginPage />} /></Route>
      <Route element={<ProtectedRoutes />}>
        <Route path="/app/inicio" element={<HomePage />} />
        <Route path="/app/proyectos" element={<ProjectsPage />} />
        <Route path="/app/proyectos/:projectId" element={<ProjectDetailPage />} />
        <Route path="/app/dispositivos" element={<DevicesPage />} />
        <Route path="/app/dispositivos/:deviceId" element={<DeviceDetailPage />} />
        <Route path="/app/dispositivos/:deviceId/consola" element={<DeviceConsolePage />} />
        <Route path="/app/canales" element={<ChannelsPage />} />
        <Route path="/app/sensores" element={<Navigate to="/app/canales?tipo=sensor" replace />} />
        <Route path="/app/actuadores" element={<Navigate to="/app/canales?tipo=actuador" replace />} />
        <Route path="/app/simulador" element={<SimulatorPage />} />
        <Route path="/app/ubicaciones" element={<LocationsPage />} />
        <Route path="/app/usuarios" element={<UsersPage />} />
        <Route path="/app/alertas" element={<AlertsPage />} />
        <Route path="/app/perfil" element={<ProfilePage />} />
      </Route>
      <Route path="/" element={<Navigate to="/app/inicio" replace />} />
      <Route path="*" element={<Navigate to="/app/inicio" replace />} />
    </Routes></Suspense>
  )
}
