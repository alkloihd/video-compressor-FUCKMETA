/**
 * compression.js - Compression settings panel (quality, codec, format, resolution, estimation)
 */

import { appState } from './app.js';
import { formatBytes } from './filemanager.js';

let currentPreset = 'balanced';
let currentCodec = 'h265';
let currentFormat = 'mp4';
let currentScale = 'original';
let currentCrf = 23;
let currentSpeed = 'medium';
let hwInfo = null;

// Codec -> compatible formats
const CODEC_FORMAT_MAP = {
  h264: ['mp4', 'mov', 'mkv'],
  h265: ['mp4', 'mov', 'mkv'],
  av1: ['mkv', 'mp4'],
  prores: ['mov'],
};

// Default format when switching codec
const CODEC_DEFAULT_FORMAT = {
  h264: 'mp4',
  h265: 'mp4',
  av1: 'mkv',
  prores: 'mov',
};

// Scale option heights
const SCALE_HEIGHTS = {
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
  '360p': 360,
};

// ─── Estimation Tables ────────────────────────────────────────────

// HW encoder target bitrates in kbps
const HW_BITRATES = {
  h264_videotoolbox: { max: 20000, balanced: 8000, small: 4000, streaming: 5000 },
  hevc_videotoolbox: { max: 12000, balanced: 6000, small: 3000, streaming: 4000 },
  prores_videotoolbox: { max: 100000, balanced: 60000, small: 30000 },
};

// SW/CRF encoder size as percentage of original
const SW_RATIOS = {
  libx264: { max: 0.9, balanced: 0.6, small: 0.35, streaming: 0.5 },
  libx265: { max: 0.8, balanced: 0.5, small: 0.25, streaming: 0.4 },
  libsvtav1: { max: 0.7, balanced: 0.4, small: 0.2, streaming: 0.35 },
  prores_ks: { max: 2.0, balanced: 1.2, small: 0.8 },
};

function wireButtonGroup(containerId, dataAttr, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const buttons = container.querySelectorAll('.preset-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.dataset[dataAttr];
      if (!value || btn.classList.contains('disabled')) return;

      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(value);
    });
  });
}

function updateFormatButtons() {
  const container = document.getElementById('format-selector');
  if (!container) return;

  const allowedFormats = CODEC_FORMAT_MAP[currentCodec] || ['mp4'];
  const buttons = container.querySelectorAll('.preset-btn');

  buttons.forEach((btn) => {
    const fmt = btn.dataset.format;
    if (!fmt) return;

    if (allowedFormats.includes(fmt)) {
      btn.classList.remove('disabled');
    } else {
      btn.classList.add('disabled');
      btn.classList.remove('active');
    }
  });

  // If current format is not allowed, switch to default
  if (!allowedFormats.includes(currentFormat)) {
    currentFormat = CODEC_DEFAULT_FORMAT[currentCodec] || allowedFormats[0];
    buttons.forEach((btn) => {
      if (btn.dataset.format === currentFormat) {
        btn.classList.add('active');
      }
    });
  }
}

function updateHWBadge() {
  const badge = document.getElementById('hw-badge');
  const badgeText = document.getElementById('hw-badge-text');
  if (!badge || !badgeText) return;

  if (!hwInfo) {
    badgeText.textContent = 'Hardware detection unavailable';
    badge.classList.add('hw-unavailable');
    badge.classList.remove('hw-available');
    return;
  }

  const hasVideoToolbox =
    hwInfo.h264_videotoolbox || hwInfo.hevc_videotoolbox || hwInfo.prores_videotoolbox;

  if (hasVideoToolbox) {
    badgeText.textContent = 'HW Accel: VideoToolbox';
    badge.classList.add('hw-available');
    badge.classList.remove('hw-unavailable');
  } else {
    badgeText.textContent = 'Software encoding only';
    badge.classList.add('hw-unavailable');
    badge.classList.remove('hw-available');
  }
}

function updateHWIndicators() {
  const codecContainer = document.getElementById('codec-selector');
  if (!codecContainer || !hwInfo) return;

  const buttons = codecContainer.querySelectorAll('.preset-btn');
  buttons.forEach((btn) => {
    const existing = btn.querySelector('.hw-indicator');
    if (existing) existing.remove();

    const codec = btn.dataset.codec;
    if (!codec) return;

    let hasHW = false;
    if (codec === 'h264') hasHW = !!hwInfo.h264_videotoolbox;
    if (codec === 'h265') hasHW = !!hwInfo.hevc_videotoolbox;
    if (codec === 'prores') hasHW = !!hwInfo.prores_videotoolbox;
    if (codec === 'av1') hasHW = false;

    if (hasHW) {
      const indicator = document.createElement('span');
      indicator.className = 'hw-indicator';
      indicator.title = 'Hardware acceleration available';
      btn.appendChild(indicator);
    }
  });
}

function updateSummary() {
  const summaryEl = document.getElementById('compression-summary');
  if (!summaryEl) return;

  const presetNames = {
    balanced: 'Balanced',
    max: 'Max Quality',
    small: 'Small File',
    streaming: 'Streaming',
    custom: 'Custom',
  };

  const codecNames = {
    h264: 'H.264',
    h265: 'H.265',
    av1: 'AV1',
    prores: 'ProRes',
  };

  const scaleName = currentScale === 'original' ? 'Original' : currentScale.toUpperCase();
  let summaryText = `${presetNames[currentPreset] || currentPreset} | ${codecNames[currentCodec] || currentCodec} | ${currentFormat.toUpperCase()} | ${scaleName}`;
  if (currentPreset === 'custom') {
    summaryText += ` | CRF ${currentCrf} | ${currentSpeed}`;
  }
  summaryEl.textContent = summaryText;
}

// ─── Resolution Dropdown ──────────────────────────────────────────

function createResolutionSelector() {
  const summaryEl = document.getElementById('compression-summary');
  if (!summaryEl) return;

  // Create the resolution card, matching other settings cards
  const card = document.createElement('div');
  card.className = 'glass-card p-5 space-y-3';
  card.id = 'resolution-section';

  const heading = document.createElement('h3');
  heading.className = 'text-sm font-semibold themed-heading uppercase tracking-wider';
  heading.textContent = 'Resolution';
  card.appendChild(heading);

  const select = document.createElement('select');
  select.id = 'resolution-select';
  select.className =
    'w-full themed-input border rounded px-3 py-2.5 text-sm focus:outline-none transition-all appearance-none cursor-pointer';

  const options = [
    { value: 'original', label: 'Original' },
    { value: '1080p', label: '1080p (1920x1080)' },
    { value: '720p', label: '720p (1280x720)' },
    { value: '480p', label: '480p (854x480)' },
    { value: '360p', label: '360p (640x360)' },
  ];

  for (const opt of options) {
    const optEl = document.createElement('option');
    optEl.value = opt.value;
    optEl.textContent = opt.label;
    select.appendChild(optEl);
  }

  select.addEventListener('change', () => {
    currentScale = select.value;
    updateSummary();
    updateEstimation();
    updateTradeoffInfo();
  });

  card.appendChild(select);

  // Insert before compression-summary
  summaryEl.parentNode.insertBefore(card, summaryEl);
}

/** Update resolution dropdown options based on selected file's resolution */
export function updateResolutionOptions() {
  const select = document.getElementById('resolution-select');
  if (!select) return;

  const file = getSelectedFile();
  const sourceHeight = file?.probeData?.height || 0;

  const options = select.querySelectorAll('option');
  options.forEach((opt) => {
    if (opt.value === 'original') {
      opt.disabled = false;
      return;
    }
    const targetHeight = SCALE_HEIGHTS[opt.value] || 0;
    // Disable options that would upscale
    opt.disabled = sourceHeight > 0 && targetHeight >= sourceHeight;
  });

  // If current selection would upscale, reset to original
  if (
    currentScale !== 'original' &&
    SCALE_HEIGHTS[currentScale] >= sourceHeight &&
    sourceHeight > 0
  ) {
    currentScale = 'original';
    select.value = 'original';
    updateSummary();
  }

  updateTradeoffInfo();
}

// ─── Estimation Display ───────────────────────────────────────────

function createEstimationDisplay() {
  const summaryEl = document.getElementById('compression-summary');
  if (!summaryEl) return;

  const estimateEl = document.createElement('div');
  estimateEl.id = 'size-estimation';
  estimateEl.className = 'text-center text-sm themed-text-muted py-1';
  estimateEl.textContent = '';

  // Insert after compression-summary
  summaryEl.parentNode.insertBefore(estimateEl, summaryEl.nextSibling);
}

function getSelectedFile() {
  if (!appState.selectedFileId) return null;
  return appState.files.find((f) => f.id === appState.selectedFileId) || null;
}

function getEncoderName(codec) {
  const hwAvailable = isHWAvailableClient(codec);
  switch (codec) {
    case 'h264':
      return hwAvailable ? 'h264_videotoolbox' : 'libx264';
    case 'h265':
      return hwAvailable ? 'hevc_videotoolbox' : 'libx265';
    case 'prores':
      return hwAvailable ? 'prores_videotoolbox' : 'prores_ks';
    case 'av1':
      return 'libsvtav1';
    default:
      return 'libx264';
  }
}

function isHWAvailableClient(codec) {
  if (!hwInfo) return false;
  // hwInfo from server has keys like h264_videotoolbox, hevc_videotoolbox, prores_videotoolbox
  switch (codec) {
    case 'h264':
      return !!hwInfo.h264_videotoolbox;
    case 'h265':
      return !!hwInfo.hevc_videotoolbox;
    case 'prores':
      return !!hwInfo.prores_videotoolbox;
    case 'av1':
      return false;
    default:
      return false;
  }
}

function computeScaledDimensions(origWidth, origHeight, scale) {
  if (scale === 'original' || !SCALE_HEIGHTS[scale]) {
    return { width: origWidth, height: origHeight };
  }
  const targetHeight = SCALE_HEIGHTS[scale];
  if (targetHeight >= origHeight) {
    // Would upscale -- use original
    return { width: origWidth, height: origHeight };
  }
  // Maintain aspect ratio (FFmpeg uses -2 for even dimensions)
  const ratio = targetHeight / origHeight;
  let newWidth = Math.round(origWidth * ratio);
  // Ensure even dimension (matching FFmpeg -2 behavior)
  if (newWidth % 2 !== 0) newWidth += 1;
  return { width: newWidth, height: targetHeight };
}

export function updateEstimation() {
  const estimateEl = document.getElementById('size-estimation');
  if (!estimateEl) return;

  const file = getSelectedFile();
  if (!file || !file.probeData) {
    estimateEl.textContent = '';
    return;
  }

  const probe = file.probeData;
  const originalSize = probe.size || file.size || 0;
  const duration = probe.duration || 0;
  const origWidth = probe.width || 0;
  const origHeight = probe.height || 0;

  if (originalSize === 0 || duration === 0) {
    estimateEl.textContent = '';
    return;
  }

  const encoder = getEncoderName(currentCodec);
  let estimatedSize = 0;

  if (currentPreset === 'custom') {
    // For custom preset, interpolate ratio from CRF value
    // CRF 0 = lossless (~1.5x), CRF 18 = ~0.8x, CRF 23 = ~0.5x, CRF 35 = ~0.2x, CRF 51 = ~0.05x
    let ratio;
    if (currentCrf <= 18) {
      ratio = 1.5 - (currentCrf / 18) * 0.7; // 1.5 down to 0.8
    } else if (currentCrf <= 28) {
      ratio = 0.8 - ((currentCrf - 18) / 10) * 0.5; // 0.8 down to 0.3
    } else {
      ratio = 0.3 - ((currentCrf - 28) / 23) * 0.25; // 0.3 down to 0.05
    }
    ratio = Math.max(ratio, 0.03);
    // Adjust for codec efficiency
    if (currentCodec === 'h265') ratio *= 0.7;
    else if (currentCodec === 'av1') ratio *= 0.55;
    else if (currentCodec === 'prores') ratio *= 2.0;
    estimatedSize = originalSize * ratio;
  } else if (HW_BITRATES[encoder]) {
    // HW encoder: estimate from target bitrate
    const bitrate = HW_BITRATES[encoder][currentPreset];
    if (!bitrate) {
      estimateEl.textContent = '';
      return;
    }
    estimatedSize = ((bitrate * 1000) / 8) * duration;
  } else if (SW_RATIOS[encoder]) {
    // SW/CRF encoder: estimate as percentage of original
    const ratio = SW_RATIOS[encoder][currentPreset];
    if (ratio === undefined) {
      estimateEl.textContent = '';
      return;
    }
    estimatedSize = originalSize * ratio;
  } else {
    estimateEl.textContent = '';
    return;
  }

  // Adjust for resolution scaling
  if (currentScale !== 'original' && origWidth > 0 && origHeight > 0) {
    const scaled = computeScaledDimensions(origWidth, origHeight, currentScale);
    const pixelRatio = (scaled.width * scaled.height) / (origWidth * origHeight);
    estimatedSize *= pixelRatio;
  }

  // Calculate percentage change
  const pctChange = ((estimatedSize - originalSize) / originalSize) * 100;
  const sign = pctChange <= 0 ? '' : '+';
  const pctStr = `${sign}${Math.round(pctChange)}%`;

  estimateEl.textContent = `Estimated output: ~${formatBytes(Math.round(estimatedSize))} (${pctStr})`;

  // Add encoding speed estimate
  let speedNote = '';
  if (currentCodec === 'av1') {
    speedNote = ' | AV1 is slow (~0.5x realtime)';
  } else if (currentScale === 'original' && file.probeData?.height >= 2160) {
    const isHW = isHWAvailableClient(currentCodec);
    speedNote = isHW ? ' | 4K HW encode (~3-5x realtime)' : ' | 4K SW encode (~0.5-1x realtime)';
  }
  if (speedNote) {
    estimateEl.textContent += speedNote;
  }

  // Color based on savings
  if (pctChange <= -20) {
    estimateEl.style.color = 'var(--accent-primary)';
  } else if (pctChange <= 0) {
    estimateEl.style.color = 'var(--text-tertiary)';
  } else {
    estimateEl.style.color = 'var(--accent-warning)';
  }
}

// ─── Custom Panel Toggle ──────────────────────────────────────────

function toggleCustomPanel() {
  const panel = document.getElementById('custom-quality-panel');
  if (!panel) return;

  if (currentPreset === 'custom') {
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

// ─── Tradeoff Information ─────────────────────────────────────────

const CODEC_TRADEOFFS = {
  h264: 'Universal compatibility. Plays everywhere. Moderate compression. Hardware accelerated on this Mac.',
  h265: '~40% smaller than H.264 at same quality. Plays on most modern devices. Hardware accelerated.',
  av1: "~50% smaller than H.264. Best compression but SLOW (software only, no HW accel). Some devices can't play it.",
  prores:
    'Professional editing codec. LARGER files but no quality loss. Best for editing workflows.',
};

const PRESET_TRADEOFFS = {
  max: "Highest quality, largest file. Best when storage isn't a concern. Bitrate: ~20 Mbps (H.264) / ~12 Mbps (H.265)",
  balanced:
    'Good quality/size tradeoff. Suitable for most uses. Bitrate: ~8 Mbps (H.264) / ~6 Mbps (H.265)',
  small:
    'Prioritizes small size. Some quality loss in fast motion scenes. Bitrate: ~4 Mbps (H.264) / ~3 Mbps (H.265)',
  streaming: 'Optimized for web streaming. Fast-start enabled for immediate playback.',
  custom:
    'CRF 18\u201320 = visually lossless, CRF 23 = balanced, CRF 28+ = noticeable quality loss',
};

function updateTradeoffInfo() {
  const content = document.getElementById('tradeoff-content');
  if (!content) return;

  // Clear existing content
  content.textContent = '';

  // --- Codec info ---
  const codecLabel = { h264: 'H.264', h265: 'H.265 (HEVC)', av1: 'AV1', prores: 'ProRes' };
  const codecInfo = CODEC_TRADEOFFS[currentCodec];
  if (codecInfo) {
    const codecBox = document.createElement('div');
    codecBox.style.cssText =
      'padding:0.5rem;border-radius:0.5rem;background:var(--glass-bg);border:1px solid var(--glass-border);';
    const codecTitle = document.createElement('strong');
    codecTitle.style.color = 'var(--text-secondary)';
    codecTitle.textContent = 'Codec: ' + (codecLabel[currentCodec] || currentCodec);
    const codecDesc = document.createElement('p');
    codecDesc.style.margin = '0.25rem 0 0';
    codecDesc.textContent = codecInfo;
    codecBox.appendChild(codecTitle);
    codecBox.appendChild(codecDesc);
    content.appendChild(codecBox);
  }

  // --- Preset info ---
  const presetLabel = {
    max: 'Max Quality',
    balanced: 'Balanced',
    small: 'Small File',
    streaming: 'Streaming',
    custom: 'Custom',
  };
  const presetInfo = PRESET_TRADEOFFS[currentPreset];
  if (presetInfo) {
    let presetDetail = presetInfo;
    if (currentPreset === 'custom') {
      presetDetail = 'CRF ' + currentCrf + ': ';
      if (currentCrf <= 17)
        presetDetail += 'Near-lossless quality. Large file sizes. Best for archival.';
      else if (currentCrf <= 22)
        presetDetail += 'Visually lossless for most content. Excellent quality.';
      else if (currentCrf <= 27)
        presetDetail += 'Balanced quality and size. Minor quality loss in complex scenes.';
      else if (currentCrf <= 34)
        presetDetail += 'Noticeable quality loss. Blocking in dark scenes, banding in gradients.';
      else
        presetDetail +=
          'Heavy compression. Significant quality loss. Blurring and artifacts visible.';
      presetDetail += ' Speed: ' + currentSpeed + ' \u2014 ';
      if (currentSpeed === 'ultrafast' || currentSpeed === 'fast')
        presetDetail += 'Faster encoding, larger file at same CRF.';
      else if (currentSpeed === 'medium')
        presetDetail += 'Good balance of speed and compression efficiency.';
      else presetDetail += 'Slower encoding, better compression (smaller file at same CRF).';
    }
    const presetBox = document.createElement('div');
    presetBox.style.cssText =
      'padding:0.5rem;border-radius:0.5rem;background:var(--glass-bg);border:1px solid var(--glass-border);';
    const presetTitle = document.createElement('strong');
    presetTitle.style.color = 'var(--text-secondary)';
    presetTitle.textContent = 'Preset: ' + (presetLabel[currentPreset] || currentPreset);
    const presetDesc = document.createElement('p');
    presetDesc.style.margin = '0.25rem 0 0';
    presetDesc.textContent = presetDetail;
    presetBox.appendChild(presetTitle);
    presetBox.appendChild(presetDesc);
    content.appendChild(presetBox);
  }

  // --- Resolution info ---
  const file = getSelectedFile();
  if (file && file.probeData && currentScale !== 'original') {
    const origH = file.probeData.height || 0;
    const origW = file.probeData.width || 0;
    const targetH = SCALE_HEIGHTS[currentScale] || 0;
    if (origH > 0 && targetH > 0 && targetH < origH) {
      const origPixels = origW * origH;
      const scaled = computeScaledDimensions(origW, origH, currentScale);
      const newPixels = scaled.width * scaled.height;
      const pctReduction = Math.round((1 - newPixels / origPixels) * 100);
      const estFileSavings = Math.round(pctReduction * 0.8);
      const resBox = document.createElement('div');
      resBox.style.cssText =
        'padding:0.5rem;border-radius:0.5rem;background:var(--glass-bg);border:1px solid var(--glass-border);';
      const resTitle = document.createElement('strong');
      resTitle.style.color = 'var(--text-secondary)';
      resTitle.textContent = 'Resolution: ' + origH + 'p \u2192 ' + currentScale;
      const resDesc = document.createElement('p');
      resDesc.style.margin = '0.25rem 0 0';
      resDesc.textContent =
        pctReduction +
        '% fewer pixels, estimated ~' +
        (estFileSavings - 10) +
        '\u2013' +
        (estFileSavings + 10) +
        '% smaller file';
      resBox.appendChild(resTitle);
      resBox.appendChild(resDesc);
      content.appendChild(resBox);
    }
  }

  // --- What will be lost ---
  const losses = [];
  if (currentScale !== 'original') {
    losses.push('Detail in fine textures, small text readability');
  }
  if (currentPreset === 'small' || (currentPreset === 'custom' && currentCrf >= 28)) {
    losses.push('Blocking in dark scenes, banding in gradients, blurring in fast motion');
  }
  if (currentFormat === 'mp4') losses.push('Format: MP4 \u2014 Compatible everywhere');
  else if (currentFormat === 'mkv')
    losses.push('Format: MKV \u2014 Subtitle support but less universal');
  else if (currentFormat === 'mov')
    losses.push('Format: MOV \u2014 Apple ecosystem, professional workflows');

  if (losses.length > 0) {
    const lossBox = document.createElement('div');
    lossBox.style.cssText =
      'padding:0.5rem;border-radius:0.5rem;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);';
    const lossTitle = document.createElement('strong');
    lossTitle.style.color = 'var(--status-error-text)';
    lossTitle.textContent = 'What may be lost';
    const lossList = document.createElement('ul');
    lossList.style.cssText = 'margin:0.25rem 0 0;padding-left:1rem;list-style:disc;';
    losses.forEach((l) => {
      const li = document.createElement('li');
      li.textContent = l;
      lossList.appendChild(li);
    });
    lossBox.appendChild(lossTitle);
    lossBox.appendChild(lossList);
    content.appendChild(lossBox);
  }

  // --- What will be preserved ---
  const preserved = [
    'GPS, date, camera info \u2014 all metadata preserved',
    'Audio quality maintained (AAC re-encode at high bitrate)',
    'Color space and HDR info preserved when supported',
  ];
  const preserveBox = document.createElement('div');
  preserveBox.style.cssText =
    'padding:0.5rem;border-radius:0.5rem;background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.15);';
  const preserveTitle = document.createElement('strong');
  preserveTitle.style.color = 'var(--status-done-text)';
  preserveTitle.textContent = 'What will be preserved';
  const preserveList = document.createElement('ul');
  preserveList.style.cssText = 'margin:0.25rem 0 0;padding-left:1rem;list-style:disc;';
  preserved.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = p;
    preserveList.appendChild(li);
  });
  preserveBox.appendChild(preserveTitle);
  preserveBox.appendChild(preserveList);
  content.appendChild(preserveBox);
}

// ─── Init & Export ────────────────────────────────────────────────

export function initCompression(hwData) {
  hwInfo = hwData;

  // Wire quality presets
  wireButtonGroup('quality-presets', 'preset', (value) => {
    currentPreset = value;
    toggleCustomPanel();
    updateSummary();
    updateEstimation();
    updateTradeoffInfo();
  });

  // Wire codec selector
  wireButtonGroup('codec-selector', 'codec', (value) => {
    currentCodec = value;
    updateFormatButtons();
    updateSummary();
    updateEstimation();
    updateTradeoffInfo();
  });

  // Wire format selector
  wireButtonGroup('format-selector', 'format', (value) => {
    currentFormat = value;
    updateSummary();
    updateEstimation();
    updateTradeoffInfo();
  });

  // Wire CRF slider
  const crfSlider = document.getElementById('custom-crf');
  const crfLabel = document.getElementById('custom-crf-value');
  if (crfSlider && crfLabel) {
    crfSlider.addEventListener('input', () => {
      currentCrf = parseInt(crfSlider.value, 10);
      crfLabel.textContent = 'CRF ' + currentCrf;
      updateSummary();
      updateEstimation();
      updateTradeoffInfo();
    });
  }

  // Wire speed selector
  wireButtonGroup('speed-selector', 'speed', (value) => {
    currentSpeed = value;
    updateSummary();
    updateTradeoffInfo();
  });

  // Create dynamic resolution selector
  createResolutionSelector();

  // Create estimation display
  createEstimationDisplay();

  // Initialize states
  updateHWBadge();
  updateHWIndicators();
  updateFormatButtons();
  updateSummary();
  updateTradeoffInfo();
}

export function getCompressionSettings() {
  const settings = {
    preset: currentPreset,
    codec: currentCodec,
    format: currentFormat,
    scale: currentScale,
  };
  if (currentPreset === 'custom') {
    settings.crf = currentCrf;
    settings.speed = currentSpeed;
  }
  return settings;
}
