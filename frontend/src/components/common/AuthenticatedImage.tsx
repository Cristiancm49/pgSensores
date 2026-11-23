import { useQuery } from '@tanstack/react-query'
import { Image as ImageIcon } from 'lucide-react'
import { type ReactNode, useEffect, useMemo } from 'react'

export function AuthenticatedImage({ queryKey, load, alt, className, fallback }: { queryKey: unknown[]; load: () => Promise<Blob>; alt: string; className: string; fallback?: ReactNode }) {
  const image = useQuery({ queryKey: ['authenticated-image', ...queryKey], queryFn: load, retry: false, staleTime: Number.POSITIVE_INFINITY })
  const url = useMemo(() => image.data ? URL.createObjectURL(image.data) : null, [image.data])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  if (!url) return fallback ?? <span className={`${className} grid place-items-center bg-[#eaf3ff] text-[#1677ff]`}><ImageIcon size={24} /></span>
  return <img alt={alt} className={`${className} object-cover`} decoding="async" loading="lazy" src={url} />
}
