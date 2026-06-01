// locales/es.js — Spanish message catalog for fflint validators
import enCatalog from './en.js'
import {
  LEVEL_LIMITS, CHANNEL_LAYOUT_CHANNELS, AUDIO_BITRATE_FLOOR,
  parseBitrate, parseFps,
} from '../codec-data.js'
import { getScaleSize } from '../vf-parse.js'

export default {
  ...enCatalog,

  l1_nvdec_deint_invalid: {
    message: ({ valid, val }) => `El modo de desentrelazado NVDEC debe ser uno de: ${valid} (recibido "${val}")`,
    hint: '0 = weave (sin desentrelazado). 1 = bob (desentrelazado a frecuencia de campo). 2 = adaptive. Solo funciona con decodificadores NVDEC cuvid (-hwaccel cuda)',
  },

  l1_keyint_min_invalid: {
    message: ({ max }) => `El intervalo mínimo entre keyframes debe ser un entero positivo (1–${max})`,
    hint: 'Lo habitual es GOP/2. Con 25 fps y un GOP de 2 s: keyintMin=25. Recomendación práctica: igualarlo a los fps para garantizar al menos 1 keyframe por segundo',
  },
  l1_keyint_min_high: {
    message: ({ value }) => `keyint_min ${value} parece demasiado alto: la mayoría de los flujos necesitan un keyframe cada pocos segundos`,
    hint: 'Lo habitual es GOP/2. Con 25 fps y un GOP de 2 s: keyintMin=25. Recomendación práctica: igualarlo a los fps para garantizar al menos 1 keyframe por segundo',
  },

  l1_sc_threshold_looks_like_flag: {
    message: ({ value }) => `El valor de sc_threshold es "${value}" y parece otra bandera: falta el parámetro numérico. Indique un número, por ejemplo 0`,
    hint: '0 = desactiva la detección de cambio de escena. En live/IPTV suele ser lo recomendable para mantener un GOP fijo. Valor por defecto de FFmpeg: 40',
  },
  l1_sc_threshold_invalid: {
    message: 'El umbral de cambio de escena debe ser un entero no negativo (0 = desactivar)',
    hint: '0 = desactiva la detección de cambio de escena. En live/IPTV suele ser lo recomendable para mantener un GOP fijo. Valor por defecto de FFmpeg: 40',
  },
  l1_sc_threshold_very_high: {
    message: ({ value }) => `El umbral de cambio de escena ${value} es demasiado alto: en la práctica equivale a desactivar la detección. Si quiere desactivarla, use 0 explícitamente`,
    hint: '0 = desactiva la detección de cambio de escena. En live/IPTV suele ser lo recomendable para mantener un GOP fijo. Valor por defecto de FFmpeg: 40',
  },
  l1_sc_threshold_high: {
    message: ({ value }) => `El umbral de cambio de escena ${value} está fuera del rango práctico (0–100, por defecto 40): valores por encima de 100 apenas generan I-frames y empeoran la recuperación ante errores`,
    hint: '0 = desactiva la detección de cambio de escena. En live/IPTV suele ser lo recomendable para mantener un GOP fijo. Valor por defecto de FFmpeg: 40',
  },

  l1_bframes_looks_like_flag: {
    message: ({ value }) => `El valor de B-frames es "${value}" y parece otra bandera: falta el parámetro numérico. Indique un número, por ejemplo 2`,
    hint: '0 para live/low-latency. 2–3 para VOD con H.264. HEVC admite hasta 8. Recomendación práctica: 0 para live y 2 para VOD',
  },
  l1_bframes_invalid: {
    message: 'El número de B-frames debe ser un entero entre 0 y 16',
    hint: '0 para live/low-latency. 2–3 para VOD con H.264. HEVC admite hasta 8. Recomendación práctica: 0 para live y 2 para VOD',
  },
  l1_bframes_high: {
    message: ({ value }) => `El número de B-frames ${value} supera el rango habitual (0–3): aumentará la latencia de codificación y el uso de memoria, con una mejora de compresión limitada`,
    hint: '0 para live/low-latency. 2–3 para VOD con H.264. HEVC admite hasta 8. Recomendación práctica: 0 para live y 2 para VOD',
  },

  l1_refs_looks_like_flag: {
    message: ({ value }) => `El valor de reference frames es "${value}" y parece otra bandera: falta el parámetro numérico. Indique un número, por ejemplo 3`,
    hint: '1 = descodificación más rápida y menor latencia. 3–5 = equilibrio típico entre calidad y velocidad. Valores más altos mejoran la compresión, pero aumentan la memoria del decodificador. Recomendado: 3',
  },
  l1_refs_invalid: {
    message: 'El número de reference frames debe ser un entero entre 1 y 16',
    hint: '1 = descodificación más rápida y menor latencia. 3–5 = equilibrio típico entre calidad y velocidad. Valores más altos mejoran la compresión, pero aumentan la memoria del decodificador. Recomendado: 3',
  },
  l1_refs_high: {
    message: ({ value }) => `El número de reference frames ${value} supera el rango típico (1–4): la mejora de calidad suele ser mínima y el coste en memoria y CPU aumenta`,
    hint: '1 = descodificación más rápida y menor latencia. 3–5 = equilibrio típico entre calidad y velocidad. Valores más altos mejoran la compresión, pero aumentan la memoria del decodificador. Recomendado: 3',
  },

  l1_service_id_invalid: {
    message: 'El Service ID de MPEG-TS debe ser un entero entre 1 y 65535',
    hint: 'Debe ser único dentro del múltiplex. Valor típico: 1. Rango 1–65535 (16 bits). Corresponde al SID en las tablas SDT/PAT',
  },

  l1_hls_time_invalid: {
    message: 'La duración del segmento HLS debe ser un entero entre 1 y 3600 segundos',
    hint: '2–4 s para LL-HLS. 6 s es el valor más común. 10 s para VOD estable. Recomendación práctica: 6',
  },
  l1_hls_time_high: {
    message: ({ value }) => `La duración del segmento HLS ${value}s es demasiado alta: aumentarán la latencia de arranque y la latencia de búsqueda`,
    hint: '2–4 s para LL-HLS. 6 s es el valor más común. 10 s para VOD estable. Recomendación práctica: 6',
  },

  l1_hls_list_size_invalid: {
    message: ({ max }) => `El tamaño de la playlist HLS debe ser un entero entre 0 y ${max} (0 = sin límite)`,
    hint: '0 = conservar todos los segmentos para VOD. 3–5 = ventana deslizante para live. Recomendación práctica para live: 5 (unos 30 s con segmentos de 6 s)',
  },
  l1_hls_list_size_high: {
    message: ({ value }) => `Una playlist HLS de ${value} segmentos parece demasiado grande: para VOD suele usarse 0 y para live 3–10`,
    hint: '0 = conservar todos los segmentos para VOD. 3–5 = ventana deslizante para live. Recomendación práctica para live: 5 (unos 30 s con segmentos de 6 s)',
  },

  l1_max_delay_invalid: {
    message: ({ max }) => `El retardo máximo de entrada debe ser un entero entre 0 y ${max} microsegundos`,
    hint: 'Valor por defecto de FFmpeg: 700 000 µs (0.7 s). Para live suelen usarse 200 000–500 000 µs. 0 = sin buffering, con posible pérdida de paquetes. Recomendación práctica para live: 500 000',
  },
  l1_max_delay_high: {
    message: ({ seconds }) => `El retardo máximo ${seconds}s es demasiado alto: puede provocar un buffering excesivo`,
    hint: 'Valor por defecto de FFmpeg: 700 000 µs (0.7 s). Para live suelen usarse 200 000–500 000 µs. 0 = sin buffering, con posible pérdida de paquetes. Recomendación práctica para live: 500 000',
  },

  l1_thread_queue_size_invalid: {
    message: ({ max }) => `El valor de thread_queue_size debe ser un entero positivo (1–${max})`,
    hint: 'El valor por defecto de FFmpeg es 8. Para live suele ser demasiado bajo y puede provocar errores DTS. Rango típico: 512–1024. Para fuentes inestables: 4096. Recomendación práctica: 1024',
  },
  l1_thread_queue_size_high: {
    message: ({ value }) => `El valor de thread_queue_size ${value} parece excesivo: puede desperdiciar memoria`,
    hint: 'El valor por defecto de FFmpeg es 8. Para live suele ser demasiado bajo y puede provocar errores DTS. Rango típico: 512–1024. Para fuentes inestables: 4096. Recomendación práctica: 1024',
  },

  l1_max_muxing_queue_invalid: {
    message: ({ max }) => `El tamaño máximo de la cola del muxer debe ser un entero positivo (1–${max})`,
    hint: 'El valor por defecto de FFmpeg es 128. Si aparece el error "Too many packets buffered for output stream", súbalo a 1024–4096. Recomendación práctica: 1024',
  },
  l1_max_muxing_queue_high: {
    message: ({ value }) => `El valor de max_muxing_queue_size ${value} es demasiado alto: puede gastar memoria sin necesidad. En la mayoría de casos basta con 1024–4096`,
    hint: 'El valor por defecto de FFmpeg es 128. Si aparece el error "Too many packets buffered for output stream", súbalo a 1024–4096. Recomendación práctica: 1024',
  },

  l1_audio_bitrate_invalid: {
    message: 'El bitrate de audio debe ser un número con sufijo opcional, por ejemplo 128k o 192k',
    hint: 'AAC: 128k para stereo, 192k para mayor calidad y 320k para archivo. AC3: 192k para stereo y 384k para 5.1. Recomendación práctica para stereo broadcast: 192k',
  },

  l1_loudnorm_tp_invalid: {
    message: 'El parámetro loudnorm tp debe ser un número entre -9 y 0 dBTP',
    hint: 'Recomendación EBU R128: -1 dBTP. Para más margen: -2 dBTP. Recomendación práctica: -1',
  },
  l1_loudnorm_lra_invalid: {
    message: 'El parámetro loudnorm LRA debe ser un número entre 1 y 20 LU',
    hint: 'Máximo según EBU R128: 18 LU. Valor típico para broadcast: 7–10 LU. Recomendación práctica: 7',
  },

  l1_profile_ignored: {
    message: ({ codec }) => `El códec ${codec} no usa -profile:v: este ajuste se ignorará`,
    hint: 'Quite el profile o cambie a un códec que sí lo admita, como H.264 o H.265',
  },
  l1_profile_invalid: {
    message: ({ profile, codec, valid }) => `El profile "${profile}" no es válido para ${codec}. Valores válidos: ${valid}`,
    hint: ({ common }) => `Opciones habituales: ${common}`,
  },

  l1_preset_ignored: {
    message: ({ codec }) => `El códec ${codec} no usa -preset: este ajuste se ignorará`,
    hint: 'Quite el preset o cambie a un códec que sí lo admita',
  },
  l1_preset_invalid: {
    message: ({ preset, codec, family, valid }) => `El preset "${preset}" no es válido para ${codec} (familia ${family}). Valores válidos: ${valid}`,
    hint: ({ recommended }) => `Opción práctica para equilibrar velocidad y calidad: "${recommended}"`,
  },

  l1_level_invalid_h264: {
    message: ({ level, valid }) => `El level "${level}" no es válido para H.264. Valores válidos: ${valid}`,
    hint: 'Valores frecuentes: 4.1 para 1080p60/Blu-ray y 5.1 para 4K60',
  },
  l1_level_high_h264: {
    message: ({ level }) => `El level ${level} está pensado para alta resolución o alta frecuencia de imagen: es posible que equipos antiguos o STB no lo reproduzcan`,
    hint: 'Para una compatibilidad amplia con dispositivos HD suele usarse 4.0–4.2',
  },
  l1_level_invalid_h265: {
    message: ({ level, valid }) => `El level "${level}" no es válido para H.265. Valores válidos: ${valid}`,
    hint: 'Valores frecuentes: 4.1 para 1080p y 5.1 para 4K',
  },
  l1_level_high_h265: {
    message: ({ level }) => `El level ${level} está pensado para contenido 8K: todavía muy pocos dispositivos lo soportan`,
    hint: 'Para una compatibilidad amplia con 4K suele usarse 5.0–5.1',
  },
  l1_level_ignored: {
    message: ({ codec }) => `El códec ${codec} no usa -level: este ajuste se ignorará`,
    hint: 'Quite el level o utilice H.264/H.265',
  },

  l1_channel_layout_invalid: {
    message: ({ layout, valid }) => `El channel layout "${layout}" no se reconoce. Valores válidos: ${valid}`,
    hint: 'Opciones frecuentes: stereo (2 canales), 5.1 (6 canales), 7.1 (8 canales)',
  },

  l1_aspect_invalid: {
    message: ({ value }) => `El aspect ratio debe estar en formato W:H, por ejemplo 16:9 o 4:3 (recibido "${value}")`,
    hint: 'Opciones frecuentes: 16:9, 4:3, 21:9',
  },

  l1_pix_fmt_deprecated: {
    message: ({ value }) => `"${value}" es un pixel format JPEG-range obsoleto. Use el equivalente moderno, por ejemplo yuv420p junto con -color_range pc`,
    hint: 'yuv420p = máxima compatibilidad. yuv422p = broadcast y edición. 10-bit = contenido HDR',
  },
  l1_pix_fmt_invalid: {
    message: ({ valid, val }) => `El pixel format debe ser uno de: ${valid} (recibido "${val}")`,
    hint: 'yuv420p = máxima compatibilidad. yuv422p = broadcast y edición. 10-bit = contenido HDR',
  },

  l1_bsf_video_invalid: {
    message: ({ valid, val }) => `El video bitstream filter debe ser uno de: ${valid} (recibido "${val}")`,
    hint: 'h264_mp4toannexb: H.264 en MPEG-TS. hevc_mp4toannexb: HEVC en MPEG-TS. Aplique solo filtros relevantes para el códec',
  },

  l1_field_order_invalid: {
    message: ({ valid, val }) => `El field order debe ser uno de: ${valid} (recibido "${val}")`,
    hint: 'tt = top-field-first (lo más común). bb = bottom-field-first (PAL DV). progressive = sin entrelazado',
  },

  l1_framesize_non_positive: {
    message: ({ value }) => `El tamaño de cuadro "${value}" incluye una dimensión nula o negativa: ancho y alto deben ser enteros positivos. Los atajos -1/-2 solo funcionan dentro de filtros y no sirven para -s`,
    hint: 'Tamaños frecuentes: 1920x1080, 1280x720, 3840x2160, 720x576, 720x480',
  },
  l1_framesize_invalid: {
    message: 'El tamaño de cuadro debe estar en formato WxH, por ejemplo 1920x1080 (separador x o -)',
    hint: 'Tamaños frecuentes: 1920x1080, 1280x720, 3840x2160, 720x576, 720x480',
  },

  l1_fps_invalid: {
    message: ({ value }) => `El FPS personalizado "${value}" no es válido: use notación decimal (29.97) o fraccionaria (30000/1001)`,
    hint: 'Valores frecuentes: 23.976, 25, 29.97 o 30000/1001, 30, 50, 59.94, 60. La notación fraccionaria está soportada',
  },
  l1_fps_high: {
    message: ({ value, approx }) => `El FPS ${value} (≈${approx}) parece demasiado alto: la mayoría de pantallas y codificadores trabajan como máximo a 60`,
    hint: 'Valores frecuentes: 23.976, 25, 29.97 o 30000/1001, 30, 50, 59.94, 60. La notación fraccionaria está soportada',
  },

  l1_vf_scale_wrong_separator: {
    message: ({ name, value }) => `El valor ${name} "${value}" usa un separador incorrecto: el filtro scale requiere W:H y no WxH`,
    hint: 'Dentro de scale use ":", por ejemplo scale=1920:1080 o scale=w=1920:h=1080. El separador x solo es válido para -s',
  },
  l1_vf_scale_comma_separator: {
    message: ({ name, w, h }) => `${name}=${w},${h} usa coma entre ancho y alto. La coma separa filtros en la cadena; aquí debe usar dos puntos: ${name}=${w}:${h}`,
    hint: 'Dentro de un filtro, ancho y alto se separan con ":". La coma se usa entre filtros. Correcto: scale=W:H, no scale=W,H',
  },
  l1_vf_scale_missing_dim: {
    message: ({ name }) => `${name} necesita ancho y alto: use ${name}=W:H o ${name}=w=W:h=H`,
    hint: 'Dentro de scale use ":", por ejemplo scale=1920:1080 o scale=w=1920:h=1080. El separador x solo es válido para -s',
  },

  l1_gop_invalid: {
    message: ({ max }) => `El GOP debe ser un entero positivo (1–${max})`,
    hint: 'Fórmula: fps × intervalo entre keyframes en segundos. Ejemplo: 25 fps × 4 s = 100. Rango típico para live: 50–250. En la práctica conviene alinearlo con la duración del segmento',
  },
  l1_gop_high: {
    message: ({ value }) => `El GOP ${value} es demasiado grande: aumentarán la latencia de búsqueda y el tiempo de recuperación ante errores`,
    hint: 'Fórmula: fps × intervalo entre keyframes en segundos. Ejemplo: 25 fps × 4 s = 100. Rango típico para live: 50–250. En la práctica conviene alinearlo con la duración del segmento',
  },

  l1_crf_invalid: {
    message: 'El valor CRF debe ser un número válido',
    hint: 'Cuanto menor sea el CRF, mayor será la calidad y también el tamaño del archivo. Rangos típicos: H.264 = 18–28, HEVC = 22–32, AV1 = 20–40. Valores prácticos frecuentes: 23 para H.264, 28 para HEVC y 30 para AV1',
  },
  l1_crf_range: {
    message: ({ min, max, codec }) => `Para ${codec}, el valor CRF debe estar entre ${min} y ${max}`,
    hint: 'Cuanto menor sea el CRF, mayor será la calidad y también el tamaño del archivo. Rangos típicos: H.264 = 18–28, HEVC = 22–32, AV1 = 20–40. Valores prácticos frecuentes: 23 para H.264, 28 para HEVC y 30 para AV1',
  },

  l1_bitrate_invalid: {
    message: 'El bitrate debe ser un número con sufijo opcional, por ejemplo 4M o 500k',
    hint: 'Valores típicos: 500k para SD, 2M para 720p, 4–8M para 1080p y 15–25M para 4K. Use sufijos k o M',
  },
  l1_maxrate_invalid: {
    message: 'El valor de maxrate debe ser un número con sufijo opcional',
    hint: 'Lo habitual es fijar maxrate un 10–20% por encima del bitrate objetivo y usarlo junto con -bufsize. Ejemplo: target=4M -> maxrate=5M',
  },
  l1_bufsize_invalid: {
    message: 'El valor de bufsize debe ser un número con sufijo opcional',
    hint: 'En broadcast VBR suele usarse 2× maxrate y en streaming 1× maxrate. Ejemplo: maxrate=5M -> bufsize=10M',
  },

  l1_pid_invalid: {
    message: ({ value }) => `El PID debe estar entre 32 y 8186 (recibido ${value})`,
    hint: 'Asignación habitual: PMT = 256, vídeo = 257, audio = 258. Evite 0–31 (reservados) y 8191 (null packet)',
  },

  l1_pcr_invalid: {
    message: 'El periodo PCR debe ser un entero entre 1 y 100 ms (máximo según DVB)',
    hint: 'El límite superior en DVB es 100 ms. Valor por defecto de FFmpeg: 20 ms. Recomendación práctica: 40 ms para broadcast y 20 ms para IPTV',
  },

  l1_dialnorm_invalid: {
    message: 'El valor de dialnorm debe ser un entero entre -31 y -1 dBFS',
    hint: 'Estándar Dolby: -27 para cine y -24 para TV. EBU R128 (-23 LUFS) se aproxima a -23. Valor práctico para broadcast: -27',
  },

  l1_loudnorm_target_invalid: {
    message: 'El objetivo de loudness debe estar entre -70 y 0 LUFS',
    hint: 'EBU R128: -23 LUFS. Netflix: -27 LUFS. YouTube suele normalizar hacia -14 LUFS. Podcast: alrededor de -16 LUFS. Valor práctico para broadcast: -23',
  },

  l1_timeout_invalid: {
    message: ({ max }) => `Timeout debe ser un entero positivo en microsegundos (1–${max})`,
    hint: 'Para SRT/RTSP en redes estables suele usarse 5 000 000 µs (5 s). Para enlaces inestables o satelitales, 10 000 000 µs (10 s). Valor práctico: 5 000 000',
  },
  l1_timeout_high: {
    message: ({ seconds }) => `Timeout ${seconds}s es demasiado alto: la detección de una fuente caída se retrasará`,
    hint: 'Para SRT/RTSP en redes estables suele usarse 5 000 000 µs (5 s). Para enlaces inestables o satelitales, 10 000 000 µs (10 s). Valor práctico: 5 000 000',
  },

  l1_analyze_duration_invalid: {
    message: ({ value }) => `analyzeduration debe ser un entero positivo en microsegundos, con un máximo de 120 000 000 (2 min) (recibido ${value})`,
    hint: 'La unidad es microsegundos. Valores habituales: 5 000 000 (5 s) o 10 000 000 (10 s). Cuanto más alto sea, más se retrasa el arranque del flujo, pero mejora la detección de formato y códec. Valor por defecto de FFmpeg: 5 000 000',
  },
  l1_analyze_duration_high: {
    message: ({ seconds }) => `analyzeduration ${seconds} s es demasiado alto: el flujo tardará bastante en empezar`,
    hint: 'La unidad es microsegundos. Valores habituales: 5 000 000 (5 s) o 10 000 000 (10 s). Cuanto más alto sea, más se retrasa el arranque del flujo, pero mejora la detección de formato y códec. Valor por defecto de FFmpeg: 5 000 000',
  },

  l1_probe_size_invalid: {
    message: ({ value }) => `probesize debe ser un entero positivo en bytes, con un máximo de 1 000 000 000 (1 GB) (recibido ${value})`,
    hint: 'La unidad es bytes. Valores habituales: 5 000 000 (5 MB) o 10 000 000 (10 MB). Valores altos mejoran la detección de formato y códec, pero aumentan el uso de memoria. Valor por defecto de FFmpeg: 5 000 000. Para flujos complejos suele subirse junto con -analyzeduration',
  },
  l1_probe_size_high: {
    message: ({ mb }) => `probesize ${mb} MB es demasiado alto: aumentarán el consumo de memoria y la latencia de arranque`,
    hint: 'La unidad es bytes. Valores habituales: 5 000 000 (5 MB) o 10 000 000 (10 MB). Valores altos mejoran la detección de formato y códec, pero aumentan el uso de memoria. Valor por defecto de FFmpeg: 5 000 000. Para flujos complejos suele subirse junto con -analyzeduration',
  },

  l1_gpu_index_invalid: {
    message: ({ value }) => `El índice GPU debe ser un entero entre -1 (auto) y 15 (recibido ${value})`,
    hint: '-1 = FFmpeg elige automáticamente una GPU disponible. 0 = primera GPU, 1 = segunda, etc. Solo afecta a NVENC/NVDEC. Normalmente basta con -1',
  },

  l1_listen_invalid: {
    message: ({ value }) => `El modo listen debe ser 0 (client) o 1 (server) (recibido ${value})`,
    hint: '0 = modo cliente por defecto, se conecta a una URL. 1 = modo servidor, espera conexiones entrantes. listen=1 suele usarse en la URL de salida para receptores push TCP/MPEG-TS. La URL debe ser tcp:// o host:port',
  },

  l1_stream_loop_invalid: {
    message: ({ value }) => `stream_loop debe ser -1 (infinito), 0 (sin bucle) o un entero positivo (recibido ${value})`,
    hint: '-1 = repetir indefinidamente, 0 = reproducir una vez, N > 0 = repetir N veces adicionales. Para playout de broadcast úselo siempre junto con -re. Recomendación práctica: -stream_loop -1 -re',
  },

  channels_layout_mismatch: {
    message: ({ s }) => `El número de canales ${s.channels} y el channel layout "${s.channelLayout}" son incoherentes: el layout espera ${CHANNEL_LAYOUT_CHANNELS[s.channelLayout]} canales. FFmpeg puede fallar o producir silencio`,
  },
  h264_level_exceeded: {
    message: ({ s }) => {
      const sizeStr = s.frameSize === 'custom' ? s.customFrameSize : s.frameSize
      const fpsStr = s.fps === 'custom' ? s.customFps : s.fps
      const limits = LEVEL_LIMITS[s.level]
      return `La resolución ${sizeStr} a ${fpsStr ?? '?'} fps supera los límites de H.264 Level ${s.level} (${limits.w}×${limits.h} a un máximo de ${limits.fps} fps). El codificador puede fallar o generar una salida no conforme`
    },
  },
  cbr_bufsize_ratio: {
    message: ({ s }) => {
      const buf = parseBitrate(s.bufsize)
      const br  = parseBitrate(s.targetBitrate)
      const ratio = (buf / br).toFixed(1)
      return `La relación bufsize/bitrate en modo CBR es ${ratio}×. Para broadcast suele recomendarse 1.5×–3×. Si es demasiado baja, aumentará el riesgo de undershoot; si es demasiado alta, se relajan las restricciones HRD`
    },
  },
  hls_gop_segment_mismatch: {
    message: ({ s }) => {
      const fps = parseFps(s.fps === 'custom' ? s.customFps : s.fps)
      const gopSec = (s.gop / fps).toFixed(2)
      return `La duración del segmento HLS (${s.hlsTime}s) no es múltiplo de la duración del GOP (${gopSec}s): los segmentos no empezarán en keyframes y los reproductores ABR pueden reproducirlos con errores`
    },
  },
  audio_bitrate_too_low: {
    message: ({ s }) => {
      const ch = s.channels && s.channels !== 'original' ? s.channels : '2'
      const floor = AUDIO_BITRATE_FLOOR[`${s.audioCodec}_${ch}`]
      return `El bitrate de audio ${s.audioBitrate} parece demasiado bajo para ${s.audioCodec} con ${ch} canales. El mínimo recomendado es ${floor >= 1000 ? (floor / 1000) + 'k' : floor}`
    },
  },
  s_and_vf_scale_diff: {
    message: ({ s }) => {
      const raw = s.frameSize === 'custom' ? s.customFrameSize : s.frameSize
      const m = raw ? String(raw).match(/^(\d+)[x-](\d+)$/) : null
      const sfs = m ? { w: m[1], h: m[2] } : null
      const vfs = getScaleSize(s.vfAtoms)
      return `-s ${sfs.w}x${sfs.h} entra en conflicto con -vf scale=${vfs.w}:${vfs.h}. Solo una opción tendrá efecto y la cadena de filtros tendrá prioridad. Deje solo una`
    },
  },
  s_and_vf_scale_redundant: { message: 'Tanto -s como -vf scale= definen el mismo tamaño: es redundante. Lo habitual es dejar solo -vf scale=W:H' },
  s_and_vf_scale_present:   { message: 'Están definidos a la vez -s y -vf scale=. Tendrá prioridad la cadena de filtros y -s se ignorará. Deje un único método de escalado' },
  prefer_vf_scale_with_hwaccel: {
    message: ({ s }) => {
      const map = { cuda: 'scale_cuda', vaapi: 'scale_vaapi', qsv: 'scale_qsv' }
      const suggested = map[s.inputHwaccel] || `scale_${s.inputHwaccel}`
      return `Usar -s junto con -hwaccel ${s.inputHwaccel} obliga a FFmpeg a escalar en CPU, es decir, a descargar los cuadros desde la GPU. Para mantener el pipeline en GPU es mejor usar -vf ${suggested}=W:H`
    },
  },

  raw_empty:                 { message: 'El comando está vacío.' },
  raw_missing_dash:          { message: ({ flag }) => `"${flag}" parece una bandera sin guion. ¿Quizá quería escribir "-${flag}"?` },
  raw_duplicate_same:        { message: ({ flag }) => `${flag} aparece más de una vez con el mismo valor: la opción es redundante` },
  raw_duplicate_diff:        { message: ({ flag }) => `${flag} aparece dos veces con valores distintos: FFmpeg solo usará el último` },
  raw_flag_before_input:     { message: ({ flag }) => `${flag} es una opción de salida/codificación, pero está antes de -i. Ese tipo de opción debe ir después de la entrada` },
  raw_flag_after_input:      { message: ({ flag }) => `${flag} es una opción de entrada, pero está después de -i. Ese tipo de opción debe ir antes de la entrada` },
  raw_flag_after_output:     { message: ({ flag }) => `${flag} aparece después del destino de salida. FFmpeg no aplica opciones que vayan después del output` },
  raw_missing_value_eof:     { message: ({ flag }) => `A ${flag} le falta el valor al final del comando` },
  raw_missing_value_next:    { message: ({ flag, next }) => `Después de ${flag} aparece ${next}, así que el valor de ${flag} parece haberse omitido` },
  raw_no_input:              { message: 'No se ha encontrado la bandera -i: FFmpeg requiere al menos una entrada' },
  raw_no_output:             { message: 'No se ha especificado ningún archivo o URL de salida' },
  raw_format_ext_mismatch:   { message: ({ fmt, ext, expected }) => `Se ha indicado -f ${fmt}, pero la extensión del archivo de salida es "${ext}". Para ese formato normalmente se espera ${expected}` },
  raw_vn_cv_conflict:        { message: '-vn y -c:v están presentes al mismo tiempo.' },
  raw_an_ca_conflict:        { message: '-an y -c:a están presentes al mismo tiempo.' },
  raw_crf_bv_conflict:       { message: '-crf y -b:v no deberían usarse al mismo tiempo.' },
  raw_multi_input_no_map:    { message: 'Hay varias entradas y no se usa -map: FFmpeg elegirá los flujos automáticamente y el resultado puede no ser el esperado' },
  raw_pipe_input:            { message: 'Se ha detectado una entrada por tubería (-i - / pipe:0). Asegúrese de que el proceso emisor escribe en un formato de contenedor compatible' },
  raw_pipe_output:           { message: 'Se ha detectado una salida por tubería (- / pipe:1). Asegúrese de que el proceso receptor puede leer el formato elegido' },
  raw_unknown_flags:         { message: ({ flags }) => `Banderas desconocidas: ${flags}` },

  serialize_flag_moved:      { message: ({ flag }) => `${flag} se ha movido antes de -i porque FFmpeg exige ese orden` },
  serialize_unknown_flag:    { message: ({ flag }) => `${flag} no es reconocido por fflint y no ha pasado validación` },
}