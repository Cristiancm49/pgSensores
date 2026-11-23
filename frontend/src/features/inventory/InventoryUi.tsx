import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type { ReactNode } from 'react'

export function InventoryHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="mb-1 text-[9px] font-bold uppercase tracking-[.15em] text-[#0b6ffb]">UDLAIoT · Operación</p><h1 className="text-[clamp(1.45rem,2.4vw,1.8rem)] font-bold leading-tight tracking-[-.025em] text-[#102033]">{title}</h1><p className="mt-1 max-w-3xl text-[13px] leading-5 text-[#617184]">{description}</p></div>{actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}</div>
}

export function InventoryToolbar({ children, search, onSearch, placeholder }: { children?: ReactNode; search: string; onSearch: (value: string) => void; placeholder: string }) {
  return <div className="mt-4 flex flex-col gap-2 rounded-[14px] border border-[#dce3ea] bg-white p-2.5 shadow-[0_1px_3px_rgba(16,32,51,.05)] sm:flex-row sm:items-center"><label className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border border-[#c7d2de] bg-[#f7f9fc] px-3 text-[#617184] transition focus-within:border-[#8bbdff] focus-within:bg-white focus-within:ring-3 focus-within:ring-[#0b6ffb]/10"><Search size={16} /><input aria-label="Buscar" className="min-w-0 flex-1 bg-transparent text-[13px] text-[#102033] outline-none placeholder:text-[#8795a5]" onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} value={search} /></label>{children}</div>
}

export function InventorySelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="flex w-full items-center gap-2 text-xs font-medium text-[#617184] sm:w-auto"><span className="sr-only">{label}</span><select aria-label={label} className="h-10 w-full min-w-36 rounded-[10px] border border-[#c7d2de] bg-white px-3 text-[13px] text-[#34465a] outline-none hover:border-[#aebbc8] focus:border-[#0b6ffb] sm:w-auto" onChange={(event) => onChange(event.target.value)} value={value}>{children}</select></label>
}

export function InventorySkeleton() {
  return <div className="mt-4 animate-pulse overflow-hidden rounded-[14px] border border-[#dce3ea] bg-white"><div className="h-11 bg-[#eef3f8]" />{Array.from({ length: 5 }, (_, index) => <div className="mx-4 h-14 border-b border-[#edf1f5] py-3" key={index}><div className="h-full rounded-lg bg-[#eef3f8]" /></div>)}</div>
}

export function InventoryEmpty({ children }: { children: ReactNode }) {
  return <div className="grid min-h-44 place-items-center rounded-[14px] border border-dashed border-[#b9c6d3] bg-white p-6 text-center text-sm text-[#617184] shadow-[0_1px_3px_rgba(16,32,51,.03)]">{children}</div>
}

export function CompactStats({ items }: { items: Array<{ label: string; value: number; tone?: 'blue' | 'green' | 'amber' | 'red' | 'purple' }> }) {
  const tones = {
    blue: 'text-[#0b6ffb]',
    green: 'text-[#139a5b]',
    amber: 'text-[#b86608]',
    red: 'text-[#c9342b]',
    purple: 'text-[#7047c8]',
  }
  return <div className="mt-4 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap">{items.map((item) => <div className="flex min-h-15 items-center justify-between gap-4 rounded-xl border border-[#dce3ea] bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(16,32,51,.035)] lg:min-w-36 lg:flex-1" key={item.label}><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#617184]">{item.label}</p><p className={`text-lg font-bold tabular-nums tracking-[-.02em] ${tones[item.tone ?? 'blue']}`}>{item.value}</p></div>)}</div>
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, label = 'resultados' }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void; label?: string }) {
  if (total <= pageSize) return null
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, total)
  return <nav aria-label="Paginación" className="flex flex-col gap-3 border-t border-[#dce3ea] bg-[#f7f9fc] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
    <p aria-live="polite" className="text-xs text-[#617184]">Mostrando <strong className="font-semibold text-[#34465a]">{start}–{end}</strong> de <strong className="font-semibold text-[#34465a]">{total}</strong> {label}</p>
    <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
      <label className="flex items-center gap-2 text-xs text-[#617184]">Filas<select aria-label="Filas por página" className="h-8 rounded-lg border border-[#c7d2de] bg-white px-2 text-xs text-[#34465a]" onChange={(event) => onPageSizeChange(Number(event.target.value))} value={pageSize}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
      <span className="min-w-24 text-center text-xs font-medium text-[#4a5d70]">Página {currentPage} de {pageCount}</span>
      <div className="flex gap-1"><button aria-label="Página anterior" className="grid size-8 place-items-center rounded-lg border border-[#c7d2de] bg-white text-[#4a5d70] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-40" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} type="button"><ChevronLeft size={15} /></button><button aria-label="Página siguiente" className="grid size-8 place-items-center rounded-lg border border-[#c7d2de] bg-white text-[#4a5d70] hover:bg-[#eef3f8] disabled:cursor-not-allowed disabled:opacity-40" disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)} type="button"><ChevronRight size={15} /></button></div>
    </div>
  </nav>
}

export function StateBadge({ state }: { state: string }) {
  const style = state === 'conectado' || state === 'activo'
    ? 'bg-[#e8f7ef] text-[#137a49]'
    : state === 'error'
      ? 'bg-[#fff0ef] text-[#ad2c25]'
      : state === 'inactivo'
        ? 'bg-[#eef3f8] text-[#617184]'
        : 'bg-[#fff4df] text-[#9a5709]'
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${style}`}><span className="size-1.5 rounded-full bg-current" />{state}</span>
}

