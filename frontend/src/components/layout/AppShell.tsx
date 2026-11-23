import {
  Bell, BellRing, Bot, ChevronDown, Cpu, FolderKanban, Gauge,
  LayoutDashboard, LogOut, MapPinned, Menu, PanelLeftClose, PanelLeftOpen, Radio, Search, Settings,
  Users, X, type LucideIcon,
} from 'lucide-react'
import { type FormEvent, type PropsWithChildren, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'

type NavigationItem = { label: string; icon: LucideIcon; to: string; adminOnly?: boolean }

const navigationGroups: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: 'Espacio de trabajo',
    items: [
      { label: 'Inicio', icon: LayoutDashboard, to: '/app/inicio' },
      { label: 'Proyectos', icon: FolderKanban, to: '/app/proyectos' },
    ],
  },
  {
    label: 'Operación IoT',
    items: [
      { label: 'Dispositivos', icon: Cpu, to: '/app/dispositivos' },
      { label: 'Canales IoT', icon: Gauge, to: '/app/canales' },
      { label: 'Simulador', icon: Bot, to: '/app/simulador' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { label: 'Alertas', icon: BellRing, to: '/app/alertas' },
      { label: 'Ubicaciones', icon: MapPinned, to: '/app/ubicaciones' },
      { label: 'Usuarios', icon: Users, to: '/app/usuarios', adminOnly: true },
    ],
  },
]

const routeLabels: Array<{ match: string; label: string }> = [
  { match: '/app/inicio', label: 'Panel general' },
  { match: '/app/proyectos', label: 'Proyectos' },
  { match: '/app/dispositivos', label: 'Dispositivos' },
  { match: '/app/canales', label: 'Canales IoT' },
  { match: '/app/simulador', label: 'Simulador IoT' },
  { match: '/app/alertas', label: 'Centro de alertas' },
  { match: '/app/ubicaciones', label: 'Ubicaciones' },
  { match: '/app/usuarios', label: 'Usuarios' },
  { match: '/app/perfil', label: 'Mi perfil' },
]

export function AppShell({ children }: PropsWithChildren) {
  const { logout, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('udlaiot-sidebar-collapsed') === 'true')
  const [profileOpen, setProfileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const initials = user?.full_name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'US'
  const routeLabel = routeLabels.find((item) => location.pathname.startsWith(item.match))?.label ?? 'UDLAIoT'

  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [menuOpen])

  useEffect(() => {
    localStorage.setItem('udlaiot-sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  async function endSession() {
    await logout()
    navigate('/login', { replace: true })
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = search.trim()
    navigate(value ? `/app/proyectos?buscar=${encodeURIComponent(value)}` : '/app/proyectos')
  }

  const renderSidebar = (compact: boolean) => (
    <aside className={`flex h-screen flex-col overflow-x-hidden overflow-y-auto bg-[#071a2b] py-3.5 text-white transition-[width,padding] duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${compact ? 'w-[76px] px-2' : 'w-[236px] px-3'}`}>
      <div className={`flex items-center py-1.5 transition-[gap,padding] duration-300 ${compact ? 'justify-center px-0' : 'gap-3 px-2'}`}>
        <div className="brand-mark grid size-10 shrink-0 place-items-center rounded-xl"><Radio size={20} strokeWidth={2.2} /></div>
        <div aria-hidden={compact} className={`min-w-0 overflow-hidden whitespace-nowrap transition-[width,opacity,transform] duration-200 ${compact ? 'w-0 -translate-x-2 opacity-0' : 'w-[146px] translate-x-0 opacity-100'}`}><p className="text-[15px] font-bold tracking-[-.01em]">UDLAIoT</p><p className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-[#93abc0]">PLATAFORMA DE LABORATORIO</p></div>
      </div>

      <nav aria-label="Navegación principal" className={`mt-5 transition-[padding] duration-300 ${compact ? 'space-y-3' : 'space-y-4'}`}>
        {navigationGroups.map((group) => {
          const items = group.items.filter((item) => !item.adminOnly || user?.is_admin)
          if (!items.length) return null
          return <div key={group.label}>
            <p aria-hidden={compact} className={`mb-1.5 overflow-hidden whitespace-nowrap text-[9px] font-bold uppercase tracking-[.16em] text-[#668198] transition-[height,opacity,padding] duration-200 ${compact ? 'h-0 px-0 opacity-0' : 'h-3 px-3 opacity-100'}`}>{group.label}</p>
            <div className="space-y-0.5">
              {items.map(({ label, icon: Icon, to }) => (
                <NavLink
                  aria-label={compact ? label : undefined}
                  className={({ isActive }) => `group flex h-10 items-center rounded-[10px] text-[13px] transition-[gap,padding,color,background-color,box-shadow] duration-200 ${compact ? 'justify-center gap-0 px-0' : 'gap-3 px-3'} ${isActive ? 'bg-[#0b6ffb] font-semibold text-white shadow-[0_7px_20px_rgba(11,111,251,.24)]' : 'text-[#b9cad8] hover:bg-white/[.07] hover:text-white'}`}
                  key={label}
                  onClick={() => setMenuOpen(false)}
                  title={compact ? label : undefined}
                  to={to}
                ><Icon className="shrink-0" size={18} strokeWidth={2} /><span aria-hidden={compact} className={`overflow-hidden whitespace-nowrap transition-[width,opacity,transform] duration-200 ${compact ? 'w-0 -translate-x-1 opacity-0' : 'w-[150px] translate-x-0 opacity-100'}`}>{label}</span></NavLink>
              ))}
            </div>
          </div>
        })}
      </nav>

    </aside>
  )

  return (
    <div className={`app-grid-background min-h-screen overflow-x-clip text-[#102033] transition-[grid-template-columns] duration-300 ease-[cubic-bezier(.4,0,.2,1)] lg:grid ${sidebarCollapsed ? 'lg:grid-cols-[76px_minmax(0,1fr)]' : 'lg:grid-cols-[236px_minmax(0,1fr)]'}`}>
      <a className="fixed left-3 top-2 z-[100] -translate-y-16 rounded-lg bg-[#0b6ffb] px-3 py-2 text-sm font-semibold text-white transition focus:translate-y-0" href="#contenido-principal">Saltar al contenido</a>
      <div className={`sticky top-0 hidden h-screen transition-[width] duration-300 lg:block ${sidebarCollapsed ? 'w-[76px]' : 'w-[236px]'}`}>{renderSidebar(sidebarCollapsed)}<button aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'} className="absolute -right-3 top-5 z-30 grid size-7 place-items-center rounded-full border border-[#c7d2de] bg-white text-[#4a5d70] shadow-[0_4px_12px_rgba(7,26,43,.16)] transition-[transform,color,background-color] duration-200 hover:scale-105 hover:bg-[#eaf3ff] hover:text-[#0b6ffb] focus-visible:outline focus-visible:outline-3 focus-visible:outline-[#0b6ffb]/30 active:scale-95" onClick={() => setSidebarCollapsed((value) => !value)} title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'} type="button">{sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}</button></div>
      {menuOpen && <div className="fixed inset-0 z-40 flex bg-[#071a2b]/60 backdrop-blur-[2px] lg:hidden"><div className="relative"><button className="absolute right-2.5 top-2.5 z-10 grid size-9 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/15" onClick={() => setMenuOpen(false)} type="button" aria-label="Cerrar menú"><X size={18} /></button>{renderSidebar(false)}</div><button className="flex-1" onClick={() => setMenuOpen(false)} type="button" aria-label="Cerrar menú" /></div>}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-[#dce3ea] bg-white/[.94] px-4 backdrop-blur-xl sm:px-5 xl:px-7">
          <button className="mr-3 grid size-10 place-items-center rounded-xl text-[#617184] hover:bg-[#eef3f8] lg:hidden" onClick={() => setMenuOpen(true)} type="button" aria-expanded={menuOpen} aria-label="Abrir menú"><Menu size={20} /></button>
          <div className="flex min-w-0 items-center gap-2 lg:hidden"><div className="brand-mark grid size-8 place-items-center rounded-lg text-white"><Radio size={16} /></div><span className="font-bold tracking-tight">UDLAIoT</span></div>
          <div className="hidden min-w-32 lg:block"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#8795a5]">Área actual</p><p className="mt-0.5 truncate text-[13px] font-semibold text-[#34465a]">{routeLabel}</p></div>
          <form className="ml-5 hidden w-full max-w-[480px] md:block" onSubmit={submitSearch} role="search">
            <label className="flex h-10 items-center gap-2.5 rounded-xl border border-[#dce3ea] bg-[#f7f9fc] px-3.5 text-[#617184] transition focus-within:border-[#8bbdff] focus-within:bg-white focus-within:ring-3 focus-within:ring-[#0b6ffb]/10">
              <Search size={17} />
              <input aria-label="Buscar proyectos" className="min-w-0 flex-1 bg-transparent text-[13px] text-[#102033] outline-none placeholder:text-[#8795a5]" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar un proyecto…" value={search} />
              <span className="hidden rounded-md border border-[#dce3ea] bg-white px-1.5 py-0.5 text-[9px] font-semibold text-[#8795a5] xl:inline">ENTER</span>
            </label>
          </form>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            <button className="relative grid size-10 place-items-center rounded-xl text-[#617184] hover:bg-[#eef3f8] hover:text-[#102033]" onClick={() => navigate('/app/alertas')} type="button" aria-label="Ver alertas"><Bell size={19} /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#0b6ffb] ring-2 ring-white" /></button>
            <div className="hidden h-7 w-px bg-[#dce3ea] sm:block" />
            <div className="relative">
              <button className="flex items-center gap-2 rounded-xl p-1.5 text-left hover:bg-[#eef3f8]" onClick={() => setProfileOpen((value) => !value)} type="button" aria-expanded={profileOpen}>
                <span className="grid size-9 place-items-center rounded-[10px] bg-[#eaf3ff] text-xs font-bold text-[#075ccb] ring-1 ring-[#cce2ff]">{initials}</span>
                <span className="hidden max-w-36 sm:block"><span className="block truncate text-[13px] font-semibold text-[#102033]">{user?.full_name}</span><span className="block truncate text-[10px] text-[#617184]">{user?.is_admin ? 'Administrador' : `@${user?.username}`}</span></span>
                <ChevronDown className={`hidden text-[#8795a5] transition sm:block ${profileOpen ? 'rotate-180' : ''}`} size={14} />
              </button>
              {profileOpen && <div className="absolute right-0 top-12 w-52 rounded-xl border border-[#dce3ea] bg-white p-1.5 shadow-[0_16px_40px_rgba(16,32,51,.14)]"><div className="border-b border-[#edf1f5] px-3 py-2 sm:hidden"><p className="truncate text-xs font-semibold">{user?.full_name}</p><p className="truncate text-[10px] text-[#617184]">@{user?.username}</p></div><button className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[13px] text-[#34465a] hover:bg-[#f3f6fa]" onClick={() => { setProfileOpen(false); navigate('/app/perfil') }} type="button"><Settings size={16} />Mi perfil</button><button className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[13px] text-[#c9342b] hover:bg-[#fff0ef]" onClick={endSession} type="button"><LogOut size={16} />Cerrar sesión</button></div>}
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-5 xl:px-7 xl:py-6" id="contenido-principal">{children}</main>
      </div>
    </div>
  )
}

