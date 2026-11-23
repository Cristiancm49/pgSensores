import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'ghost' }
>

const variants = {
  primary: 'border border-[#0b6ffb] bg-[#0b6ffb] text-white shadow-[0_1px_2px_rgba(11,111,251,.18)] hover:border-[#075ccb] hover:bg-[#075ccb]',
  secondary: 'border border-[#c7d2de] bg-white text-[#34465a] shadow-[0_1px_2px_rgba(16,32,51,.04)] hover:border-[#aebbc8] hover:bg-[#f7f9fc]',
  danger: 'border border-[#c9342b] bg-[#c9342b] text-white shadow-[0_1px_2px_rgba(201,52,43,.16)] hover:border-[#aa2821] hover:bg-[#aa2821]',
  dangerOutline: 'border border-[#e6a5a0] bg-white text-[#b42318] shadow-[0_1px_2px_rgba(16,32,51,.03)] hover:border-[#c9342b] hover:bg-[#fff0ef]',
  ghost: 'border border-transparent text-[#4a5d70] hover:bg-[#eef3f8] hover:text-[#102033]',
}

export function Button({ children, className = '', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-[13px] font-semibold transition-[color,background-color,border-color,box-shadow,transform] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0b6ffb]/30 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

