import { getEncoder } from './hwaccel.js';

const QUALITY_PRESETS = {
  h264_videotoolbox: {
    max: ['-b:v', '20000k', '-profile:v', 'high'],
    balanced: ['-b:v', '8000k', '-profile:v', 'high'],
    small: ['-b:v', '4000k', '-profile:v', 'main'],
    streaming: ['-b:v', '5000k', '-profile:v', 'high'],
  },
  libx264: {
    max: ['-crf', '18', '-preset', 'slow'],
    balanced: ['-crf', '23', '-preset', 'medium'],
    small: ['-crf', '28', '-preset', 'medium'],
    streaming: ['-crf', '23', '-preset', 'fast'],
  },
  hevc_videotoolbox: {
    max: ['-b:v', '12000k', '-tag:v', 'hvc1'],
    balanced: ['-b:v', '6000k', '-tag:v', 'hvc1'],
    small: ['-b:v', '3000k', '-tag:v', 'hvc1'],
    streaming: ['-b:v', '4000k', '-tag:v', 'hvc1'],
  },
  libx265: {
    max: ['-crf', '22', '-preset', 'slow', '-tag:v', 'hvc1'],
    balanced: ['-crf', '28', '-preset', 'medium', '-tag:v', 'hvc1'],
    small: ['-crf', '32', '-preset', 'medium', '-tag:v', 'hvc1'],
    streaming: ['-crf', '28', '-preset', 'fast', '-tag:v', 'hvc1'],
  },
  libsvtav1: {
    max: ['-crf', '25', '-preset', '4'],
    balanced: ['-crf', '30', '-preset', '6'],
    small: ['-crf', '38', '-preset', '8'],
    streaming: ['-crf', '35', '-preset', '6'],
  },
  prores_videotoolbox: {
    max: ['-profile:v', '3'],
    balanced: ['-profile:v', '2'],
    small: ['-profile:v', '1'],
    streaming: ['-profile:v', '2'],
  },
  prores_ks: {
    max: ['-profile:v', '3'],
    balanced: ['-profile:v', '2'],
    small: ['-profile:v', '1'],
    streaming: ['-profile:v', '2'],
  },
};

function getAudioFlags(codec, preset) {
  switch (codec) {
    case 'h264':
    case 'h265':
      return ['-c:a', 'aac', '-b:a', preset === 'max' ? '256k' : '192k'];
    case 'prores':
      return ['-c:a', 'pcm_s16le'];
    case 'av1':
      return ['-c:a', 'libopus', '-b:a', '128k'];
    default:
      return ['-c:a', 'aac', '-b:a', '192k'];
  }
}

/**
 * Adjust HW-encoder bitrate target so we never exceed the input bitrate.
 * Different presets use different reduction ratios:
 *   max       – no cap (user wants maximum quality)
 *   balanced  – cap at 70 % of input
 *   streaming – cap at 50 % of input
 *   small     – cap at 40 % of input
 */
function adjustBitrate(targetKbps, inputBitrateKbps, preset) {
  if (!inputBitrateKbps || inputBitrateKbps <= 0) return targetKbps;
  if (preset === 'max') return targetKbps;

  let ratio = 0.7; // balanced (default)
  if (preset === 'small') ratio = 0.4;
  if (preset === 'streaming') ratio = 0.5;

  const maxTarget = Math.floor(inputBitrateKbps * ratio);
  return Math.min(targetKbps, maxTarget);
}

const SCALE_HEIGHTS = {
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
  '360p': 360,
};

export function buildCommand(options) {
  const {
    inputPath,
    outputPath,
    preset,
    codec,
    format,
    hwAccel,
    trim = null,
    crop = null,
    scale = 'original',
    sourceBitrate = 0,
    crf = null,
    speed = null,
  } = options;

  const hwAvailable = isHWAvailable(codec, hwAccel);
  const encoder = getEncoder(codec, hwAvailable);
  const args = [];

  args.push('-threads', '0', '-y');
  args.push('-i', inputPath);
  args.push('-map_metadata', '0');

  // Copy all streams: MP4/MOV support data/subtitle tracks (GPS, etc.),
  // MKV may not support all metadata tracks so only map video + audio.
  if (format === 'mkv') {
    args.push('-map', '0:v', '-map', '0:a?');
  } else {
    args.push('-map', '0');
  }

  if (trim) {
    if (trim.start) args.push('-ss', trim.start);
    if (trim.end) args.push('-to', trim.end);
  }

  args.push('-c:v', encoder);

  if (preset === 'custom' && crf !== null) {
    // Custom preset: use raw CRF/bitrate + speed values
    if (encoder.includes('videotoolbox')) {
      // HW encoders use bitrate, not CRF. Map CRF range to bitrate.
      // CRF 0 = ~30Mbps, CRF 23 = ~8Mbps, CRF 51 = ~500kbps
      const bitrateKbps = Math.max(500, Math.round(30000 * Math.pow(0.94, crf)));
      const adjusted =
        sourceBitrate > 0
          ? Math.min(bitrateKbps, Math.floor((sourceBitrate / 1000) * 0.9))
          : bitrateKbps;
      args.push('-b:v', `${adjusted}k`);
      if (encoder === 'hevc_videotoolbox') args.push('-tag:v', 'hvc1');
      if (encoder === 'h264_videotoolbox') args.push('-profile:v', 'high');
    } else if (encoder === 'libsvtav1') {
      args.push('-crf', String(crf));
      if (speed) {
        // Map speed names to SVT-AV1 preset numbers (0=slowest, 13=fastest)
        const svtMap = { veryslow: '2', slow: '4', medium: '6', fast: '8', ultrafast: '12' };
        args.push('-preset', svtMap[speed] || '6');
      }
    } else if (encoder === 'prores_videotoolbox' || encoder === 'prores_ks') {
      // ProRes doesn't use CRF, map to profile: 0=proxy, 1=LT, 2=SQ, 3=HQ
      const profile = crf <= 15 ? '3' : crf <= 28 ? '2' : crf <= 40 ? '1' : '0';
      args.push('-profile:v', profile);
    } else {
      // Software x264/x265: use CRF + speed preset directly
      args.push('-crf', String(crf));
      if (speed) args.push('-preset', speed);
      if (encoder === 'libx265') args.push('-tag:v', 'hvc1');
    }
  } else {
    const qualityFlags = QUALITY_PRESETS[encoder]?.[preset];
    if (qualityFlags) {
      const flags = [...qualityFlags];
      // Smart bitrate: cap target to prevent size increases for HW encoders
      const bvIndex = flags.indexOf('-b:v');
      if (bvIndex !== -1 && sourceBitrate > 0) {
        const targetKbps = parseInt(flags[bvIndex + 1], 10);
        flags[bvIndex + 1] = `${adjustBitrate(targetKbps, sourceBitrate / 1000, preset)}k`;
      }
      args.push(...flags);
    }
  }

  const filters = [];
  if (crop) filters.push(`crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`);
  if (scale !== 'original' && SCALE_HEIGHTS[scale]) {
    filters.push(`scale=-2:${SCALE_HEIGHTS[scale]}`);
  }
  if (filters.length > 0) args.push('-vf', filters.join(','));

  args.push(...getAudioFlags(codec, preset));

  if (format === 'mp4' || format === 'mov') {
    args.push('-movflags', '+faststart+use_metadata_tags');
  }

  args.push(outputPath);
  return args;
}

function isHWAvailable(codec, hwAccel) {
  if (!hwAccel) return false;
  switch (codec) {
    case 'h264':
      return !!hwAccel.h264_videotoolbox;
    case 'h265':
      return !!hwAccel.hevc_videotoolbox;
    case 'prores':
      return !!hwAccel.prores_videotoolbox;
    case 'av1':
      return false;
    default:
      return false;
  }
}
