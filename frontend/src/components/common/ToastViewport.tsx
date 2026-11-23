import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Toast = { id: number; type: 'success' | 'error'; message: string }

export function ToastViewport() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const activeToasts = useRef<Toast[]>([])
  const timers = useRef(new Map<number, number>())

  useEffect(() => {
    const timersByToastId = timers.current
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Omit<Toast, 'id'>>).detail
      if (activeToasts.current.some((toast) => toast.type === detail.type && toast.message === detail.message)) return

      const id = Date.now() + Math.random()
      const nextToast = { ...detail, id }
      const next = [...activeToasts.current.slice(-3), nextToast]
      activeToasts.current = next
      setToasts(next)
      const timer = window.setTimeout(() => {
        timersByToastId.delete(id)
        const remaining = activeToasts.current.filter((toast) => toast.id !== id)
        activeToasts.current = remaining
        setToasts(remaining)
      }, 4000)
      timersByToastId.set(id, timer)
    }
    window.addEventListener('nexiot:notification', listener)
    return () => {
      window.removeEventListener('nexiot:notification', listener)
      timersByToastId.forEach((timer) => window.clearTimeout(timer))
      timersByToastId.clear()
    }
  }, [])
  function dismiss(id: number) {
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
    const remaining = activeToasts.current.filter((toast) => toast.id !== id)
    activeToasts.current = remaining
    setToasts(remaining)
  }

  return <div aria-live="polite" className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">{toasts.map((toast) => <div className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3 shadow-lg ${toast.type === 'success' ? 'border-[#abefc6]' : 'border-[#fecdca]'}`} key={toast.id}>{toast.type === 'success' ? <CheckCircle2 className="mt-0.5 shrink-0 text-[#16b364]" size={19} /> : <CircleAlert className="mt-0.5 shrink-0 text-[#d92d20]" size={19} />}<p className="min-w-0 flex-1 text-sm text-[#344054]">{toast.message}</p><button aria-label="Cerrar notificación" className="text-[#98a2b3]" onClick={() => dismiss(toast.id)} type="button"><X size={16} /></button></div>)}</div>
}
