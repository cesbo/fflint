import { validate as fflintValidate } from './fflint/fflint.js';

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  name: '', inputType: 'udp', logoPath: '',
  re: false, loop: false, wallclock: false, fflags: [], maxDelay: '',
  analyzeduration: '', probesize: '', copyts: false,
  videoEnabled: true, videoCodec: 'copy', hwaccel: 'none', hwaccelOutputFormat: 'none', inputDecoderCodec: '',
  preset: '', vprofile: '', frameSize: 'original', customFrameSize: '',
  fps: 'original', customFps: '',
  gop: '50', bitrateMode: 'cbr', bitrate: '4M', maxrate: '', bufsize: '',
  deinterlaceFilter: '', nvdecDeint: '', forcedIdr: false,
  pixFmt: '', level: '', scThreshold: '', bframes: '', refs: '', bsfVideo: 'none',
  fieldOrder: '', colorPrimaries: '', colorTrc: '', colorspace: '',
  audioEnabled: true, audioCodec: 'copy',
  sampleRate: 'original', channels: 'original', audioBitrate: 'default',
  dialnorm: '', bsfAudio: 'none',
  outputFormat: 'mpegts',
  hlsTime: '4', hlsListSize: '5', hlsFlags: '', hlsSegmentType: 'mpegts',
  avoidNegativeTs: '',
  mpegtsServiceId: '', mpegtsPmtStartPid: '', mpegtsStartPid: '',
    mpegtsFlags: [], pcrPeriod: '',
  maps: [],             // ['-map' values, e.g. '0:v', '0:a:0']
  variables: [],        // [{name, label, description, command, defaultVal, position}]
  keyintMin: '',        // parsed from -keyint_min; empty = use FFmpeg default
  passthroughPreInput: [],  // unknown flags before -i, preserved verbatim
  passthroughPostInput: []  // unknown flags after -i, preserved verbatim
};

// ─── Profiles Store (localStorage) ────────────────────────────────────────────
let profilesStore = [];
let editingProfileId = null;
let nextProfileId = 1;

function loadProfilesStore() {
  try {
    const raw = localStorage.getItem('senta_profiles');
    if (raw) {
      profilesStore = JSON.parse(raw);
      nextProfileId = profilesStore.reduce((m, p) => Math.max(m, p.id + 1), 1);
    }
  } catch (e) { profilesStore = []; }

  // Seed built-in presets on first load
  if (profilesStore.length === 0) {
    Object.keys(PRESETS).forEach(key => {
      const p = PRESETS[key];
      const command = buildCommandOnly(p);
      profilesStore.push({ id: nextProfileId++, name: p.name, command: command, builtIn: true });
    });
    saveProfilesStore();
  }
}

function saveProfilesStore() {
  localStorage.setItem('senta_profiles', JSON.stringify(profilesStore));
}

function renderProfilesList() {
  const tbody = document.getElementById('profiles-tbody');
  const empty = document.getElementById('profiles-empty');
  const table = document.getElementById('profiles-table');
  tbody.innerHTML = '';
  if (profilesStore.length === 0) {
    empty.style.display = '';
    table.style.display = 'none';
  } else {
    empty.style.display = 'none';
    table.style.display = '';
    profilesStore.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.id}</td><td>${escHtml(p.name || '(unnamed)')}</td>
        <td style="text-align:right">
          <button class="btn-icon" onclick="editProfile(${p.id})" title="Edit">✎</button>
          <button class="btn-icon btn-icon-danger" onclick="deleteProfile(${p.id})" title="Delete">✕</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }
}

// ─── View Switching ──────────────────────────────────────────────────────────
function switchView(view) {
  document.getElementById('view-profiles-list').classList.toggle('hidden', view !== 'list');
  document.getElementById('view-editor').classList.toggle('hidden', view !== 'editor');
}

function startNewProfile() {
  editingProfileId = null;
  resetState();
  syncToForm(state);
  renderVariables();
  applyDisabledStates();
  doRebuild();
  document.getElementById('editor-title').textContent = 'Add Profile';
  switchView('editor');
  switchTab('constructor');
}

function editProfile(id) {
  const profile = profilesStore.find(p => p.id === id);
  if (!profile) return;
  editingProfileId = id;
  const parsed = parseFFmpegCommand(profile.command || '');
  parsed.name = profile.name || parsed.name;
  Object.assign(state, parsed);
  syncToForm(state);
  renderVariables();
  applyDisabledStates();
  doRebuild();
  document.getElementById('editor-title').textContent = 'Edit Profile: ' + (profile.name || '#' + id);
  switchView('editor');
  switchTab('constructor');
}

function deleteProfile(id) {
  if (!confirm('Delete this profile?')) return;
  profilesStore = profilesStore.filter(p => p.id !== id);
  saveProfilesStore();
  renderProfilesList();
}

function goBackToList() {
  editingProfileId = null;
  switchView('list');
  renderProfilesList();
}

function resetState() {
  Object.assign(state, {
    name: '', inputType: 'udp', logoPath: '',
    re: false, loop: false,
    videoEnabled: true, videoCodec: 'copy', hwaccel: 'none', hwaccelOutputFormat: 'none', inputDecoderCodec: '', gpuIndex: '',
    preset: '', vprofile: '', frameSize: 'original', customFrameSize: '',
    fps: 'original', customFps: '',
    gop: '50', bitrateMode: 'cbr', bitrate: '4M', maxrate: '', bufsize: '',
    deinterlaceFilter: '', nvdecDeint: '', forcedIdr: false,
    audioEnabled: true, audioCodec: 'copy',
    sampleRate: 'original', channels: 'original', audioBitrate: 'default',
    outputFormat: 'mpegts',
    hlsTime: '4', hlsListSize: '5', hlsFlags: '',
    analyzeduration: '', probesize: '', copyts: false,
    maps: [],
    variables: [],
    passthroughPreInput: [],
    passthroughPostInput: []
  });
}

function saveCurrentProfile() {
  syncFromForm();
  const { errors } = validate(state);
  if (errors.length > 0) return; // blocked by UI anyway
  const command = buildCommandOnly(state);
  if (editingProfileId !== null) {
    const idx = profilesStore.findIndex(p => p.id === editingProfileId);
    if (idx !== -1) {
      profilesStore[idx].name = state.name;
      profilesStore[idx].command = command;
    }
  } else {
    profilesStore.push({ id: nextProfileId++, name: state.name, command: command });
  }
  saveProfilesStore();
  showSavedFeedback();
  setTimeout(() => goBackToList(), 600);
}

function saveFromManual() {
  // Validate manual editor content before saving
  const rawText = document.getElementById('manual-textarea').value.trim();
  const manualErrors = validateManualText(rawText);
  if (manualErrors.length > 0) {
    alert('Cannot save:\n\n' + manualErrors.join('\n'));
    return;
  }
  const parsed = parseFFmpegCommand(rawText);
  parsed.name = document.getElementById('manual-name').value || parsed.name;
  Object.assign(state, parsed);
  const command = buildCommandOnly(state);
  if (editingProfileId !== null) {
    const idx = profilesStore.findIndex(p => p.id === editingProfileId);
    if (idx !== -1) {
      profilesStore[idx].name = state.name;
      profilesStore[idx].command = command;
    }
  } else {
    profilesStore.push({ id: nextProfileId++, name: state.name, command: command });
  }
  saveProfilesStore();
  showSavedFeedback('manual-save-btn');
  setTimeout(() => goBackToList(), 600);
}

function showSavedFeedback(btnId) {
  const btn = document.getElementById(btnId || 'save-btn');
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = '✓ Saved!';
  btn.style.background = '#16a34a';
  setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2500);
}

const PRESETS = {
  dvb_copy: { name:'DVB Re-stream (Copy)', inputType:'udp', re:false, loop:false, logoPath:'', videoEnabled:true, videoCodec:'copy', hwaccel:'none', preset:'', vprofile:'', frameSize:'original', customFrameSize:'', fps:'original', customFps:'', gop:'50', bitrateMode:'cbr', bitrate:'', maxrate:'', bufsize:'', deinterlaceFilter:'', forcedIdr:false, audioEnabled:true, audioCodec:'copy', sampleRate:'original', channels:'original', audioBitrate:'default', outputFormat:'mpegts', hlsTime:'4', hlsListSize:'5', hlsFlags:'', variables:[] },
  hd_nvenc: { name:'HD IPTV (NVENC)', inputType:'udp', re:false, loop:false, logoPath:'', videoEnabled:true, videoCodec:'h264_nvenc', hwaccel:'cuda', preset:'fast', vprofile:'main', frameSize:'original', customFrameSize:'', fps:'25', customFps:'', gop:'50', bitrateMode:'cbr', bitrate:'4M', maxrate:'', bufsize:'', deinterlaceFilter:'yadif', forcedIdr:true, audioEnabled:true, audioCodec:'aac', sampleRate:'48000', channels:'stereo', audioBitrate:'128k', outputFormat:'mpegts', hlsTime:'4', hlsListSize:'5', hlsFlags:'', variables:[{name:'gpu',label:'GPU',description:'GPU index for NVENC (-gpu 0)',command:'-gpu $value',defaultVal:''}] },
  hd_cpu: { name:'HD IPTV (CPU x264)', inputType:'udp', re:false, loop:false, logoPath:'', videoEnabled:true, videoCodec:'libx264', hwaccel:'none', preset:'fast', vprofile:'main', frameSize:'1920x1080', customFrameSize:'', fps:'25', customFps:'', gop:'50', bitrateMode:'cbr', bitrate:'4M', maxrate:'', bufsize:'', deinterlaceFilter:'', forcedIdr:false, audioEnabled:true, audioCodec:'aac', sampleRate:'48000', channels:'stereo', audioBitrate:'128k', outputFormat:'mpegts', hlsTime:'4', hlsListSize:'5', hlsFlags:'', variables:[] },
  sd_cpu: { name:'SD IPTV (CPU x264)', inputType:'udp', re:false, loop:false, logoPath:'', videoEnabled:true, videoCodec:'libx264', hwaccel:'none', preset:'fast', vprofile:'main', frameSize:'720x576', customFrameSize:'', fps:'25', customFps:'', gop:'50', bitrateMode:'cbr', bitrate:'1.5M', maxrate:'', bufsize:'', deinterlaceFilter:'yadif', forcedIdr:false, audioEnabled:true, audioCodec:'aac', sampleRate:'48000', channels:'stereo', audioBitrate:'96k', outputFormat:'mpegts', hlsTime:'4', hlsListSize:'5', hlsFlags:'', variables:[] },
  file_loop: { name:'File Loop Broadcast', inputType:'file', re:true, loop:true, logoPath:'', videoEnabled:true, videoCodec:'copy', hwaccel:'none', preset:'', vprofile:'', frameSize:'original', customFrameSize:'', fps:'original', customFps:'', gop:'50', bitrateMode:'cbr', bitrate:'', maxrate:'', bufsize:'', deinterlaceFilter:'', forcedIdr:false, audioEnabled:true, audioCodec:'copy', sampleRate:'original', channels:'original', audioBitrate:'default', outputFormat:'mpegts', hlsTime:'4', hlsListSize:'5', hlsFlags:'', variables:[] },
  rtmp_push: { name:'RTMP Push (Copy)', inputType:'rtmp', re:false, loop:false, logoPath:'', videoEnabled:true, videoCodec:'copy', hwaccel:'none', preset:'', vprofile:'', frameSize:'original', customFrameSize:'', fps:'original', customFps:'', gop:'50', bitrateMode:'cbr', bitrate:'', maxrate:'', bufsize:'', deinterlaceFilter:'', forcedIdr:false, audioEnabled:true, audioCodec:'copy', sampleRate:'original', channels:'original', audioBitrate:'default', outputFormat:'flv', hlsTime:'4', hlsListSize:'5', hlsFlags:'', variables:[] },
  hls: { name:'HLS Output (x264)', inputType:'udp', re:false, loop:false, logoPath:'', videoEnabled:true, videoCodec:'libx264', hwaccel:'none', preset:'fast', vprofile:'main', frameSize:'1280x720', customFrameSize:'', fps:'25', customFps:'', gop:'100', bitrateMode:'cbr', bitrate:'2M', maxrate:'', bufsize:'', deinterlaceFilter:'', forcedIdr:false, audioEnabled:true, audioCodec:'aac', sampleRate:'44100', channels:'stereo', audioBitrate:'128k', outputFormat:'hls', hlsTime:'4', hlsListSize:'5', hlsFlags:'delete_segments', variables:[] },
  dvb_logo: { name:'DVB + Logo Overlay', inputType:'udp', re:false, loop:false, logoPath:'/path/to/logo.png', videoEnabled:true, videoCodec:'libx264', hwaccel:'none', preset:'fast', vprofile:'main', frameSize:'original', customFrameSize:'', fps:'25', customFps:'', gop:'50', bitrateMode:'cbr', bitrate:'4M', maxrate:'', bufsize:'', deinterlaceFilter:'', forcedIdr:false, audioEnabled:true, audioCodec:'aac', sampleRate:'48000', channels:'stereo', audioBitrate:'128k', outputFormat:'mpegts', hlsTime:'4', hlsListSize:'5', hlsFlags:'', variables:[] }
};

// ─── Section Collapse ─────────────────────────────────────────────────────────
function toggleSection(headerEl) {
  headerEl.classList.toggle('collapsed');
  const body = headerEl.nextElementSibling;
  body.classList.toggle('collapsed');
}

// ─── Toggles ──────────────────────────────────────────────────────────────────
function toggleField(key) {
  state[key] = !state[key];
  document.getElementById('track-' + key).classList.toggle('on', state[key]);
  applyDisabledStates();
  rebuild();
}

function setToggle(key, val) {
  state[key] = val;
  document.getElementById('track-' + key).classList.toggle('on', val);
}

// ─── Pill chip toggle ─────────────────────────────────────────────────────────
function togglePill(el) {
  el.classList.toggle('active');
  rebuild();
}
window.togglePill = togglePill;

// ─── Conditional field visibility ─────────────────────────────────────────────
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function onFrameSizeChange() {
  document.getElementById('customFrameSizeField').style.display =
    document.getElementById('f-frameSize').value === 'custom' ? '' : 'none';
  rebuild();
}

function onFpsChange() {
  document.getElementById('customFpsField').style.display =
    document.getElementById('f-fps').value === 'custom' ? '' : 'none';
  rebuild();
}

function onInputTypeChange() {
  syncFromForm();
  const t = state.inputType;

  const showRe   = (t === 'file' || t === 'http');
  const showLoop = (t === 'file');

  // Show / hide toggle fields
  document.getElementById('field-re').style.display   = showRe   ? '' : 'none';
  document.getElementById('field-loop').style.display  = showLoop ? '' : 'none';

  // Auto-enable -re for file & HTTP (non-live sources)
  const needRe = (t === 'file' || t === 'http');
  setToggle('re', needRe);
  state.re = needRe;

  // Auto-enable -stream_loop for file (infinite loop); off for HTTP by default
  const needLoop = (t === 'file');
  setToggle('loop', needLoop);
  state.loop = needLoop;

  rebuild();
}

function onBitrateModeChange() {
  const mode = document.getElementById('f-bitrateMode').value;
  document.getElementById('maxrateField').style.display = mode === 'vbr' ? '' : 'none';
  document.getElementById('bufsizeField').style.display = mode === 'vbr' ? '' : 'none';
  document.getElementById('bitrate-label').textContent =
    mode === 'crf' ? 'CRF Value (0–51)' : 'Target Bitrate';
  rebuild();
}

function onOutputFormatChange() {
  const fmt    = document.getElementById('f-outputFormat').value;
  const isHls  = fmt === 'hls';
  const isMpegts = fmt === 'mpegts';
  document.getElementById('hlsTimeField').style.display = isHls ? '' : 'none';
  document.getElementById('hlsListField').style.display = isHls ? '' : 'none';
  document.getElementById('hlsFlagsField').style.display = isHls ? '' : 'none';
  document.getElementById('hlsSegmentTypeField').style.display = isHls ? '' : 'none';
  document.getElementById('mpegtsSectionFields').style.display = isMpegts ? '' : 'none';
  rebuild();
}

// ─── Disabled states ──────────────────────────────────────────────────────────
// Per-codec valid profiles — mirrors PROFILES in codec-data.js
const CODEC_PROFILES = {
  libx264:    ['baseline','main','high','high10','high422','high444'],
  libx265:    ['main','main10','main12','mainstillpicture'],
  h264_nvenc: ['baseline','main','high','high444p'],
  hevc_nvenc: ['main','main10','rext'],
  h264_vaapi: ['constrained_baseline','main','high'],
}

function updateProfileOptions(codec) {
  const sel = document.getElementById('f-vprofile')
  const allowed = CODEC_PROFILES[codec] || null
  let currentVal = sel.value
  Array.from(sel.options).forEach(opt => {
    if (!opt.value) return // keep "— None —"
    opt.hidden = allowed !== null && !allowed.includes(opt.value)
  })
  // If current selection is now hidden, reset to none
  if (allowed !== null && currentVal && !allowed.includes(currentVal)) {
    sel.value = ''
    state.vprofile = ''
  }
}

function applyDisabledStates() {
  const vCodec = state.videoCodec;
  const vOff = (vCodec === 'disabled');
  const vCopy = (vCodec === 'copy');
  const isGpu = vCodec.includes('nvenc') || vCodec.includes('vaapi') || vCodec.includes('qsv');

  // Video encoding options visibility
  document.getElementById('videoOptionsBlock').style.display = (!vOff && !vCopy) ? '' : 'none';
  setDisabled('f-hwaccel', !isGpu);
  if (!isGpu) {
    const hwEl = document.getElementById('f-hwaccel');
    if (hwEl && hwEl.value !== 'none') { hwEl.value = 'none'; state.hwaccel = 'none'; }
  }
  // GPU index — only visible for NVENC codecs
  const isNvenc = vCodec.includes('nvenc');
  const gpuField = document.getElementById('gpuIndexField');
  if (gpuField) gpuField.style.display = isNvenc ? '' : 'none';
  if (!isNvenc) {
    const gpuEl = document.getElementById('f-gpuIndex');
    if (gpuEl && gpuEl.value !== '') { gpuEl.value = ''; state.gpuIndex = ''; }
  }
  updateProfileOptions(vCodec);

  const aCodec = state.audioCodec;
  const aOff = (aCodec === 'disabled');
  const aCopy = (aCodec === 'copy');

  // Audio encoding options visibility
  document.getElementById('audioOptionsBlock').style.display = (!aOff && !aCopy) ? '' : 'none';

  // Show/hide logo field
  document.getElementById('logo-field').style.display = state.logoPath ? '' : 'none';
}

function setDisabled(id, val) {
  const el = document.getElementById(id);
  if (el) el.disabled = val;
}
function setToggleDisabled(id, val) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('disabled', val);
}

// ─── Sync form ↔ state ───────────────────────────────────────────────────────
const FORM_KEYS = [
  'name','inputType','logoPath','maxDelay','timeout','threadQueueSize',
  'analyzeduration','probesize',
  'videoCodec','hwaccel','hwaccelOutputFormat','gpuIndex','preset','vprofile','frameSize','customFrameSize','fps','customFps',
  'gop','bitrateMode','bitrate','maxrate','bufsize','deinterlaceFilter','nvdecDeint',
  'pixFmt','level','scThreshold','bframes','refs','bsfVideo',
  'fieldOrder','colorPrimaries','colorTrc','colorspace',
  'audioCodec','sampleRate','channels','audioBitrate','dialnorm','bsfAudio',
  'outputFormat','hlsTime','hlsListSize','hlsFlags','hlsSegmentType',
  'avoidNegativeTs','mpegtsServiceId','mpegtsPmtStartPid','mpegtsStartPid',
  'pcrPeriod',
];

const TOGGLE_KEYS = ['re','loop','forcedIdr','wallclock','copyts'];

function syncFromForm() {
  FORM_KEYS.forEach(k => {
    const el = document.getElementById('f-' + k);
    if (el) state[k] = el.value;
  });
  // fflags — read pills
  state.fflags = Array.from(
    document.querySelectorAll('#fflags-group .pill.active')
  ).map(p => p.dataset.value);
  // mpegtsFlags — read pills
  state.mpegtsFlags = Array.from(
    document.querySelectorAll('#mpegtsFlags-group .pill.active')
  ).map(p => p.dataset.value);
  // Custom passthrough flags
  const preText = (document.getElementById('f-passthroughPreInput') || {}).value || '';
  state.passthroughPreInput = preText.trim() ? (preText.match(/"[^"]*"|\S+/g) || []) : [];
  const postText = (document.getElementById('f-passthroughPostInput') || {}).value || '';
  state.passthroughPostInput = postText.trim() ? (postText.match(/"[^"]*"|\S+/g) || []) : [];
  // Maps
  const mapsText = (document.getElementById('f-maps') || {}).value || '';
  state.maps = mapsText.trim() ? mapsText.trim().split(/[,\s]+/).filter(Boolean) : [];
  // Derive enabled flags from codec selection
  state.videoEnabled = (state.videoCodec !== 'disabled');
  state.audioEnabled = (state.audioCodec !== 'disabled');
}

function syncToForm(s) {
  // Map videoEnabled/audioEnabled to 'disabled' codec value
  if (s.videoEnabled === false) s.videoCodec = 'disabled';
  if (s.audioEnabled === false) s.audioCodec = 'disabled';

  FORM_KEYS.forEach(k => {
    const el = document.getElementById('f-' + k);
    if (el && s[k] !== undefined) el.value = s[k];
  });
  TOGGLE_KEYS.forEach(k => {
    if (s[k] !== undefined) setToggle(k, s[k]);
  });
  // fflags — set pills
  const active = Array.isArray(s.fflags) ? s.fflags : [];
  document.querySelectorAll('#fflags-group .pill').forEach(p => {
    p.classList.toggle('active', active.includes(p.dataset.value));
  });
  // mpegtsFlags — set pills
  const activeMpegtsFlags = Array.isArray(s.mpegtsFlags) ? s.mpegtsFlags : [];
  document.querySelectorAll('#mpegtsFlags-group .pill').forEach(p => {
    p.classList.toggle('active', activeMpegtsFlags.includes(p.dataset.value));
  });
  // Custom passthrough flags
  const preEl = document.getElementById('f-passthroughPreInput');
  if (preEl) preEl.value = Array.isArray(s.passthroughPreInput) ? s.passthroughPreInput.join(' ') : '';
  const postEl = document.getElementById('f-passthroughPostInput');
  if (postEl) postEl.value = Array.isArray(s.passthroughPostInput) ? s.passthroughPostInput.join(' ') : '';
  // Maps
  const mapsEl = document.getElementById('f-maps');
  if (mapsEl) mapsEl.value = Array.isArray(s.maps) ? s.maps.join(' ') : '';
  // Video/Audio options block visibility
  const vCodec = s.videoCodec || 'copy';
  document.getElementById('videoOptionsBlock').style.display = (vCodec !== 'disabled' && vCodec !== 'copy') ? '' : 'none';
  updateProfileOptions(vCodec);
  const aCodec = s.audioCodec || 'copy';
  document.getElementById('audioOptionsBlock').style.display = (aCodec !== 'disabled' && aCodec !== 'copy') ? '' : 'none';

  // conditional fields visibility
  document.getElementById('customFrameSizeField').style.display = s.frameSize === 'custom' ? '' : 'none';
  document.getElementById('customFpsField').style.display = s.fps === 'custom' ? '' : 'none';
  document.getElementById('maxrateField').style.display = s.bitrateMode === 'vbr' ? '' : 'none';
  document.getElementById('bufsizeField').style.display = s.bitrateMode === 'vbr' ? '' : 'none';
  document.getElementById('bitrate-label').textContent = s.bitrateMode === 'crf' ? 'CRF Value (0–51)' : 'Target Bitrate';
  const isHls = s.outputFormat === 'hls';
  document.getElementById('hlsTimeField').style.display = isHls ? '' : 'none';
  document.getElementById('hlsListField').style.display = isHls ? '' : 'none';
  document.getElementById('hlsFlagsField').style.display = isHls ? '' : 'none';
  document.getElementById('hlsSegmentTypeField').style.display = isHls ? '' : 'none';
  const isMpegts = s.outputFormat === 'mpegts';
  document.getElementById('mpegtsSectionFields').style.display = isMpegts ? '' : 'none';
  document.getElementById('logo-field').style.display = s.logoPath ? '' : 'none';

  // Input type toggles
  const t = s.inputType;
  const showRe = (t === 'file' || t === 'http');
  const showLoop = (t === 'file');
  document.getElementById('field-re').style.display = showRe ? '' : 'none';
  document.getElementById('field-loop').style.display = showLoop ? '' : 'none';
}

// ─── Variables (WHERE Block) ─────────────────────────────────────────────────
let varIdCounter = 0;

function addVariable(name, label, description, command, defaultVal, position) {
  const v = {
    id: ++varIdCounter,
    name: name || '',
    label: label || '',
    description: description || '',
    command: command || '-${name} $value',
    defaultVal: defaultVal || '',
    position: position || 'post-input'
  };
  state.variables.push(v);
  renderVariables();
  rebuild();
}

function removeVariable(id) {
  state.variables = state.variables.filter(v => v.id !== id);
  renderVariables();
  rebuild();
}

function updateVariable(id, field, value) {
  const v = state.variables.find(v => v.id === id);
  if (v) v[field] = value;
  rebuild();
}

function renderVariables() {
  const list = document.getElementById('var-list');
  const empty = document.getElementById('var-empty');
  if (state.variables.length === 0) {
    empty.style.display = '';
    list.querySelectorAll('.var-item').forEach(el => el.remove());
    return;
  }
  empty.style.display = 'none';
  // Remove existing items
  list.querySelectorAll('.var-item').forEach(el => el.remove());
  state.variables.forEach(v => {
    const item = document.createElement('div');
    item.className = 'var-item';
    item.innerHTML = `
      <div class="field">
        <div class="field-label">Variable Name</div>
        <input type="text" value="${esc(v.name)}" placeholder="gpu" oninput="updateVariable(${v.id},'name',this.value)">
      </div>
      <div class="field">
        <div class="field-label">Label</div>
        <input type="text" value="${esc(v.label)}" placeholder="GPU Index" oninput="updateVariable(${v.id},'label',this.value)">
      </div>
      <div class="field">
        <div class="field-label">Command Template</div>
        <input type="text" value="${esc(v.command)}" placeholder="-gpu $value" oninput="updateVariable(${v.id},'command',this.value)">
      </div>
      <div class="field">
        <div class="field-label">Position</div>
        <select onchange="updateVariable(${v.id},'position',this.value)">
          <option value="post-input"${v.position !== 'pre-input' ? ' selected' : ''}>Post-input (output)</option>
          <option value="pre-input"${v.position === 'pre-input' ? ' selected' : ''}>Pre-input (before -i)</option>
        </select>
      </div>
      <div style="display:flex;align-items:end;padding-bottom:2px">
        <button class="btn-danger-sm" onclick="removeVariable(${v.id})">✕</button>
      </div>
      <div class="field" style="grid-column:1/-1">
        <div class="field-label">Description</div>
        <input type="text" value="${esc(v.description)}" placeholder="Description shown to user" oninput="updateVariable(${v.id},'description',this.value)">
      </div>
      <div class="field" style="grid-column:1/-1">
        <div class="field-label">Default Value</div>
        <input type="text" value="${esc(v.defaultVal)}" placeholder="" oninput="updateVariable(${v.id},'defaultVal',this.value)">
      </div>
    `;
    list.appendChild(item);
  });
}

function esc(s) { return (s||'').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

// ─── Build Command ────────────────────────────────────────────────────────────
function getFrameSize(s) {
  if (s.frameSize === 'custom') return s.customFrameSize || '';
  return s.frameSize;
}
function getFps(s) {
  if (s.fps === 'custom') return s.customFps || '';
  return s.fps;
}

function buildCommand(s) {
  const p = ['ffmpeg', '-y', '-hide_banner'];

  // Split variables by position
  const preVars = (s.variables || []).filter(v => v.name && v.command && v.position === 'pre-input');
  const postVars = (s.variables || []).filter(v => v.name && v.command && v.position !== 'pre-input');

  // Pre-input options
  const _isGpuCodec = s.videoCodec && (s.videoCodec.includes('nvenc') || s.videoCodec.includes('vaapi') || s.videoCodec.includes('qsv'));
  const _isNvenc = s.videoCodec && s.videoCodec.includes('nvenc');
  // GPU decode pipeline: -hwaccel → -hwaccel_output_format → -c:v (decoder) → -gpu
  if (s.hwaccel && s.hwaccel !== 'none' && _isGpuCodec && s.videoEnabled && s.videoCodec !== 'copy' && s.videoCodec !== 'disabled') p.push('-hwaccel', s.hwaccel);
  if (s.hwaccelOutputFormat && s.hwaccelOutputFormat !== 'none' && _isGpuCodec && s.videoEnabled && s.videoCodec !== 'copy' && s.videoCodec !== 'disabled') p.push('-hwaccel_output_format', s.hwaccelOutputFormat);
  // NVDEC decoder deinterlace (-deint 0=weave, 1=bob, 2=adaptive)
  if (s.nvdecDeint !== '' && s.nvdecDeint !== undefined && _isNvenc && s.videoEnabled && s.videoCodec !== 'copy' && s.videoCodec !== 'disabled') p.push('-deint', s.nvdecDeint);
  // Input decoder codec (e.g. -c:v h264_cuvid for hardware-accelerated decode)
  if (s.inputDecoderCodec) p.push('-c:v', s.inputDecoderCodec);
  if (s.gpuIndex !== '' && s.gpuIndex !== undefined && _isNvenc && s.videoEnabled) p.push('-gpu', s.gpuIndex);
  if (s.re) p.push('-re');
  if (s.loop) p.push('-stream_loop', '-1');
  if (s.fflags && s.fflags.length) p.push('-fflags', s.fflags.join(''));
  if (s.wallclock) p.push('-use_wallclock_as_timestamps', '1');
  if (s.analyzeduration) p.push('-analyzeduration', s.analyzeduration);
  if (s.probesize) p.push('-probesize', s.probesize);
  if (s.timeout) p.push('-timeout', s.timeout);
  if (s.threadQueueSize) p.push('-thread_queue_size', s.threadQueueSize);

  // Extra pre-input flags (passthrough — unknown flags before -i)
  if (s.passthroughPreInput && s.passthroughPreInput.length)
    p.push(...s.passthroughPreInput);

  // Pre-input variables
  preVars.forEach(v => {
    p.push('${' + v.name + '}');
  });

  // Input
  p.push('-i', '${i}');

  // Logo overlay (second input)
  if (s.logoPath) {
    p.push('-i', s.logoPath);
  }

  // Stream mapping (after all inputs, before codec options)
  if (Array.isArray(s.maps) && s.maps.length) {
    s.maps.forEach(m => { if (m.trim()) p.push('-map', m.trim()); });
  }

  // Video
  if (!s.videoEnabled || s.videoCodec === 'disabled') {
    p.push('-vn');
  } else {
    p.push('-c:v', s.videoCodec);
    if (s.videoCodec !== 'copy') {
      if (s.preset) p.push('-preset', s.preset);
      if (s.vprofile && (s.videoCodec.includes('264') || s.videoCodec.includes('265') || s.videoCodec.includes('nvenc')))
        p.push('-profile:v', s.vprofile);
      const fs = getFrameSize(s);
      if (fs && fs !== 'original') p.push('-s', fs);
      const fps = getFps(s);
      if (fps && fps !== 'original') p.push('-r', fps);

      // GOP settings grouped with frame-rate
      if (s.gop) {
        p.push('-g', s.gop);
        // Only emit -keyint_min when explicitly set; otherwise let FFmpeg use its default
        if (s.keyintMin) p.push('-keyint_min', s.keyintMin);
      }

      // Filters
      const filters = [];
      if (s.deinterlaceFilter) filters.push(s.deinterlaceFilter);
      if (s.logoPath) filters.push('overlay');
      if (filters.length > 0) {
        if (s.logoPath) {
          p.push('-filter_complex', filters.join(','));
        } else {
          p.push('-filter:v', filters.join(','));
        }
      }

      if (s.forcedIdr) p.push('-forced-idr', '1');

      // Bitrate
      if (s.bitrateMode === 'cbr' && s.bitrate) {
        p.push('-b:v', s.bitrate);
        // Enforce strict CBR: set -maxrate equal to -b:v and -bufsize to match
        p.push('-maxrate', s.bitrate);
        p.push('-bufsize', s.bitrate);
      }
      if (s.bitrateMode === 'vbr') {
        if (s.bitrate) p.push('-b:v', s.bitrate);
        if (s.maxrate) p.push('-maxrate', s.maxrate);
        if (s.bufsize) p.push('-bufsize', s.bufsize);
      }
      if (s.bitrateMode === 'crf' && s.bitrate) p.push('-crf', s.bitrate);
      if (s.pixFmt) p.push('-pix_fmt', s.pixFmt);
      if (s.level) p.push('-level:v', s.level);
      if (s.fieldOrder) p.push('-field_order', s.fieldOrder);
      if (s.colorPrimaries) p.push('-color_primaries', s.colorPrimaries);
      if (s.colorTrc) p.push('-color_trc', s.colorTrc);
      if (s.colorspace) p.push('-colorspace', s.colorspace);
      if (s.scThreshold !== '') p.push('-sc_threshold', s.scThreshold);
      if (s.bframes !== '') p.push('-bf', s.bframes);
      if (s.refs !== '') p.push('-refs', s.refs);
      if (s.bsfVideo && s.bsfVideo !== 'none') p.push('-bsf:v', s.bsfVideo);
    }
  }

  // Audio
  if (!s.audioEnabled || s.audioCodec === 'disabled') {
    p.push('-an');
  } else {
    p.push('-c:a', s.audioCodec);
    if (s.audioCodec !== 'copy') {
      if (s.sampleRate && s.sampleRate !== 'original') p.push('-ar', s.sampleRate);
      if (s.channels === 'mono') p.push('-ac', '1');
      else if (s.channels === 'stereo') p.push('-ac', '2');
      else if (s.channels === '5.1') p.push('-ac', '6');
      if (s.audioBitrate && s.audioBitrate !== 'default') p.push('-b:a', s.audioBitrate);
      if (s.dialnorm) p.push('-dialnorm', s.dialnorm);
      if (s.bsfAudio && s.bsfAudio !== 'none') p.push('-bsf:a', s.bsfAudio);
    }
  }

  // Output format
  p.push('-f', s.outputFormat);

  // HLS options
  if (s.outputFormat === 'hls') {
    if (s.hlsTime) p.push('-hls_time', s.hlsTime);
    if (s.hlsListSize) p.push('-hls_list_size', s.hlsListSize);
    if (s.hlsFlags) p.push('-hls_flags', s.hlsFlags);
    if (s.hlsSegmentType && s.hlsSegmentType !== 'mpegts') p.push('-hls_segment_type', s.hlsSegmentType);
  }

  // MPEG-TS options
  if (s.outputFormat === 'mpegts') {
    if (s.mpegtsServiceId) p.push('-mpegts_service_id', s.mpegtsServiceId);
    if (s.mpegtsPmtStartPid) p.push('-mpegts_pmt_start_pid', s.mpegtsPmtStartPid);
    if (s.mpegtsStartPid) p.push('-mpegts_start_pid', s.mpegtsStartPid);
    if (Array.isArray(s.mpegtsFlags) && s.mpegtsFlags.length) p.push('-mpegts_flags', s.mpegtsFlags.join('+'));
    if (s.pcrPeriod) p.push('-pcr_period', s.pcrPeriod);
  }

  // General output options
  if (s.maxDelay) p.push('-max_delay', s.maxDelay);
  if (s.copyts) p.push('-copyts');
  if (s.avoidNegativeTs) p.push('-avoid_negative_ts', s.avoidNegativeTs);

  // Custom variables inserted into command
  // Pre-input variables are already emitted above (before -i)
  postVars.forEach(v => {
    p.push('${' + v.name + '}');
  });

  // Extra post-input flags (passthrough — unknown flags after -i)
  if (s.passthroughPostInput && s.passthroughPostInput.length)
    p.push(...s.passthroughPostInput);

  p.push('${o}');
  return p.join(' ');
}

function buildWhereBlock(variables) {
  if (!variables || variables.length === 0) return '';
  const items = variables.filter(v => v.name).map(v => {
    const item = {
      desc: v.name,
      data: {
        name: v.label || v.name,
        description: v.description || '',
        command: v.command || '',
        default: v.defaultVal || ''
      }
    };
    if (v.position === 'pre-input') item.data.position = 'pre-input';
    return item;
  });
  if (items.length === 0) return '';
  return 'WHERE\n' + JSON.stringify(items, null, 2);
}

function buildCommandOnly(s) {
  let out = buildCommand(s);
  const where = buildWhereBlock(s.variables);
  if (where) out += '\n\n' + where;
  return out;
}

function buildProfile(s) {
  let out = buildCommand(s);
  const where = buildWhereBlock(s.variables);
  if (where) out += '\n\n' + where;
  return out;
}

// ─── Syntax Highlight ────────────────────────────────────────────────────────
function highlightProfile(text) {
  const lines = text.split('\n');
  let html = '';
  let inWhere = false;
  for (const line of lines) {
    if (inWhere || line.trim().startsWith('[') || line.trim().startsWith('{')) {
      html += escHtml(line) + '\n';
      continue;
    }
    if (line.startsWith('WHERE')) {
      html += '<span class="kw">WHERE</span>\n';
      inWhere = true;
      continue;
    }
    html += highlightCommand(line) + '\n';
  }
  return html;
}

function highlightCommand(line) {
  const tokens = line.match(/"[^"]*"|\S+/g) || [];
  let result = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'ffmpeg') {
      result += '<span class="kw">ffmpeg</span> ';
    } else if (t.startsWith('${')) {
      result += '<span class="var">' + escHtml(t) + '</span> ';
    } else if (t.startsWith('-')) {
      result += '<span class="flag">' + escHtml(t) + '</span> ';
    } else {
      result += '<span class="val">' + escHtml(t) + '</span> ';
    }
  }
  return result.trim();
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── fflint State Adapter ────────────────────────────────────────────────────
function buildFflintState(s) {
  const f = {
    inputType:    s.inputType,
    outputFormat: s.outputFormat,
  };

  if (s.re)   f.re = true;
  if (s.loop) f.streamLoop = true;

  // ── Input ──────────────────────────────────────────────────────────────────
  if (Array.isArray(s.fflags) && s.fflags.length) f.fflags = s.fflags;
  if (s.wallclock) f.useWallclock = true;
  if (s.maxDelay) { const n = parseInt(s.maxDelay, 10); if (!isNaN(n)) f.maxDelay = n; }
  if (s.timeout) { const n = parseInt(s.timeout, 10); if (!isNaN(n)) f.timeout = n; }
  if (s.threadQueueSize) { const n = parseInt(s.threadQueueSize, 10); if (!isNaN(n)) f.threadQueueSize = n; }
  if (s.analyzeduration) { const n = parseInt(s.analyzeduration, 10); if (!isNaN(n)) f.analyzeDuration = n; }
  if (s.probesize) { const n = parseInt(s.probesize, 10); if (!isNaN(n)) f.probeSize = n; }
  if (s.copyts) f.copyts = true;
  if (Array.isArray(s.maps) && s.maps.length) f.maps = s.maps;

  // ── Video ──────────────────────────────────────────────────────────────────
  if (!s.videoEnabled) {
    f.videoCodec = 'disabled';
  } else {
    f.videoCodec = s.videoCodec;
    if (s.videoCodec !== 'copy' && s.videoCodec !== 'disabled') {
      if (s.hwaccel && s.hwaccel !== 'none') f.hwaccel = s.hwaccel;
      if (s.hwaccelOutputFormat && s.hwaccelOutputFormat !== 'none') f.hwaccelOutputFormat = s.hwaccelOutputFormat;
      if (s.gpuIndex !== '' && s.gpuIndex !== undefined) {
        const n = parseInt(s.gpuIndex, 10); if (!isNaN(n)) f.gpuIndex = n;
      }
      if (s.preset)   f.preset   = s.preset;
      if (s.vprofile) f.profile  = s.vprofile;
      if (s.frameSize !== 'original') f.frameSize = s.frameSize;
      if (s.frameSize === 'custom' && s.customFrameSize) f.customFrameSize = s.customFrameSize;
      if (s.fps !== 'original') f.fps = s.fps;
      if (s.fps === 'custom' && s.customFps) f.customFps = s.customFps;
      if (s.gop) {
        const gopInt = parseInt(s.gop, 10);
        if (!isNaN(gopInt)) f.gop = gopInt;
      }
      if (s.deinterlaceFilter) f.deinterlaceFilter = s.deinterlaceFilter;
      if (s.nvdecDeint !== '' && s.nvdecDeint !== undefined) {
        const n = parseInt(s.nvdecDeint, 10); if (!isNaN(n)) f.nvdecDeint = n;
      }
      if (s.bitrateMode === 'crf') {
        const crf = parseFloat(s.bitrate);
        if (!isNaN(crf)) f.crfValue = crf;
      } else {
        if (s.bitrate) f.targetBitrate = s.bitrate;
      }
      if (s.bitrateMode === 'vbr') {
        if (s.maxrate) f.maxrate = s.maxrate;
        if (s.bufsize) f.bufsize = s.bufsize;
      }
      if (s.pixFmt) f.pixFmt = s.pixFmt;
      if (s.fieldOrder) f.fieldOrder = s.fieldOrder;
      if (s.colorPrimaries) f.colorPrimaries = s.colorPrimaries;
      if (s.colorTrc) f.colorTrc = s.colorTrc;
      if (s.colorspace) f.colorspace = s.colorspace;
      if (s.scThreshold !== '' && s.scThreshold !== undefined) {
        const n = parseInt(s.scThreshold, 10); f.scThreshold = isNaN(n) ? s.scThreshold : n;
      }
      if (s.bframes !== '' && s.bframes !== undefined) {
        const n = parseInt(s.bframes, 10); f.bframes = isNaN(n) ? s.bframes : n;
      }
      if (s.refs !== '' && s.refs !== undefined) {
        const n = parseInt(s.refs, 10); f.refs = isNaN(n) ? s.refs : n;
      }
      if (s.bsfVideo && s.bsfVideo !== 'none') f.bsfVideo = s.bsfVideo;
    }
  }

  if (s.logoPath) f.logoPath = s.logoPath;

  // ── Audio ──────────────────────────────────────────────────────────────────
  if (!s.audioEnabled) {
    f.audioCodec = 'disabled';
  } else {
    f.audioCodec = s.audioCodec;
    if (s.audioCodec !== 'copy' && s.audioCodec !== 'disabled') {
      if (s.sampleRate !== 'original') f.sampleRate = s.sampleRate;
      if (s.channels !== 'original') {
        const chMap = { 'mono': '1', 'stereo': '2', '5.1': '6' };
        f.channels = chMap[s.channels] || s.channels;
      }
      if (s.audioBitrate && s.audioBitrate !== 'default') f.audioBitrate = s.audioBitrate;
      if (s.dialnorm !== '' && s.dialnorm !== undefined) {
        const n = parseInt(s.dialnorm, 10); if (!isNaN(n)) f.dialnorm = n;
      }
      if (s.bsfAudio && s.bsfAudio !== 'none') f.bsfAudio = s.bsfAudio;
    }
  }

  // ── HLS ────────────────────────────────────────────────────────────────────
  if (s.outputFormat === 'hls') {
    if (s.hlsTime) {
      const t = parseInt(s.hlsTime, 10);
      if (!isNaN(t)) f.hlsTime = t;
    }
    if (s.hlsListSize) {
      const ls = parseInt(s.hlsListSize, 10);
      if (!isNaN(ls)) f.hlsListSize = ls;
    }
    if (s.hlsFlags) f.hlsFlags = s.hlsFlags.split(',').map(x => x.trim()).filter(Boolean);
  }

  if (s.hlsSegmentType) f.hlsSegmentType = s.hlsSegmentType;
  if (s.avoidNegativeTs) f.avoidNegativeTs = s.avoidNegativeTs;

  // ── MPEG-TS ────────────────────────────────────────────────────────────────
  if (s.outputFormat === 'mpegts') {
    if (s.mpegtsServiceId) {
      const n = parseInt(s.mpegtsServiceId, 10); if (!isNaN(n)) f.mpegtsServiceId = n;
    }
    if (s.mpegtsPmtStartPid) {
      const n = parseInt(s.mpegtsPmtStartPid, 16) || parseInt(s.mpegtsPmtStartPid, 10);
      if (!isNaN(n)) f.mpegtsPmtStartPid = n;
    }
    if (s.mpegtsStartPid) {
      const n = parseInt(s.mpegtsStartPid, 16) || parseInt(s.mpegtsStartPid, 10);
      if (!isNaN(n)) f.mpegtsStartPid = n;
    }
    if (Array.isArray(s.mpegtsFlags) && s.mpegtsFlags.length) f.mpegtsFlags = s.mpegtsFlags;
    if (s.pcrPeriod) { const n = parseInt(s.pcrPeriod, 10); if (!isNaN(n)) f.pcrPeriod = n; }
  }

  return f;
}

// ─── Known FFmpeg Flags ──────────────────────────────────────────────────────
const KNOWN_FLAGS = new Set([
  'ffmpeg', '-y', '-hide_banner', '-re', '-stream_loop', '-hwaccel', '-hwaccel_output_format',
  '-fflags', '-use_wallclock_as_timestamps', '-max_delay', '-timeout', '-thread_queue_size',
  '-analyzeduration', '-probesize', '-deint', '-copyts',
  '-i', '-map', '-gpu', '-c:v', '-vn', '-preset', '-profile:v', '-s', '-r',
  '-g', '-keyint_min', '-sc_threshold', '-b:v', '-crf', '-maxrate', '-bufsize',
  '-pix_fmt', '-level:v', '-bf', '-refs', '-field_order',
  '-color_primaries', '-color_trc', '-colorspace',
  '-bsf:v', '-filter:v', '-filter_complex', '-forced-idr',
  '-c:a', '-an', '-ar', '-ac', '-b:a', '-dialnorm', '-bsf:a',
  '-f', '-hls_time', '-hls_list_size', '-hls_flags', '-hls_segment_type',
  '-avoid_negative_ts', '-mpegts_service_id', '-mpegts_pmt_start_pid',
  '-mpegts_start_pid', '-mpegts_flags', '-pcr_period',
]);

// Flags that consume the next token as a value
const FLAGS_WITH_VALUE = new Set([
  '-stream_loop', '-hwaccel', '-hwaccel_output_format', '-gpu', '-fflags', '-use_wallclock_as_timestamps', '-max_delay', '-timeout', '-thread_queue_size',
  '-analyzeduration', '-probesize', '-deint',
  '-i', '-map', '-c:v', '-preset', '-profile:v',
  '-s', '-r', '-g', '-keyint_min', '-sc_threshold', '-b:v', '-crf', '-maxrate', '-bufsize',
  '-pix_fmt', '-level:v', '-bf', '-refs', '-field_order',
  '-color_primaries', '-color_trc', '-colorspace', '-bsf:v',
  '-filter:v', '-filter_complex', '-forced-idr',
  '-c:a', '-ar', '-ac', '-b:a', '-dialnorm', '-bsf:a',
  '-f', '-hls_time', '-hls_list_size', '-hls_flags', '-hls_segment_type',
  '-avoid_negative_ts', '-mpegts_service_id', '-mpegts_pmt_start_pid',
  '-mpegts_start_pid', '-mpegts_flags', '-pcr_period',
]);

// ─── Validate (powered by fflint) ────────────────────────────────────────────
function validate(s) {
  const errors = [], warnings = [], infos = [];

  // ── Layer 1 / 2 / 3 via fflint ────────────────────────────────────────────
  const fflintState = buildFflintState(s);
  const results = fflintValidate(fflintState, { broadcastRules: true });

  for (const r of results) {
    const flagBadge = r.flag ? ' <code>' + r.flag + '</code>' : '';
    const msg = r.message + flagBadge;
    if      (r.severity === 'error')   errors.push('⛔ ' + msg);
    else if (r.severity === 'warning') warnings.push('⚠️ ' + msg);
    else                               infos.push('ℹ️ ' + msg);
    if (r.hint) infos.push('💡 ' + r.hint);
  }

  // ── Constructor-specific checks (not covered by fflint) ───────────────────

  // Logo overlay reminder
  if (s.logoPath && s.videoEnabled && s.videoCodec !== 'copy')
    infos.push('ℹ️ Logo overlay enabled — make sure the logo file exists on the server.');

  // HLS parameters summary
  if (s.outputFormat === 'hls')
    infos.push('ℹ️ HLS output: segment duration=' + (s.hlsTime || 4) + 's, playlist size=' + (s.hlsListSize || 5) + '.');

  // Both streams disabled
  if (!s.videoEnabled && !s.audioEnabled)
    warnings.push('⚠️ Both video and audio are disabled. The output will contain no media streams.');

  // Variable naming checks
  const badVars = s.variables.filter(v => !v.name);
  if (badVars.length > 0)
    warnings.push('⚠️ ' + badVars.length + ' variable(s) have no name and will be ignored in the command.');
  const varNames = s.variables.filter(v => v.name).map(v => v.name);
  const dupes = varNames.filter((n, i) => varNames.indexOf(n) !== i);
  if (dupes.length > 0)
    warnings.push('⚠️ Duplicate variable name(s): ' + [...new Set(dupes)].join(', '));

  // Passthrough (custom) flags — preserved verbatim
  const preFlags  = (s.passthroughPreInput  || []).filter(t => t.startsWith('-'));
  const postFlags = (s.passthroughPostInput || []).filter(t => t.startsWith('-'));
  if (preFlags.length > 0)
    infos.push('ℹ️ Extra input flags preserved: <code>' + preFlags.join(' ') + '</code>');
  if (postFlags.length > 0)
    infos.push('ℹ️ Extra output flags preserved: <code>' + postFlags.join(' ') + '</code>');

  return { errors, warnings, infos };
}

// ─── Manual Editor Validation ────────────────────────────────────────────────
function validateManualText(rawText) {
  const errors = [];
  if (!rawText) { errors.push('⛔ Command is empty.'); return errors; }

  // ${i} and ${o} presence
  if (!rawText.includes('${i}'))
    errors.push('⛔ Missing ${i} placeholder — input will not be substituted by Senta.');
  if (!rawText.includes('${o}'))
    errors.push('⛔ Missing ${o} placeholder — output will not be substituted by Senta.');

  // Parse and check for issues
  const tokens = rawText.match(/"[^"]*"|\S+/g) || [];
  const seenFlags = {};
  const unknownFlags = [];
  const repeatableFlags = new Set(['-map', '-i', '-filter_complex', '-filter:v']);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // Skip non-flag tokens and ${} variable placeholders
    if (!t.startsWith('-') || t.startsWith('${')) continue;
    // Skip negative numbers (e.g. -1 as value)
    if (/^-\d+(\.\d+)?$/.test(t)) continue;

    if (!KNOWN_FLAGS.has(t)) {
      unknownFlags.push(t);
    }

    if (!repeatableFlags.has(t)) {
      if (seenFlags[t]) {
        errors.push('⛔ Duplicate flag: ' + t + ' appears more than once.');
      }
      seenFlags[t] = true;
    }
  }

  // Conflicting flags
  if (seenFlags['-vn'] && seenFlags['-c:v'])
    errors.push('⛔ Conflicting: -vn (no video) and -c:v (video codec) are both present.');
  if (seenFlags['-an'] && seenFlags['-c:a'])
    errors.push('⛔ Conflicting: -an (no audio) and -c:a (audio codec) are both present.');
  if (seenFlags['-crf'] && seenFlags['-b:v'])
    errors.push('⛔ Conflicting: -crf and -b:v should not both be present. Use one bitrate mode.');

  // Unknown flags as warnings (don't block save, but inform)
  if (unknownFlags.length > 0) {
    // These are warnings — we return them separately
    // For now, just flag to user but don't block
  }

  return errors;
}

function getManualWarnings(rawText) {
  const warnings = [];
  if (!rawText) return warnings;
  const tokens = rawText.match(/"[^"]*"|\S+/g) || [];
  const unknownFlags = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.startsWith('-') || t.startsWith('${')) continue;
    if (/^-\d+(\.\d+)?$/.test(t)) continue;
    if (!KNOWN_FLAGS.has(t)) unknownFlags.push(t);
  }
  if (unknownFlags.length > 0)
    warnings.push('⚠️ Unrecognized flag(s): ' + unknownFlags.join(', ') + ' — these will be preserved in the Extra Flags section when parsed to Constructor.');

  // Flag ordering check
  let foundInput = false, foundOutput = false;
  const PRE_INPUT_FLAGS = new Set([
    '-hwaccel', '-hwaccel_output_format', '-re', '-stream_loop', '-fflags',
    '-use_wallclock_as_timestamps', '-analyzeduration', '-probesize',
    '-timeout', '-thread_queue_size', '-deint',
  ]);
  const POST_INPUT_FLAGS = new Set([
    '-c:v', '-preset', '-profile:v', '-b:v', '-crf', '-maxrate', '-bufsize',
    '-f', '-c:a', '-b:a', '-map',
  ]);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '-i') foundInput = true;
    if (t === '-f') foundOutput = true;
    // Global/input flags after -i
    if (foundInput && PRE_INPUT_FLAGS.has(t))
      warnings.push('⚠️ Flag ' + t + ' should appear before -i (input). Current position may cause unexpected behavior.');
    // Output flags before -i
    if (!foundInput && POST_INPUT_FLAGS.has(t) && t !== '-c:v')  // -c:v before -i is valid (decoder)
      warnings.push('⚠️ Flag ' + t + ' is an output option and should appear after -i.');
  }
  return warnings;
}
// ─── Rebuild ─────────────────────────────────────────────────────────────────
let rebuildTimer = null;
function rebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(doRebuild, 30);
}

function doRebuild() {
  syncFromForm();
  applyDisabledStates();

  const profile = buildProfile(state);
  document.getElementById('preview-code').innerHTML = highlightProfile(profile);
  const manualName = document.getElementById('manual-name');
  if (manualName && document.activeElement !== manualName) manualName.value = state.name;
  const manualTA = document.getElementById('manual-textarea');
  if (manualTA && document.activeElement !== manualTA) manualTA.value = buildCommandOnly(state);

  const { errors, warnings, infos } = validate(state);
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  document.getElementById('save-btn').disabled = hasErrors;

  const alertsArea = document.getElementById('alerts-area');
  alertsArea.innerHTML = '';
  errors.forEach(e => alertsArea.innerHTML += `<div class="alert alert-error">${e}</div>`);
  warnings.forEach(w => alertsArea.innerHTML += `<div class="alert alert-warn">${w}</div>`);
  infos.forEach(i => alertsArea.innerHTML += `<div class="alert alert-info">${i}</div>`);
}

// ─── Codec changes ────────────────────────────────────────────────────────────
function onCodecChange() {
  syncFromForm();
  const codec = state.videoCodec;

  // Map 'disabled' to videoEnabled
  state.videoEnabled = (codec !== 'disabled');

  // Show encoding options only for non-copy, non-disabled codecs
  const showOpts = (codec !== 'disabled' && codec !== 'copy');
  document.getElementById('videoOptionsBlock').style.display = showOpts ? '' : 'none';

  // Auto-match HW accel
  if (codec.includes('nvenc')) {
    document.getElementById('f-hwaccel').value = 'cuda';
    state.hwaccel = 'cuda';
  } else if (codec.includes('vaapi')) {
    document.getElementById('f-hwaccel').value = 'vaapi';
    state.hwaccel = 'vaapi';
  }
  applyDisabledStates();
  rebuild();
}
function onAudioCodecChange() {
  syncFromForm();
  const codec = state.audioCodec;

  // Map 'disabled' to audioEnabled
  state.audioEnabled = (codec !== 'disabled');

  // Show encoding options only for non-copy, non-disabled codecs
  const showOpts = (codec !== 'disabled' && codec !== 'copy');
  document.getElementById('audioOptionsBlock').style.display = showOpts ? '' : 'none';

  applyDisabledStates();
  rebuild();
}

// ─── Tab switch ──────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('panel-constructor').classList.toggle('hidden', tab !== 'constructor');
  document.getElementById('panel-manual').classList.toggle('hidden', tab !== 'manual');
  document.getElementById('tab-constructor').classList.toggle('active', tab === 'constructor');
  document.getElementById('tab-manual').classList.toggle('active', tab === 'manual');
  if (tab === 'manual') {
    document.getElementById('manual-name').value = state.name;
    document.getElementById('manual-textarea').value = buildCommandOnly(state);
  }
}

// ─── Copy ────────────────────────────────────────────────────────────────────
function copyCommand() {
  const text = document.getElementById('preview-code').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = '✓ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy', 2000);
  });
}

// showSaved replaced by showSavedFeedback() and saveCurrentProfile() above

// ─── Command Parser (reverse) ─────────────────────────────────────────────────
function parseFFmpegCommand(str) {
  const result = {
    name: '', inputType: 'udp', logoPath: '',
    re: false, loop: false, wallclock: false, fflags: [], maxDelay: '', timeout: '', threadQueueSize: '',
    analyzeduration: '', probesize: '', copyts: false,
    videoEnabled: true, videoCodec: 'copy', hwaccel: 'none', hwaccelOutputFormat: 'none', inputDecoderCodec: '', gpuIndex: '',
    preset: '', vprofile: '', frameSize: 'original', customFrameSize: '',
    fps: 'original', customFps: '',
    gop: '', bitrateMode: 'cbr', bitrate: '', maxrate: '', bufsize: '',
    deinterlaceFilter: '', nvdecDeint: '', forcedIdr: false,
    pixFmt: '', level: '', scThreshold: '', bframes: '', refs: '', bsfVideo: 'none',
    fieldOrder: '', colorPrimaries: '', colorTrc: '', colorspace: '',
    audioEnabled: true, audioCodec: 'copy',
    sampleRate: 'original', channels: 'original', audioBitrate: 'default',
    dialnorm: '', bsfAudio: 'none',
    outputFormat: 'mpegts',
    hlsTime: '4', hlsListSize: '5', hlsFlags: '', hlsSegmentType: 'mpegts',
    avoidNegativeTs: '',
    mpegtsServiceId: '', mpegtsPmtStartPid: '', mpegtsStartPid: '',
    mpegtsFlags: [], pcrPeriod: '',
    maps: [],
    variables: [],
    keyintMin: '',
    passthroughPreInput: [],
    passthroughPostInput: []
  };

  const lines = str.trim().split('\n');
  let cmdLine = '';
  let whereStr = '';
  let inWhere = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('NAME ')) {
      const m = trimmed.match(/^NAME\s+"(.+)"$/);
      if (m) result.name = m[1];
    } else if (trimmed === 'WHERE') {
      inWhere = true;
    } else if (inWhere) {
      whereStr += trimmed;
    } else if (trimmed.startsWith('ffmpeg') || trimmed.startsWith('-') || cmdLine) {
      cmdLine += (cmdLine ? ' ' : '') + trimmed;
    }
  }

  if (whereStr) {
    try {
      const items = JSON.parse(whereStr);
      result.variables = items.map(item => ({
        id: ++varIdCounter,
        name: item.desc || '',
        label: (item.data && item.data.name) || '',
        description: (item.data && item.data.description) || '',
        command: (item.data && item.data.command) || '',
        defaultVal: (item.data && item.data.default) || '',
        position: (item.data && item.data.position) || 'post-input'
      }));
    } catch(e) { /* ignore parse errors */ }
  }

  const tokens = cmdLine.match(/"[^"]*"|\S+/g) || [];
  const inputs = [];
  let i = 0;
  let passedInput = false;

  while (i < tokens.length) {
    const t = tokens[i];
    switch (t) {
      case 'ffmpeg': break;
      case '-y': break;
      case '-hide_banner': break;
      case '-re': result.re = true; break;
      case '-stream_loop': i++; result.loop = true; break;
      case '-hwaccel': i++; result.hwaccel = tokens[i] || 'none'; break;
      case '-hwaccel_output_format': i++; result.hwaccelOutputFormat = tokens[i] || 'none'; break;
      case '-deint': i++; result.nvdecDeint = tokens[i] || ''; break;
      case '-gpu': i++; result.gpuIndex = tokens[i] || ''; break;
      case '-i': i++; inputs.push(tokens[i] || ''); passedInput = true; break;
      case '-c:v': i++; if (!passedInput) { result.inputDecoderCodec = tokens[i] || ''; } else { result.videoCodec = tokens[i] || 'copy'; } break;
      case '-vn': result.videoEnabled = false; result.videoCodec = 'disabled'; break;
      case '-preset': i++; result.preset = tokens[i] || ''; break;
      case '-profile:v': i++; result.vprofile = tokens[i] || ''; break;
      case '-s': {
        i++;
        const size = tokens[i] || '';
        const knownSizes = ['1920x1080','1280x720','720x576','720x480'];
        if (knownSizes.includes(size)) result.frameSize = size;
        else { result.frameSize = 'custom'; result.customFrameSize = size; }
        break;
      }
      case '-r': {
        i++;
        const fps = tokens[i] || '';
        const knownFps = ['25','29.97','30','50','59.94','60'];
        if (knownFps.includes(fps)) result.fps = fps;
        else { result.fps = 'custom'; result.customFps = fps; }
        break;
      }
      case '-g': i++; result.gop = tokens[i] || ''; break;
      case '-keyint_min': i++; result.keyintMin = tokens[i] || ''; break;
      case '-b:v': i++; result.bitrate = tokens[i] || ''; break;
      case '-crf': i++; result.bitrateMode = 'crf'; result.bitrate = tokens[i] || ''; break;
      case '-maxrate': i++; result.maxrate = tokens[i] || ''; break;
      case '-bufsize': i++; result.bufsize = tokens[i] || ''; break;
      case '-filter:v': i++; { const _fv = tokens[i] || ''; const _m = _fv.match(/\b(yadif_cuda|bwdif_cuda|yadif|bwdif)\b/); if (_m) result.deinterlaceFilter = _m[1]; } break;
      case '-filter_complex': i++; { const _fv = tokens[i] || ''; const _m = _fv.match(/\b(yadif_cuda|bwdif_cuda|yadif|bwdif)\b/); if (_m) result.deinterlaceFilter = _m[1]; } break;
      case '-forced-idr': i++; result.forcedIdr = tokens[i] === '1'; break;
      case '-c:a': i++; result.audioCodec = tokens[i] || 'copy'; break;
      case '-an': result.audioEnabled = false; result.audioCodec = 'disabled'; break;
      case '-ar': i++; result.sampleRate = tokens[i] || 'original'; break;
      case '-ac': {
        i++;
        const ch = tokens[i] || '';
        if (ch === '1') result.channels = 'mono';
        else if (ch === '2') result.channels = 'stereo';
        else if (ch === '6') result.channels = '5.1';
        break;
      }
      case '-b:a': i++; result.audioBitrate = tokens[i] || 'default'; break;
      case '-f': i++; result.outputFormat = tokens[i] || 'mpegts'; break;
      case '-hls_time': i++; result.hlsTime = tokens[i] || '4'; break;
      case '-hls_list_size': i++; result.hlsListSize = tokens[i] || '5'; break;
      case '-hls_flags': i++; result.hlsFlags = tokens[i] || ''; break;
      case '-hls_segment_type': i++; result.hlsSegmentType = tokens[i] || 'mpegts'; break;
      case '-fflags': i++; result.fflags = (tokens[i] || '').split('+').filter(Boolean).map(f => '+' + f); break;
      case '-use_wallclock_as_timestamps': i++; result.wallclock = tokens[i] === '1'; break;
      case '-max_delay': i++; result.maxDelay = tokens[i] || ''; break;
      case '-timeout': i++; result.timeout = tokens[i] || ''; break;
      case '-thread_queue_size': i++; result.threadQueueSize = tokens[i] || ''; break;
      case '-analyzeduration': i++; result.analyzeduration = tokens[i] || ''; break;
      case '-probesize': i++; result.probesize = tokens[i] || ''; break;
      case '-copyts': result.copyts = true; break;
      case '-map': i++; if (!result.maps) result.maps = []; result.maps.push(tokens[i] || ''); break;
      case '-pix_fmt': i++; result.pixFmt = tokens[i] || ''; break;
      case '-level:v': i++; result.level = tokens[i] || ''; break;
      case '-sc_threshold': i++; result.scThreshold = tokens[i] || ''; break;
      case '-bf': i++; result.bframes = tokens[i] || ''; break;
      case '-refs': i++; result.refs = tokens[i] || ''; break;
      case '-bsf:v': i++; result.bsfVideo = tokens[i] || 'none'; break;
      case '-field_order': i++; result.fieldOrder = tokens[i] || ''; break;
      case '-color_primaries': i++; result.colorPrimaries = tokens[i] || ''; break;
      case '-color_trc': i++; result.colorTrc = tokens[i] || ''; break;
      case '-colorspace': i++; result.colorspace = tokens[i] || ''; break;
      case '-dialnorm': i++; result.dialnorm = tokens[i] || ''; break;
      case '-bsf:a': i++; result.bsfAudio = tokens[i] || 'none'; break;
      case '-avoid_negative_ts': i++; result.avoidNegativeTs = tokens[i] || ''; break;
      case '-mpegts_service_id': i++; result.mpegtsServiceId = tokens[i] || ''; break;
      case '-mpegts_pmt_start_pid': i++; result.mpegtsPmtStartPid = tokens[i] || ''; break;
      case '-mpegts_start_pid': i++; result.mpegtsStartPid = tokens[i] || ''; break;
      case '-mpegts_flags': i++; result.mpegtsFlags = (tokens[i] || '').split('+').filter(Boolean); break;
      case '-pcr_period': i++; result.pcrPeriod = tokens[i] || ''; break;
      default: {
        // Collect unknown flag + optional value into the right passthrough bucket.
        // Only capture real FFmpeg flags (start with '-'). Never capture ${o}, ${i} or
        // Senta variable placeholders - those are structural tokens, not user flags.
        if (t.startsWith('-')) {
          const bucket = passedInput ? result.passthroughPostInput : result.passthroughPreInput;
          bucket.push(t);
          if (i + 1 < tokens.length) {
            const next = tokens[i + 1];
            if (!next.startsWith('-') && !next.startsWith('${')) {
              i++;
              bucket.push(tokens[i]);
            }
          }
        }
        break;
      }
    }
    i++;
  }

  if (inputs.length > 0) {
    const mainInput = inputs[0];
    if (mainInput !== '${i}') {
      if (mainInput.startsWith('udp://')) result.inputType = 'udp';
      else if (mainInput.startsWith('rtp://')) result.inputType = 'rtp';
      else if (mainInput.startsWith('rtmp://')) result.inputType = 'rtmp';
      else if (mainInput.startsWith('http://') || mainInput.startsWith('https://')) result.inputType = 'http';
      else if (mainInput.startsWith('srt://')) result.inputType = 'srt';
      else result.inputType = 'file';
    }
    if (inputs.length > 1) {
      result.logoPath = inputs[1];
    }
  }

  // Determine bitrate mode from parsed flags:
  // -crf already sets bitrateMode='crf' during parsing.
  // If -maxrate is present and differs from -b:v, it's VBR.
  // If -maxrate equals -b:v (our CBR auto pattern), keep CBR.
  if (result.bitrateMode !== 'crf') {
    if (result.maxrate && result.maxrate !== result.bitrate) {
      result.bitrateMode = 'vbr';
    } else {
      result.bitrateMode = 'cbr';
      // Clear maxrate/bufsize for CBR since buildCommand auto-generates them
      if (result.maxrate === result.bitrate) {
        result.maxrate = '';
        result.bufsize = '';
      }
    }
  }

  return result;
}

function parseFromManual() {
  const text = document.getElementById('manual-textarea').value;
  if (!text.trim()) return;
  const parsed = parseFFmpegCommand(text);
  parsed.name = document.getElementById('manual-name').value || parsed.name;
  Object.assign(state, parsed);
  syncToForm(state);
  renderVariables();
  applyDisabledStates();
  doRebuild();
  switchTab('constructor');
}

// ─── Init ────────────────────────────────────────────────────────────────────
loadProfilesStore();
renderProfilesList();
// Start on list view
switchView('list');

// ─── Expose to global scope (required because script is type="module") ────────
Object.assign(window, {
  state,
  startNewProfile, goBackToList, switchTab,
  rebuild, doRebuild, toggleSection, toggleField,
  onInputTypeChange, onOutputFormatChange, onCodecChange,
  onFrameSizeChange, onFpsChange, onBitrateModeChange, onAudioCodecChange,
  addVariable, removeVariable, updateVariable, copyCommand,
  saveCurrentProfile, editProfile, deleteProfile,
  saveFromManual, parseFromManual,
});
