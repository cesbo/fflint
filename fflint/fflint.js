// fflint.js
import { rules }          from './rules.js'
import { validateLayer1 } from './layer1.js'

/** Library version number */
export const VERSION = '1.2.0'

// Re-export parse and serialize for convenience
export { parse } from './parse.js'
export { serialize } from './serialize.js'

/**
 * Maps FFmpeg flag names to their corresponding form field names.
 * Included in each validation result as the `field` property so clients
 * can highlight the relevant form control without maintaining their own mapping.
 */
export const FLAG_TO_FIELD = {
  '-i':                     'inputType',
  '-c:v':                   'videoCodec',
  '-c:a':                   'audioCodec',
  '-c:s':                   'subtitleMode',
  '-hwaccel':               'hwaccel',
  '-hwaccel_output_format': 'hwaccelOutputFormat',
  '-deint':                 'nvdecDeint',
  '-gpu':                   'gpuIndex',
  '-preset':                'preset',
  '-tune':                  'tune',
  '-profile:v':             'profile',
  '-tier':                  'tier',
  '-lookahead':             'lookahead',
  '-s':                     'frameSize',
  '-r':                     'fps',
  '-g':                     'gop',
  '-keyint_min':            'keyintMin',
  '-sc_threshold':          'scThreshold',
  '-b:v':                   'bitrate',
  '-b:v/-crf':              'bitrateMode',
  '-crf':                   'crfValue',
  '-maxrate':               'maxrate',
  '-bufsize':               'bufsize',
  '-pix_fmt':               'pixFmt',
  '-level':                 'level',
  '-level:v':               'level',
  '-bf':                    'bframes',
  '-refs':                  'refs',
  '-bsf:v':                 'bsfVideo',
  '-field_order':           'fieldOrder',
  '-color_primaries':       'colorPrimaries',
  '-color_trc':             'colorTrc',
  '-colorspace':            'colorspace',
  '-vf':                    'vfChain',
  '-filter:v':              'vfChain',
  '-filter_complex':        'filterComplex',
  '-ar':                    'sampleRate',
  '-ac':                    'channels',
  '-b:a':                   'audioBitrate',
  '-dialnorm':              'dialnorm',
  '-bsf:a':                 'bsfAudio',
  '-channel_layout':        'channelLayout',
  '-af':                    'audioFilter',
  '-af loudnorm I=':        'loudnormTarget',
  '-af loudnorm TP=':       'loudnormTruePeak',
  '-af loudnorm LRA=':      'loudnormLra',
  '-f':                     'outputFormat',
  '-hls_time':              'hlsTime',
  '-hls_list_size':         'hlsListSize',
  '-hls_flags':             'hlsFlags',
  '-hls_segment_type':      'hlsSegmentType',
  '-avoid_negative_ts':     'avoidNegativeTs',
  '-mpegts_service_id':     'mpegtsServiceId',
  '-mpegts_pmt_start_pid':  'mpegtsPmtStartPid',
  '-mpegts_start_pid':      'mpegtsStartPid',
  '-mpegts_flags':          'mpegtsFlags',
  '-pcr_period':            'pcrPeriod',
  '-fflags':                'fflags',
  '-max_delay':             'maxDelay',
  '-timeout':               'timeout',
  '-thread_queue_size':     'threadQueueSize',
  '-analyzeduration':       'analyzeDuration',
  '-probesize':             'probeSize',
  '-max_muxing_queue_size': 'maxMuxingQueueSize',
  '-aspect':                'aspect',
  '-fps_mode':              'fpsSyncMode',
  '-stream_loop':           'streamLoop',
  '-reconnect':             'reconnect',
  '-reconnect_streamed':    'reconnectStreamed',
  '-listen':                'listen',
}

/**
 * Validate an FFmpeg profile state object.
 *
 * @param {object} state                          All fields optional.
 * @param {object} [options]
 * @param {boolean} [options.broadcastRules=true] Include Layer 3 DVB/IPTV rules.
 * @param {Array}   [options.customRules=[]]      Extra rules to append.
 * @returns {Array} Result objects { id, group, severity, message, flag, field, layer }
 */
export function validate(state, options = {}) {
  const { broadcastRules = true, customRules = [] } = options

  const activeRules = [
    ...rules.filter(r => broadcastRules || r.layer !== 3),
    ...customRules,
  ]

  const l1   = validateLayer1(state).map(r => ({ ...r, field: FLAG_TO_FIELD[r.flag] }))
  const l2l3 = activeRules
    .filter(r => r.check(state))
    .map(({ id, group, severity, flag, layer, message: rawMessage }) => ({
      id,
      group,
      severity,
      flag,
      field: FLAG_TO_FIELD[flag],
      layer,
      message: typeof rawMessage === 'function' ? rawMessage(state) : rawMessage,
    }))
  return deduplicate([...l1, ...l2l3])
}

function deduplicate(results) {
  const best = new Map()
  for (const r of results) {
    const existing = best.get(r.group)
    if (!existing || rank(r.severity) > rank(existing.severity))
      best.set(r.group, r)
  }
  return [...best.values()]
}

function rank(s) {
  return { info: 0, warning: 1, error: 2 }[s] ?? 0
}
