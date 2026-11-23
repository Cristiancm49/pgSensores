import type { Device } from '../../types/entities'

type DeviceConnection = Pick<Device, 'board_type' | 'configuration' | 'connection_type'>

export function usesSerialBridge(device: DeviceConnection) {
  return device.configuration.serial_json === true || (device.board_type.toLowerCase().includes('arduino') && device.configuration.mqtt_bridge === true)
}

export function deviceConnectionLabel(device: DeviceConnection) {
  if (usesSerialBridge(device)) return 'Serial JSON → Mosquitto'
  return device.connection_type === 'simulador' ? 'Simulador → Mosquitto' : 'MQTT directo → Mosquitto'
}
