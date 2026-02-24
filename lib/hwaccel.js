import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = '/opt/homebrew/bin/ffmpeg';

let cachedResult = null;

export async function detectHWAccel() {
  if (cachedResult !== null) return cachedResult;

  const result = {
    h264_videotoolbox: false,
    hevc_videotoolbox: false,
    prores_videotoolbox: false,
  };

  try {
    const { stdout } = await execFileAsync(FFMPEG_PATH, ['-encoders'], { timeout: 10_000 });
    const lines = stdout.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('h264_videotoolbox')) result.h264_videotoolbox = true;
      if (trimmed.includes('hevc_videotoolbox')) result.hevc_videotoolbox = true;
      if (trimmed.includes('prores_videotoolbox')) result.prores_videotoolbox = true;
    }
  } catch (err) {
    console.warn('Failed to detect hardware encoders:', err.message);
  }

  cachedResult = Object.freeze(result);
  return cachedResult;
}

export function getEncoder(codec, useHW) {
  switch (codec) {
    case 'h264':
      return useHW ? 'h264_videotoolbox' : 'libx264';
    case 'h265':
      return useHW ? 'hevc_videotoolbox' : 'libx265';
    case 'prores':
      return useHW ? 'prores_videotoolbox' : 'prores_ks';
    case 'av1':
      return 'libsvtav1';
    default:
      throw new Error(`Unsupported codec: ${codec}`);
  }
}
