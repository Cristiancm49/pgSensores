import { useQuery } from '@tanstack/react-query'
import { Terminal } from 'lucide-react'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

import { devicesApi } from '../features/crud/api'
import { DeviceConsoleDialog } from '../features/iot/components/DeviceConsoleDialog'

export function DeviceConsolePage() {
  const { deviceId = '' } = useParams()
  const device = useQuery({ queryKey: ['device', deviceId], queryFn: () => devicesApi.get(deviceId) })

  useEffect(() => {
    const previousTitle = document.title
    document.title = device.data ? `Consola · ${device.data.name}` : 'Consola · UDLAIoT'
    return () => { document.title = previousTitle }
  }, [device.data])

  if (device.isLoading) return <ConsoleStatus message="Conectando con el dispositivo…" />
  if (!device.data) return <ConsoleStatus message="No fue posible abrir la consola de este dispositivo." />

  return <DeviceConsoleDialog device={device.data} onClose={() => window.close()} standalone />
}

function ConsoleStatus({ message }: { message: string }) {
  return <main className="grid min-h-dvh place-items-center bg-[#07111d] p-6 text-center text-[#8fa5bb]"><div><Terminal className="mx-auto text-[#4b6c8c]" size={34} /><p className="mt-3 text-sm">{message}</p></div></main>
}
