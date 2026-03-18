# fflint — FFmpeg Profile Validator

**fflint** is a standalone, zero-dependency JavaScript validation engine for FFmpeg encoding profiles. It accepts a plain state object describing an FFmpeg transcoding pipeline and returns a list of diagnostic results — errors, warnings, and informational hints — covering everything from trivial typos to subtle broadcast-compliance issues.

fflint is designed to be embedded into any UI that builds or edits FFmpeg commands: form-based constructors, raw-text editors, profile management dashboards, or headless CI pipelines.

> **Note:** While `fflint` can be used for any project requiring FFmpeg command validation, the current implementation is specifically tailored for the **Senta** app. As such, it includes app-specific conventions, such as using `${i}` as a placeholder for the input source and `${o}` for the output destination (which Senta dynamically replaces with actual paths or streams during execution).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)  
2. [Installation & Import](#2-installation--import)  
3. [Quick Start](#3-quick-start)  
4. [API Reference](#4-api-reference)  
5. [State Object Schema](#5-state-object-schema)  
6. [Result Object Schema](#6-result-object-schema)  
7. [Validation Layers Explained](#7-validation-layers-explained)  
8. [Using `codec-data.js` for UI Dropdowns](#8-using-codec-datajs-for-ui-dropdowns)  
9. [Custom Rules](#9-custom-rules)  
10. [Integration Patterns](#10-integration-patterns)  
11. [File Reference](#11-file-reference)  
12. [Examples](#12-examples)

---

## 1. Architecture Overview

fflint validates in **three layers**, each progressively more opinionated:

| Layer | Name | Purpose | Can be disabled? |
|-------|------|---------|------------------|
| **1** | Field-level | Type checking, enum membership, numeric ranges (e.g. "CRF must be 0–51 for libx264") | No — always runs |
| **2** | Cross-field | Logical conflicts between two or more fields (e.g. "deinterlace cannot be applied when video codec is Copy") | No — always runs |
| **3** | Broadcast / semantic | Domain-specific best practices for DVB/IPTV/HLS delivery (e.g. "GOP not aligned to segment duration") | Yes — opt out via `broadcastRules: false` |

All three layers produce the same result shape. Results are **deduplicated by group** — when multiple rules target the same logical concern, only the highest-severity result survives.

```
┌─────────────────────────────────────────────────┐
│                  Your UI / App                  │
│                                                 │
│   state = { videoCodec: 'h264_nvenc', ... }     │
│                     │                           │
│                     ▼                           │
│           ┌─────────────────┐                   │
│           │  fflint.validate │                  │
│           └────────┬────────┘                   │
│                    │                            │
│        ┌───────────┼───────────┐                │
│        ▼           ▼           ▼                │
│    Layer 1      Layer 2     Layer 3             │
│  (layer1.js)  (rules.js)  (rules.js)           │
│   field-level  cross-field  broadcast           │
│        │           │           │                │
│        └───────────┼───────────┘                │
│                    ▼                            │
│          [ ...diagnostics ]                     │
│                                                 │
│   → render alerts, disable save, show hints     │
└─────────────────────────────────────────────────┘
```

### File structure

```
fflint/
├── fflint.js        — Public API: validate()
├── layer1.js        — Layer 1 validators (field-level)
├── rules.js         — Layer 2 + 3 rule definitions
└── codec-data.js    — Enums, codec families, utility functions
```

---

## 2. Installation & Import

fflint is a set of ES modules. No build step, no bundler, no dependencies.

### Browser (ES module)

```html
<script type="module">
  import { validate } from './fflint/fflint.js'
</script>
```

### Bundled app (Vite, Webpack, Rollup, etc.)

```js
import { validate } from './fflint/fflint.js'
```

### Optional: import codec data for UI population

```js
import {
  VALID_VIDEO_CODECS,
  VALID_AUDIO_CODECS,
  VALID_OUTPUT_FORMATS,
  PRESETS,
  PROFILES,
  // ... any other enum you need
} from './fflint/codec-data.js'
```

---

## 3. Quick Start

```js
import { validate } from './fflint/fflint.js'

// Build a state object from your UI form fields
const state = {
  videoCodec:    'h264_nvenc',
  hwaccel:       'none',           // ← wrong: NVENC needs 'cuda'
  bitrateMode:   'cbr',
  targetBitrate: '4M',
  preset:        'p4',
  profile:       'main',
  gop:           50,
  audioCodec:    'aac',
  audioBitrate:  '128k',
  outputFormat:  'mpegts',
}

const results = validate(state)

// Filter by severity
const errors   = results.filter(r => r.severity === 'error')
const warnings = results.filter(r => r.severity === 'warning')
const infos    = results.filter(r => r.severity === 'info')

// Block save if errors exist
if (errors.length > 0) {
  disableSaveButton()
  showAlerts(errors)
}
```

**Output for the above state:**

```js
[
  {
    id: 'nvenc_no_hwaccel',
    group: 'hwaccel_mismatch',
    layer: 2,
    severity: 'warning',
    flag: '-hwaccel',
    message: 'NVENC codec requires -hwaccel cuda for GPU-accelerated decoding pipeline'
  },
  {
    id: 'cbr_bufsize_missing',
    group: 'cbr_bufsize',
    layer: 3,
    severity: 'warning',
    flag: '-bufsize',
    message: 'CBR mode without -bufsize has no HRD buffer constraint — set -bufsize to 1×–2× target bitrate for broadcast compliance'
  },
  // ...
]
```

---

## 4. API Reference

### `validate(state, options?)`

The single entry point. Validates the given state and returns an array of diagnostics.

```ts
function validate(
  state: object,
  options?: {
    broadcastRules?: boolean,   // default: true
    customRules?: Rule[],       // default: []
  }
): Result[]
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `state` | `object` | — | A plain object with FFmpeg profile fields. All fields are optional — only present fields are validated. See [§5](#5-state-object-schema). |
| `options.broadcastRules` | `boolean` | `true` | When `false`, Layer 3 rules (DVB/IPTV/broadcast best practices) are excluded. Useful for general-purpose or non-broadcast UIs. |
| `options.customRules` | `Rule[]` | `[]` | Additional rules appended to the built-in set. See [§9](#9-custom-rules). |

**Returns:** `Result[]` — an array of diagnostic objects, deduplicated by `group` (highest severity wins). Empty array means no issues found.

---

## 5. State Object Schema

Every field is optional. Only set the fields that are relevant to the current profile. fflint will skip validation for any field that is `undefined`.

### Input

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `inputType` | `string` | `'udp'` | Input protocol. Valid: `udp`, `rtp`, `rtmp`, `http`, `file`, `srt`, `capture` |
| `re` | `boolean` | `true` | `-re` flag (read at native rate) |
| `streamLoop` | `boolean \| number` | `-1` | `-stream_loop` value. `true` or `-1` = infinite loop, `0` = no loop, `N > 0` = repeat N times |
| `logoPath` | `string` | `'/opt/logo.png'` | Path to overlay image (second `-i` argument) |
| `timeout` | `number` | `5000000` | Input timeout in microseconds |
| `reconnect` | `boolean` | `true` | Enable HTTP reconnect |
| `reconnectStreamed` | `boolean` | `true` | Reconnect on streamed content |
| `analyzeDuration` | `number` | `5000000` | `-analyzeduration` in microseconds |
| `probeSize` | `number` | `5000000` | `-probesize` in bytes |
| `useWallclock` | `boolean` | `false` | `-use_wallclock_as_timestamps` |
| `fflags` | `string[]` | `['+genpts']` | `-fflags` values |
| `threadQueueSize` | `number` | `1024` | `-thread_queue_size` |
| `copyts` | `boolean` | `false` | `-copyts` |

### Video Encoding

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `videoCodec` | `string` | `'libx264'` | Video codec. Valid: `disabled`, `copy`, `libx264`, `libx265`, `mpeg2video`, `mpeg4`, `h264_nvenc`, `hevc_nvenc`, `h264_vaapi` |
| `hwaccel` | `string` | `'cuda'` | `-hwaccel`. Valid: `none`, `cuda`, `vaapi`, `qsv` |
| `hwaccelOutputFormat` | `string` | `'cuda'` | `-hwaccel_output_format`. Valid: `none`, `cuda`, `vaapi`, `qsv`, `d3d11va`, `opencl`, `vulkan` |
| `preset` | `string` | `'p4'` | `-preset` (codec-family-dependent) |
| `profile` | `string` | `'main'` | `-profile:v` (codec-dependent) |
| `level` | `string` | `'4.1'` | `-level` (H.264/H.265) |
| `frameSize` | `string` | `'1920x1080'` | Frame size. Use `'original'` for passthrough or `'custom'` + `customFrameSize` |
| `customFrameSize` | `string` | `'1440x900'` | Custom frame size (only when `frameSize === 'custom'`) |
| `fps` | `string` | `'25'` | Frame rate. Use `'original'` for passthrough or `'custom'` + `customFps` |
| `customFps` | `string` | `'29.97'` | Custom FPS (only when `fps === 'custom'`). Accepts decimal or fractional (`30000/1001`) |
| `gop` | `number` | `50` | `-g` (GOP / keyframe interval in frames) |
| `keyintMin` | `number` | `25` | `-keyint_min` |
| `scThreshold` | `number` | `0` | `-sc_threshold` (0 = disable scene-change keyframes) |
| `bitrateMode` | `string` | `'cbr'` | Bitrate control. Valid: `cbr`, `vbr`, `crf` |
| `targetBitrate` | `string` | `'4M'` | `-b:v` (number + suffix: `k`, `M`, `G`) |
| `maxrate` | `string` | `'5M'` | `-maxrate` |
| `bufsize` | `string` | `'8M'` | `-bufsize` |
| `crfValue` | `number` | `23` | `-crf` (only when `bitrateMode === 'crf'`) |
| `pixFmt` | `string` | `'yuv420p'` | `-pix_fmt` |
| `fieldOrder` | `string` | `'progressive'` | `-field_order` |
| `colorPrimaries` | `string` | `'bt709'` | `-color_primaries` |
| `colorTrc` | `string` | `'bt709'` | `-color_trc` |
| `colorspace` | `string` | `'bt709'` | `-colorspace` |
| `bframes` | `number` | `2` | `-bf` |
| `refs` | `number` | `3` | `-refs` |
| `aspect` | `string` | `'16:9'` | `-aspect` |
| `forcedIdr` | `boolean` | `true` | `-forced-idr 1` |
| `deinterlace` | `boolean` | `true` | Enable deinterlace filter |
| `deinterlaceFilter` | `string` | `'yadif'` | Filter name. Valid: `yadif`, `yadif_cuda`, `bwdif`, `bwdif_cuda` |
| `deinterlaceMode` | `string` | `'frame'` | Deinterlace mode (`'frame'` or `'field'`) |
| `nvdecDeint` | `number` | `1` | `-deint`. NVDEC hardware decoder deinterlace. Valid: `0` (weave/off), `1` (bob), `2` (adaptive). Conflicts with filter-based deinterlace |
| `scaleFilter` | `string` | `'scale'` | Scale filter. Valid: `scale`, `scale_cuda`, `scale_vaapi`, `scale_qsv` |
| `fpsSyncMode` | `string` | `'cfr'` | `-fps_mode`. Valid: `passthrough`, `cfr`, `vfr` |
| `bsfVideo` | `string` | `'none'` | `-bsf:v`. Valid: `none`, `h264_mp4toannexb`, `hevc_mp4toannexb`, `mpeg4_unpack_bframes` |
| `gpuIndex` | `number` | `0` | `-gpu` index for NVENC (`-1` = auto) |

### Audio Encoding

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `audioCodec` | `string` | `'aac'` | Audio codec. Valid: `disabled`, `copy`, `aac`, `libmp3lame`, `mp2`, `libtwolame`, `ac3`, `eac3`, `libopus` |
| `sampleRate` | `string` | `'48000'` | `-ar`. Valid: `original`, `44100`, `48000`, `96000` |
| `channels` | `string` | `'2'` | `-ac`. Valid: `original`, `1`, `2`, `6` |
| `channelLayout` | `string` | `'stereo'` | `-channel_layout`. Valid: `mono`, `stereo`, `2.1`, `3.0`, `4.0`, `4.1`, `5.0`, `5.1`, `6.0`, `6.1`, `7.0`, `7.1` |
| `audioBitrate` | `string` | `'128k'` | `-b:a` |
| `bsfAudio` | `string` | `'none'` | `-bsf:a`. Valid: `none`, `aac_adtstoasc` |
| `dialnorm` | `number` | `-27` | `-dialnorm` (AC3/EAC3 only, range -31 to -1) |
| `loudnorm` | `boolean` | `true` | Enable EBU R128 loudness normalization filter |
| `loudnormTarget` | `number` | `-23` | Loudness target in LUFS |
| `loudnormTruePeak` | `number` | `-1` | True peak limit in dBTP |
| `loudnormLra` | `number` | `7` | Loudness range in LU |

### Subtitles

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `subtitleMode` | `string` | `'copy'` | Subtitle handling. Valid: `disable`, `copy` |

### Output / Container

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `outputFormat` | `string` | `'mpegts'` | `-f`. Valid: `mpegts`, `flv`, `hls`, `mp4`, `matroska`, `null` |
| `hlsTime` | `number` | `6` | `-hls_time` (seconds) |
| `hlsListSize` | `number` | `5` | `-hls_list_size` (0 = unlimited) |
| `hlsFlags` | `string[]` | `['delete_segments']` | `-hls_flags` |
| `hlsSegmentType` | `string` | `'mpegts'` | `-hls_segment_type`. Valid: `mpegts`, `fmp4` |
| `hlsEnc` | `boolean` | `false` | HLS encryption enabled |
| `avoidNegativeTs` | `string` | `'make_zero'` | `-avoid_negative_ts` |

### MPEG-TS Specific

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `mpegtsServiceId` | `number` | `1` | `-mpegts_service_id` (1–65535) |
| `mpegtsStartPid` | `number` | `257` | `-mpegts_start_pid` |
| `mpegtsPmtStartPid` | `number` | `256` | `-mpegts_pmt_start_pid` |
| `mpegtsFlags` | `string[]` | `['pat_pmt_at_frames']` | `-mpegts_flags` |
| `pcrPeriod` | `number` | `40` | `-pcr_period` (ms) |

### Muxer / Buffering

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `maxDelay` | `number` | `500000` | `-max_delay` (µs) |
| `maxMuxingQueueSize` | `number` | `1024` | `-max_muxing_queue_size` |
| `listen` | `number` | `0` | `-listen` (0 = client, 1 = server) |

### Passthrough

| Field | Type | Description |
|-------|------|-------------|
| `passthroughFlags` | `string[]` | Unknown flags preserved from parsed raw text. Not validated by fflint, but your UI may emit a warning for each. |

---

## 6. Result Object Schema

Each result returned by `validate()` has the following shape:

```ts
interface Result {
  id:       string   // Unique rule identifier, e.g. 'nvenc_no_hwaccel'
  group:    string   // Deduplication group, e.g. 'hwaccel_mismatch'
  severity: 'error' | 'warning' | 'info'
  message:  string   // Human-readable diagnostic text
  flag?:    string   // The FFmpeg flag this rule relates to, e.g. '-hwaccel'
  layer:    number   // 1, 2, or 3
  hint?:    string   // (Layer 1 only) Contextual recommendation text
}
```

### Severity semantics

| Severity | Meaning | Suggested UI behavior |
|----------|---------|----------------------|
| `error` | The profile will fail at runtime or produce broken output | **Block save.** Render as a red alert card. |
| `warning` | The profile will work but may produce suboptimal or unexpected results | Allow save. Render as a yellow alert card. |
| `info` | Informational hint or best-practice suggestion | Allow save. Render as a blue alert card. |

### Deduplication

Multiple rules may target the same logical concern (e.g. several "copy codec + filter" rules all belong to group `copy_video_filter`). When two or more rules in the same group fire, only the **highest severity** result is returned. This prevents alert fatigue.

### The `hint` field (Layer 1)

Layer 1 results include a `hint` string with practical recommendations. For example:

```js
{
  id: 'l1_gop',
  group: 'l1_gop',
  severity: 'error',
  flag: '-g',
  message: 'GOP must be a positive integer (1–2147483647)',
  hint: 'Formula: fps × keyframe_interval_seconds. E.g. 25 fps × 4 s = 100. Typical live: 50–250. Recommended: match segment duration',
  layer: 1
}
```

You can display `hint` as tooltip text, a secondary line in the alert card, or collapse it behind a "Learn more" toggle.

---

## 7. Validation Layers Explained

### Layer 1 — Field-level validation (`layer1.js`)

Validates each field in isolation:

- **Enum membership** — is `videoCodec` one of the known values?
- **Numeric ranges** — is CRF within the codec's valid range? Is GOP a positive integer?
- **Format patterns** — does `targetBitrate` match `^\d+(\.\d+)?[kKmMgG]?$`?
- **Codec-dependent fields** — is the selected preset valid for the codec family?

Layer 1 catches **typos and out-of-range values** before they reach cross-field logic.

### Layer 2 — Cross-field validation (`rules.js`, `layer: 2`)

Validates logical relationships between two or more fields:

- **Copy conflicts** — copy codec + deinterlace, copy + logo overlay, copy + rescale
- **Codec / hwaccel mismatch** — NVENC without CUDA, VAAPI with wrong hwaccel
- **Bitrate mode conflicts** — CRF + target bitrate, VBR without maxrate
- **Container / codec compatibility** — HEVC in FLV, Opus in MPEG-TS, MPEG-2 in MP4
- **HDR metadata consistency** — PQ transfer with 8-bit pixel format
- **Channel / layout consistency** — channel count vs. layout mismatch
- **Hardware filter requirements** — CUDA filters without CUDA hwaccel
- **NVDEC deinterlace conflicts** — `-deint` + filter-based deinterlace (double deinterlacing), `-deint` without CUDA hwaccel

### Layer 3 — Broadcast / semantic rules (`rules.js`, `layer: 3`)

Domain-specific best practices. These are **opinionated** and may not apply to all use cases:

- **GOP alignment** — GOP should be a whole-second multiple of FPS
- **CBR integrity** — scene-change threshold should be 0, bufsize should be set
- **STB compatibility** — B-frames ≤ 2, refs ≤ 4, yuv420p only
- **HLS segment alignment** — segment duration should be a multiple of GOP duration
- **File playout** — stream loop without -re will flood the output
- **Bitrate floors** — warns when bitrate is too low for the resolution
- **Audio standards** — 48 kHz for DVB, loudnorm at 48 kHz

Disable Layer 3 for non-broadcast UIs:

```js
const results = validate(state, { broadcastRules: false })
```

---

## 8. Using `codec-data.js` for UI Dropdowns

`codec-data.js` is the **single source of truth** for all valid enum values. Import its exports to populate your UI dropdowns, ensuring the form and the validator always agree.

```js
import {
  // Dropdown population
  VALID_VIDEO_CODECS,     // ['disabled','copy','libx264','libx265',...]
  VALID_AUDIO_CODECS,     // ['disabled','copy','aac','libmp3lame',...]
  VALID_OUTPUT_FORMATS,   // ['mpegts','flv','hls','mp4','matroska','null']
  VALID_HWACCELS,         // ['none','cuda','vaapi','qsv']
  VALID_PIX_FMTS,         // ['yuv420p','yuv422p',...]
  VALID_SAMPLE_RATES,     // ['original','44100','48000','96000']
  VALID_CHANNELS,         // ['original','1','2','6']
  VALID_BITRATE_MODES,    // ['cbr','vbr','crf']
  VALID_HLS_FLAGS,        // ['delete_segments','append_list',...]
  VALID_FFLAGS,           // ['+genpts','+igndts',...]
  VALID_CHANNEL_LAYOUTS,  // ['mono','stereo','2.1',...]

  // Codec-dependent presets and profiles
  PRESETS,                // { cpu: [...], nvenc: [...], vaapi: [] }
  PROFILES,               // { libx264: [...], h264_nvenc: [...], ... }
  CODEC_PRESET_FAMILY,    // { libx264: 'cpu', h264_nvenc: 'nvenc', ... }
  CRF_RANGE,              // { libx264: [0,51], h264_vaapi: [0,52], ... }

  // Codec group arrays (for conditional UI logic)
  NVENC_CODECS,           // ['h264_nvenc','hevc_nvenc']
  VAAPI_CODECS,           // ['h264_vaapi']
  CPU_CODECS,             // ['libx264','libx265','mpeg2video','mpeg4']

  // Utility functions
  parseBitrate,           // '4M' → 4000000
  parseFrameSize,         // '1920x1080' → { w: 1920, h: 1080 }
  parseFps,               // '29.97' → 29.97, '30000/1001' → 29.97
} from './fflint/codec-data.js'
```

### Example: dynamic preset dropdown

```js
function getPresetsForCodec(codec) {
  const family = CODEC_PRESET_FAMILY[codec]
  if (!family) return []               // mpeg2video, mpeg4 — no presets
  return PRESETS[family]               // ['p1','p2',...] for nvenc, etc.
}

function getProfilesForCodec(codec) {
  return PROFILES[codec] ?? []
}

function getCrfRange(codec) {
  return CRF_RANGE[codec] ?? null      // null = CRF not supported (mpeg2video)
}
```

---

## 9. Custom Rules

Extend fflint with your own rules without modifying its source files. Custom rules follow the same shape as built-in rules:

```js
const myRules = [
  {
    id: 'my_org_max_bitrate',
    group: 'org_bitrate_policy',
    layer: 3,                            // or 2
    severity: 'warning',
    flag: '-b:v',
    check: (state) => {
      if (!state.targetBitrate) return false
      const bps = parseBitrate(state.targetBitrate)
      return bps !== null && bps > 20_000_000
    },
    message: 'Company policy limits video bitrate to 20 Mbps for CDN cost control',
  },
  {
    id: 'my_org_require_aac',
    group: 'org_audio_policy',
    layer: 2,
    severity: 'error',
    flag: '-c:a',
    check: (state) => {
      if (!state.audioCodec || state.audioCodec === 'disabled' || state.audioCodec === 'copy') return false
      return state.audioCodec !== 'aac'
    },
    message: 'Only AAC audio is permitted in this deployment',
  },
]

const results = validate(state, { customRules: myRules })
```

### Rule shape

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `group` | `string` | Yes | Deduplication group |
| `layer` | `number` | Yes | `2` or `3` (custom rules are always L2/L3) |
| `severity` | `'error' \| 'warning' \| 'info'` | Yes | Diagnostic severity |
| `flag` | `string` | No | Related FFmpeg flag |
| `check` | `(state) => boolean` | Yes | Return `true` to trigger this rule |
| `message` | `string \| (state) => string` | Yes | Diagnostic text (may be a function for dynamic messages) |

---

## 10. Integration Patterns

### Pattern A: Real-time form validation

Run `validate()` on every form change. Display results as colored cards below a live preview.

```js
form.addEventListener('change', () => {
  const state = collectFormState()
  const results = validate(state)

  const errors   = results.filter(r => r.severity === 'error')
  const warnings = results.filter(r => r.severity === 'warning')
  const infos    = results.filter(r => r.severity === 'info')

  renderAlerts(errors, warnings, infos)
  saveButton.disabled = errors.length > 0
})
```

### Pattern B: Save-time validation

Only validate when the user clicks Save. Useful for raw-text editor modes.

```js
saveButton.addEventListener('click', () => {
  const state = parseRawTextToState(editor.value)
  const results = validate(state)
  const errors = results.filter(r => r.severity === 'error')

  if (errors.length > 0) {
    showErrorDialog(errors)
    return
  }

  saveProfile(state)
})
```

### Pattern C: Rendering alerts

```js
function renderAlerts(results) {
  const container = document.getElementById('alerts')
  container.innerHTML = ''

  for (const r of results) {
    const card = document.createElement('div')
    card.className = `alert alert--${r.severity}`

    const icon = { error: '🔴', warning: '🟡', info: '🔵' }[r.severity]
    card.innerHTML = `
      <span class="alert__icon">${icon}</span>
      <span class="alert__flag">${r.flag ?? ''}</span>
      <span class="alert__message">${r.message}</span>
      ${r.hint ? `<span class="alert__hint">${r.hint}</span>` : ''}
    `

    container.appendChild(card)
  }
}
```

### Pattern D: Filtering results by flag (for inline field errors)

Show validation messages next to the form field they relate to:

```js
function getFieldErrors(results, flag) {
  return results.filter(r => r.flag === flag)
}

// Example: show errors next to the preset dropdown
const presetErrors = getFieldErrors(results, '-preset')
presetDropdown.classList.toggle('has-error', presetErrors.some(r => r.severity === 'error'))
presetDropdown.title = presetErrors.map(r => r.message).join('\n')
```

### Pattern E: Non-broadcast UI

If your application is a general-purpose FFmpeg GUI (not broadcast/IPTV), disable Layer 3:

```js
const results = validate(state, { broadcastRules: false })
```

---

## 11. File Reference

### `fflint.js`

| Export | Description |
|--------|-------------|
| `validate(state, options?)` | Main entry point. Returns `Result[]`. |

### `layer1.js`

| Export | Description |
|--------|-------------|
| `validateLayer1(state)` | Runs all Layer 1 checks. Called internally by `validate()`. Can be imported directly for unit testing individual validators. |
| `validateGop(state)` | Individual validator (exported for testing). Same for `validateCrf`, `validateBitrates`, `validatePreset`, `validateProfile`, `validateLevel`, etc. |

### `rules.js`

| Export | Description |
|--------|-------------|
| `rules` | Array of Layer 2 + Layer 3 rule objects. Can be imported to inspect, filter, or extend the rule set. |

### `codec-data.js`

| Export | Description |
|--------|-------------|
| `VALID_*` | Enum arrays for all supported field values. Use for dropdown population. |
| `PRESETS` | Preset families keyed by `cpu`, `nvenc`, `vaapi`. |
| `PROFILES` | Valid profiles keyed by codec name. |
| `CRF_RANGE` | CRF min/max per codec. |
| `CODEC_PRESET_FAMILY` | Maps codec → preset family key. |
| `LEVEL_LIMITS` | H.264 level → max resolution/fps. |
| `BITRATE_FLOOR` | Minimum recommended bitrate per resolution. |
| `AUDIO_BITRATE_FLOOR` | Minimum recommended audio bitrate per codec + channels. |
| `NVENC_CODECS`, `VAAPI_CODECS`, `CPU_CODECS`, `HEVC_CODECS`, `DOLBY_CODECS` | Codec group arrays for conditional logic. |
| `LIVE_INPUTS`, `HTTP_INPUTS` | Input type groups. |
| `parseBitrate(str)` | Parses `'4M'` → `4000000`. Returns `null` on invalid input. |
| `parseFrameSize(str)` | Parses `'1920x1080'` → `{ w: 1920, h: 1080 }`. Returns `null` on invalid input. |
| `parseFps(str)` | Parses `'29.97'` or `'30000/1001'` → `29.97`. Returns `NaN` on invalid input. |

---

## 12. Examples

### Example 1: Minimal valid IPTV profile

```js
validate({
  inputType:     'udp',
  videoCodec:    'libx264',
  preset:        'veryfast',
  profile:       'high',
  bitrateMode:   'cbr',
  targetBitrate: '4M',
  bufsize:       '8M',
  maxrate:       '4M',
  gop:           50,
  keyintMin:     50,
  scThreshold:   0,
  fps:           '25',
  frameSize:     '1920x1080',
  audioCodec:    'aac',
  audioBitrate:  '192k',
  sampleRate:    '48000',
  channels:      '2',
  outputFormat:  'mpegts',
})
// → [] (no issues)
```

### Example 2: GPU pipeline misconfiguration

```js
validate({
  videoCodec:          'h264_nvenc',
  hwaccel:             'cuda',
  hwaccelOutputFormat: 'vaapi',   // ← mismatch
  preset:              'medium',
  deinterlaceFilter:   'yadif_cuda',
  outputFormat:        'mpegts',
})
// → [
//   { id: 'hwaccel_output_fmt_mismatch', severity: 'error', message: '...' },
//   { id: 'cuda_filter_no_output_fmt',   severity: 'warning', message: '...' },
// ]
```

### Example 3: Container/codec incompatibility

```js
validate({
  videoCodec:   'hevc_nvenc',
  outputFormat: 'flv',
  audioCodec:   'ac3',
})
// → [
//   { id: 'flv_hevc',        severity: 'error', message: 'FLV container does not support HEVC video...' },
//   { id: 'flv_audio_compat', severity: 'error', message: 'FLV container only supports AAC and MP3 audio...' },
// ]
```

### Example 4: Using dynamic messages

Some rules produce messages that include state values:

```js
validate({
  videoCodec: 'libx264',
  preset:     'p4',              // NVENC preset used with CPU codec
})
// → [
//   {
//     id: 'l1_preset',
//     severity: 'error',
//     message: 'Preset "p4" is not valid for libx264 (cpu family). Valid: ultrafast, superfast, ...',
//     hint: 'Recommended: "medium" for a good speed/quality balance'
//   }
// ]
```

---

## Rule Count Summary

| Layer | Rules | Focus |
|-------|-------|-------|
| 1 | ~35+ | Field types, enum membership, numeric ranges |
| 2 | ~45+ | Cross-field conflicts, codec/container compatibility |
| 3 | ~25+ | Broadcast best practices, GOP/HLS alignment, STB compatibility |
| **Total** | **~105+** | |

---

## FFmpeg Command Ordering

fflint is a **validation-only** library — it does not build or parse FFmpeg command strings. However, the Senta Constructor that embeds fflint follows the canonical FFmpeg option ordering:

```
ffmpeg [global opts] [pre-input opts] -i <input> [-i <input2>] [stream maps] [output codec/filter opts] -f <format> [muxer opts] <output>
```

This corresponds to the Go struct model:

```go
type FFmpegCommand struct {
    GlobalOpts []Option      // -y, -hide_banner
    Inputs     []InputBlock  // [{Options: [-hwaccel cuda, -re, ...], URL: "${i}"}]
    Outputs    []OutputBlock // [{Options: [-c:v libx264, -b:v 4M, -f mpegts, ...], URL: "${o}"}]
}
```

**Key ordering rules enforced by the constructor:**

| Zone | Position | Flags placed here |
|------|----------|-------------------|
| Global / pre-input | Before `-i` | `-hwaccel`, `-hwaccel_output_format`, `-deint`, `-c:v` (decoder), `-gpu`, `-re`, `-stream_loop`, `-fflags`, `-use_wallclock_as_timestamps`, `-analyzeduration`, `-probesize`, `-timeout`, `-thread_queue_size`, pre-input variables |
| Stream mapping | After last `-i` | `-map` entries |
| Output encoding | After `-map` | `-c:v` (encoder), `-preset`, `-profile:v`, `-s`, `-r`, `-g`, video/audio encoding params, filters |
| Muxer / container | After encoding | `-f`, HLS/MPEG-TS options, `-max_delay`, `-copyts`, `-avoid_negative_ts` |
| Post-output | Before `${o}` | Post-input variables, passthrough flags |

The manual editor mode additionally warns when pre-input flags appear after `-i` or output flags appear before `-i`.

---

## License

fflint is part of the Senta project by Cesbo.
