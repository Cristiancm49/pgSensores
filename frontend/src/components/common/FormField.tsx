import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export const fieldClass = 'mt-1.5 h-10 w-full rounded-[10px] border border-[#c7d2de] bg-white px-3 text-[13px] text-[#102033] outline-none transition placeholder:text-[#8795a5] hover:border-[#aebbc8] focus:border-[#0b6ffb] focus:ring-3 focus:ring-[#0b6ffb]/10 disabled:cursor-not-allowed disabled:bg-[#eef3f8]'

export function InputField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block text-[13px] font-semibold text-[#34465a]">{label}<input className={fieldClass} {...props} /></label>
}

export function SelectField({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <label className="block text-[13px] font-semibold text-[#34465a]">{label}<select className={fieldClass} {...props}>{children}</select></label>
}

export function TextareaField({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label className="block text-[13px] font-semibold text-[#34465a]">{label}<textarea className={`${fieldClass} h-24 resize-y py-2.5 leading-5`} {...props} /></label>
}

