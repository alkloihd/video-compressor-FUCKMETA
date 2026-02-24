/**
 * player.js - Plyr video player integration
 */

let player = null;

export function initPlayer() {
  const videoEl = document.getElementById('preview-player');
  if (!videoEl) return;

  player = new Plyr(videoEl, {
    controls: [
      'play-large',
      'play',
      'progress',
      'current-time',
      'duration',
      'mute',
      'volume',
      'fullscreen',
    ],
    tooltips: { controls: true, seek: true },
    keyboard: { focused: true, global: false },
    hideControls: true,
    resetOnEnd: true,
  });
}

export function loadVideo(url) {
  if (!player) return;

  const previewSection = document.getElementById('preview-section');
  if (previewSection) {
    previewSection.classList.remove('hidden');
  }

  player.source = {
    type: 'video',
    sources: [{ src: url, type: 'video/mp4' }],
  };
}

export function getCurrentTime() {
  if (!player) return 0;
  return player.currentTime || 0;
}

export function getDuration() {
  if (!player) return 0;
  return player.duration || 0;
}

export function seekTo(time) {
  if (!player) return;
  player.currentTime = time;
}

export function destroyPlayer() {
  if (player) {
    try {
      player.stop();
      player.source = { type: 'video', sources: [] };
    } catch {
      // Ignore errors during cleanup
    }
  }
}
