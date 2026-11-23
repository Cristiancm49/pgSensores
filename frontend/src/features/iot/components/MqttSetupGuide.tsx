import { BookOpen, CheckCircle2, Copy, RadioTower, Server, TerminalSquare, Wifi } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Device, DeviceMqttConfiguration } from '../../../types/entities'
import { usesSerialBridge } from '../connectionLabel'

type Props = {
  activeUsername?: string
  configuration?: DeviceMqttConfiguration
  device: Device
  loading: boolean
}

export function MqttSetupGuide({ activeUsername, configuration, device, loading }: Props) {
  const host = configuration?.mqtt_host ?? '…'
  const port = configuration?.mqtt_port ?? '…'
  const websocketPort = configuration?.mqtt_websocket_port ?? '…'
  const clientId = configuration?.client_id ?? device.device_identifier
  const topicBase = configuration?.topic_base ?? `nexiot/devices/${device.id}`
  const username = activeUsername ?? '<USUARIO_MQTT>'
  const telemetryTopic = `${topicBase}/telemetry/temperatura`
  const commandTopic = `${topicBase}/commands/#`
  const serialBridge = usesSerialBridge(device)
  const subscribeExample = `mosquitto_sub -h ${host} -p ${port} -u "${username}" -P "<CONTRASEÑA>" -i "${clientId}" -t "${commandTopic}" -q 1`
  const publishExample = `mosquitto_pub -h ${host} -p ${port} -u "${username}" -P "<CONTRASEÑA>" -i "${clientId}" -t "${telemetryTopic}" -m '{"value":24.6}' -q 1`
  const esp32Example = `client.setServer("${host}", ${port});
client.connect("${clientId}", "${username}", "<CONTRASEÑA>");
client.publish("${topicBase}/status", "online", true);
client.subscribe("${topicBase}/commands/#");`
  const bridgeExample = `py -3.12 simulator\\serial_mqtt_bridge.py --port COM4 --device-id ${device.id} --username "${username}" --password "<CONTRASEÑA>"`

  const topics = [
    { direction: 'Publicar', topic: `${topicBase}/status`, purpose: 'online / offline' },
    { direction: 'Publicar', topic: `${topicBase}/telemetry/{clave}`, purpose: 'Telemetría del sensor' },
    { direction: 'Publicar', topic: `${topicBase}/state/{clave}`, purpose: 'Estado actual' },
    { direction: 'Publicar', topic: `${topicBase}/ack/{clave}`, purpose: 'Confirmación del comando' },
    { direction: 'Suscribir', topic: `${topicBase}/commands/{clave}`, purpose: 'Órdenes para actuadores' },
  ]

  return <div className="mt-4 space-y-4">
    <section className="overflow-hidden rounded-2xl border border-[#cfe1f5] bg-[linear-gradient(135deg,#f7fbff_0%,#edf6ff_100%)] shadow-[0_6px_24px_rgba(22,119,255,.06)]">
      <div className="flex flex-col gap-3 border-b border-[#d9e8f7] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#1677ff] text-white shadow-[0_8px_18px_rgba(22,119,255,.22)]"><RadioTower size={20} /></span><div><h3 className="text-sm font-bold text-[#102033]">Configuración de Mosquitto</h3><p className="mt-1 text-xs leading-5 text-[#617184]">Datos públicos del broker y acceso aislado para este dispositivo.</p></div></div><span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${configuration?.broker_connected ? 'bg-[#e8f7ef] text-[#137a49]' : 'bg-[#fff4df] text-[#9a5709]'}`}><span className="size-1.5 rounded-full bg-current" />{loading ? 'Comprobando broker…' : configuration?.broker_connected ? 'Broker disponible' : 'Broker sin conexión'}</span></div>
      <div className="grid gap-px bg-[#d9e8f7] sm:grid-cols-2 lg:grid-cols-4"><ConnectionValue icon={Server} label="Servidor TCP" value={`${host}:${port}`} /><ConnectionValue icon={Wifi} label="WebSocket" value={`ws://${host}:${websocketPort}`} /><ConnectionValue icon={TerminalSquare} label="Client ID" value={clientId} /><ConnectionValue icon={RadioTower} label="Topic base" value={topicBase} /></div>
    </section>

    <section className="rounded-2xl border border-[#dce3ea] bg-white p-4 shadow-[0_1px_3px_rgba(16,32,51,.04)] sm:p-5">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eef5ff] text-[#1677ff]"><BookOpen size={18} /></span><div><h3 className="text-sm font-bold text-[#102033]">Manual rápido de conexión</h3><p className="mt-1 text-xs text-[#617184]">Completa estos pasos en orden. La contraseña solo aparece al generar o rotar la credencial.</p></div></div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3"><GuideStep number="1" title="Genera la credencial">Guarda usuario y contraseña cuando aparezcan. No es posible recuperar la contraseña después.</GuideStep><GuideStep number="2" title="Conecta el cliente">Usa el host, puerto, Client ID y QoS 1. Mantén un Client ID único por dispositivo.</GuideStep><GuideStep number="3" title="Publica y confirma">Publica <code>online</code>, envía telemetría y responde cada comando con su ACK.</GuideStep></ol>
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#dce3ea] bg-white shadow-[0_1px_3px_rgba(16,32,51,.04)]">
      <div className="border-b border-[#edf1f5] px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold text-[#102033]">Topics autorizados</h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-[#617184]">La seguridad dinámica de Mosquitto restringe esta credencial al dispositivo. Cada ruta puede copiarse completa y se adapta al ancho disponible sin generar desplazamiento horizontal.</p>
      </div>
      <div className="divide-y divide-[#edf1f5]">
        {topics.map((item) => <div className="grid gap-2 px-4 py-3 sm:grid-cols-[82px_minmax(0,1fr)_160px] sm:items-center sm:px-5" key={item.topic}>
          <span className={`w-fit rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${item.direction === 'Publicar' ? 'bg-[#e8f7ef] text-[#137a49]' : 'bg-[#eaf3ff] text-[#1268d6]'}`}>{item.direction}</span>
          <div className="flex min-w-0 items-start gap-2 rounded-lg bg-[#f7f9fc] px-3 py-2">
            <code className="min-w-0 flex-1 whitespace-normal text-[11px] leading-5 text-[#34465a] [overflow-wrap:anywhere]">{item.topic}</code>
            <CopyButton label={`Topic ${item.direction.toLowerCase()}`} value={item.topic} />
          </div>
          <span className="text-[11px] leading-5 text-[#617184] sm:text-right">{item.purpose}</span>
        </div>)}
      </div>
    </section>

    <section className="rounded-2xl border border-[#dce3ea] bg-white p-4 shadow-[0_1px_3px_rgba(16,32,51,.04)] sm:p-5">
      <h3 className="text-sm font-semibold text-[#102033]">Prueba desde la terminal</h3>
      <p className="mt-1 text-[11px] leading-5 text-[#617184]">Instala los clientes de Mosquitto y reemplaza <code>&lt;CONTRASEÑA&gt;</code> por el secreto recién generado.</p>
      <div className="grid gap-x-4 lg:grid-cols-2"><CodeSample label="Escuchar comandos" value={subscribeExample} /><CodeSample label="Publicar telemetría" value={publishExample} /></div>
    </section>

    <section className="rounded-2xl border border-[#dce3ea] bg-white p-4 shadow-[0_1px_3px_rgba(16,32,51,.04)] sm:p-5"><h3 className="text-sm font-semibold text-[#102033]">Ejemplo para {serialBridge ? 'Arduino por Serial JSON' : 'ESP32 / Arduino con WiFi'}</h3><p className="mt-1 text-[11px] leading-5 text-[#617184]">{serialBridge ? 'El puente lee JSON por USB y lo publica con la credencial MQTT del dispositivo.' : 'Ejemplo base usando un cliente MQTT compatible con PubSubClient.'}</p><CodeSample label={serialBridge ? 'Puente USB' : 'Configuración MQTT'} value={serialBridge ? bridgeExample : esp32Example} /><div className="mt-3 flex gap-2 rounded-xl bg-[#f4f8fd] p-3 text-[11px] leading-5 text-[#4a5d70]"><CheckCircle2 className="mt-0.5 shrink-0 text-[#1677ff]" size={15} /><p>Payload de telemetría: <code>{'{"value":24.6,"timestamp":"2026-11-18T12:00:00Z"}'}</code>. ACK: <code>{'{"command_id":"UUID","status":"confirmed","value":true}'}</code>.</p></div></section>
  </div>
}

function ConnectionValue({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: string }) {
  return <div className="min-w-0 bg-white/80 px-4 py-3"><div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#718198]"><Icon size={12} />{label}</div><div className="mt-1.5 flex items-center gap-2"><code className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#102033]" title={value}>{value}</code><CopyButton label={label} value={value} /></div></div>
}

function GuideStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <li className="rounded-xl border border-[#e5ebf1] bg-[#f8fafc] p-3"><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#1677ff] text-[10px] font-bold text-white">{number}</span><h4 className="text-xs font-semibold text-[#102033]">{title}</h4></div><p className="mt-2 text-[11px] leading-5 text-[#617184]">{children}</p></li>
}

function CodeSample({ label, value }: { label: string; value: string }) {
  return <div className="mt-3"><div className="mb-1.5 flex items-center justify-between"><p className="text-[10px] font-semibold text-[#4a5d70]">{label}</p><CopyButton label={label} value={value} /></div><pre className="max-h-36 overflow-auto rounded-xl bg-[#0b1724] p-3 text-[10px] leading-5 text-[#c9d8e6]"><code>{value}</code></pre></div>
}

function CopyButton({ label, value }: { label: string; value: string }) {
  return <button aria-label={`Copiar ${label}`} className="grid size-7 shrink-0 place-items-center rounded-md text-[#1677ff] hover:bg-[#eaf3ff]" onClick={() => navigator.clipboard.writeText(value)} title={`Copiar ${label}`} type="button"><Copy size={13} /></button>
}
