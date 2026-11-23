type HardwareCategory = 'sensor' | 'actuador'

const boardAssets = {
  esp32_cam: '/hardware/boards/esp32_cam.png',
  esp32_s3: '/hardware/boards/esp32_s3.png',
  esp32_devkit: '/hardware/boards/esp32_devkit.png',
  esp8266_nodemcu: '/hardware/boards/esp8266_nodemcu.png',
  arduino_uno: '/hardware/boards/arduino_uno.png',
  arduino_mega: '/hardware/boards/arduino_mega.png',
  arduino_nano_33_iot: '/hardware/boards/arduino_nano_33_iot.png',
  arduino_nano: '/hardware/boards/arduino_nano.png',
  raspberry_pi_pico_w: '/hardware/boards/raspberry_pi_pico_w.png',
  raspberry_pi_5: '/hardware/boards/raspberry_pi_5.png',
  stm32_blue_pill: '/hardware/boards/stm32_blue_pill.png',
} as const

const channelAssets = {
  dht22: '/hardware/sensors/dht22.png',
  bh1750: '/hardware/sensors/bh1750.png',
  bmp280: '/hardware/sensors/bmp280.png',
  bme280: '/hardware/sensors/bme280.png',
  bmp180: '/hardware/sensors/bmp180.png',
  soil_moisture_capacitive: '/hardware/sensors/soil_moisture_capacitive.png',
  soil_moisture_resistive: '/hardware/sensors/soil_moisture_resistive.png',
  ds18b20: '/hardware/sensors/ds18b20.png',
  hc_sr04: '/hardware/sensors/hc_sr04.png',
  pir_hc_sr501: '/hardware/sensors/pir_hc_sr501.png',
  mq2: '/hardware/sensors/mq2.png',
  mq135: '/hardware/sensors/mq135.png',
  ldr: '/hardware/sensors/ldr.png',
  rain: '/hardware/sensors/rain.png',
  water_level: '/hardware/sensors/water_level.png',
  water_flow_yf_s201: '/hardware/sensors/water_flow_yf_s201.png',
  ph: '/hardware/sensors/ph.png',
  ec_tds: '/hardware/sensors/ec_tds.png',
  acs712: '/hardware/sensors/acs712.png',
  voltage: '/hardware/sensors/voltage.png',
  load_cell_hx711: '/hardware/sensors/load_cell_hx711.png',
  gps_neo_6m: '/hardware/sensors/gps_neo_6m.png',
  rfid_rc522: '/hardware/sensors/rfid_rc522.png',
  led: '/hardware/actuators/led.png',
  relay_1ch: '/hardware/actuators/relay_1ch.png',
} as const

function normalized(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function boardAssetFor(boardType?: string | null, label?: string) {
  const text = normalized(boardType, label)
  if (text.includes('esp32-cam')) return boardAssets.esp32_cam
  if (text.includes('esp32-s3')) return boardAssets.esp32_s3
  if (text.includes('esp8266') || text.includes('nodemcu')) return boardAssets.esp8266_nodemcu
  if (text.includes('arduino mega')) return boardAssets.arduino_mega
  if (text.includes('nano 33')) return boardAssets.arduino_nano_33_iot
  if (text.includes('arduino nano')) return boardAssets.arduino_nano
  if (text.includes('arduino')) return boardAssets.arduino_uno
  if (text.includes('pico w')) return boardAssets.raspberry_pi_pico_w
  if (text.includes('raspberry pi 5')) return boardAssets.raspberry_pi_5
  if (text.includes('stm32')) return boardAssets.stm32_blue_pill
  if (text.includes('esp32')) return boardAssets.esp32_devkit
  return null
}

export function channelAssetFor(key: string, label: string, category: HardwareCategory) {
  const text = normalized(key, label)
  if (category === 'actuador') {
    if (text.includes('led') || text.includes('luz')) return channelAssets.led
    if (text.includes('rele') || text.includes('relay') || text.includes('bomba')) return channelAssets.relay_1ch
    return null
  }
  if (text.includes('hc-sr04') || text.includes('hc_sr04') || text.includes('ultrason') || text.includes('distancia')) return channelAssets.hc_sr04
  if (text.includes('pir') || text.includes('movimiento') || text.includes('presencia')) return channelAssets.pir_hc_sr501
  if (text.includes('dht22') || text.includes('temperatura ambiental') || text.includes('humedad aire') || text.includes('humedad_aire')) return channelAssets.dht22
  if (text.includes('ds18b20')) return channelAssets.ds18b20
  if (text.includes('humedad suelo') || text.includes('humedad_suelo') || text.includes('soil')) return channelAssets.soil_moisture_capacitive
  if (text.includes('bh1750') || text.includes('iluminacion')) return channelAssets.bh1750
  if (text.includes('ldr') || text.includes('luminosidad')) return channelAssets.ldr
  if (text.includes('bme280')) return channelAssets.bme280
  if (text.includes('bmp180')) return channelAssets.bmp180
  if (text.includes('bmp280') || text.includes('presion')) return channelAssets.bmp280
  if (text.includes('mq-135') || text.includes('mq135') || text.includes('calidad aire')) return channelAssets.mq135
  if (text.includes('mq-2') || text.includes('mq2') || text.includes('gas')) return channelAssets.mq2
  if (text.includes('lluvia')) return channelAssets.rain
  if (text.includes('nivel') && text.includes('agua')) return channelAssets.water_level
  if (text.includes('flujo')) return channelAssets.water_flow_yf_s201
  if (text.includes('conductividad') || text.includes('ec_tds') || text.includes('tds')) return channelAssets.ec_tds
  if (text.includes('ph')) return channelAssets.ph
  if (text.includes('acs712') || text.includes('corriente')) return channelAssets.acs712
  if (text.includes('voltaje')) return channelAssets.voltage
  if (text.includes('hx711') || text.includes('peso') || text.includes('carga')) return channelAssets.load_cell_hx711
  if (text.includes('gps')) return channelAssets.gps_neo_6m
  if (text.includes('rfid') || text.includes('rc522')) return channelAssets.rfid_rc522
  if (text.includes('luz') || text.includes('lux')) return channelAssets.bh1750
  if (text.includes('temper')) return channelAssets.dht22
  return null
}
