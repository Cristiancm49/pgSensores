# Catálogo visual de hardware UDLAIoT

Esta carpeta contiene las imágenes originales organizadas para su posterior optimización e integración en la interfaz.

## Estructura

- `placas/`: microcontroladores y computadores de placa única.
- `sensores/`: sensores, sondas y módulos de medición.
- `actuadores/`: elementos controlables por una salida del dispositivo.
- `gateways/`: routers y gateways industriales.
- `referencias/`: composiciones que no deben usarse como imagen individual.
- `catalogo.json`: relación entre claves lógicas y archivos recomendados.

## Convenciones

- Los nombres usan minúsculas y `kebab-case` para evitar problemas en rutas web.
- No se eliminó ninguna variante original.
- La propiedad `principal` del catálogo identifica la imagen recomendada para tarjetas y selectores.
- Las imágenes siguen en PNG original. Antes de publicarlas deben generarse versiones WebP o AVIF optimizadas; no se deben cargar directamente los archivos de 1–3 MB en listados extensos.

## Recursos prioritarios para la demo de invernadero

| Recurso | Clave de catálogo |
| --- | --- |
| ESP32 DevKit | `esp32_devkit` |
| DHT22 | `dht22` |
| BH1750 | `bh1750` |
| BMP280 | `bmp280` |
| Humedad de suelo capacitiva | `soil_moisture_capacitive` |
| LED | `led` |
| Relé de un canal | `relay_1ch` |

Todavía faltan imágenes de bomba de agua, servomotor SG90 y ventilador para completar visualmente los tres actuadores del invernadero.
