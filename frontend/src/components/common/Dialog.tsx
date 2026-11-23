import { X } from 'lucide-react'
import { type PropsWithChildren, useEffect } from 'react'

type DialogProps = PropsWithChildren<{
  open: boolean
  title: string
  onClose: () => void
  size?: 'md' | 'lg' | 'xl'
}>

export function Dialog({ open, title, onClose, children, size = 'md' }: DialogProps) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onClose])
  if (!open) return null
  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#071a2b]/55 p-3 backdrop-blur-[3px] sm:p-4" role="presentation">
      <section className={`max-h-[90vh] w-full ${widths[size]} overscroll-contain overflow-auto rounded-2xl border border-white/60 bg-white shadow-[0_28px_80px_rgba(7,26,43,.28)]`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#dce3ea] bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
          <div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#0b6ffb]">UDLAIoT</p><h2 className="mt-0.5 text-base font-bold tracking-[-.01em] text-[#102033]">{title}</h2></div>
          <button className="grid size-9 place-items-center rounded-[10px] text-[#617184] hover:bg-[#eef3f8] hover:text-[#102033]" onClick={onClose} type="button" aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="p-4 sm:p-5">{children}</div>
      </section>
    </div>
  )
}

