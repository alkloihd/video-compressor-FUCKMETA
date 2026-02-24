/**
 * crop.js - Crop preset controls
 */

let videoWidth = 0;
let videoHeight = 0;
let activeCrop = 'none';

const ASPECT_RATIOS = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16,
};

function makeEven(n) {
  return Math.floor(n / 2) * 2;
}

function updateCropInfo() {
  const infoEl = document.getElementById('crop-info');
  if (!infoEl) return;

  if (activeCrop === 'none' || videoWidth === 0 || videoHeight === 0) {
    infoEl.classList.add('hidden');
    infoEl.textContent = '';
    return;
  }

  const settings = getCropSettings();
  if (settings) {
    infoEl.classList.remove('hidden');
    infoEl.textContent = `Crop: ${settings.width}x${settings.height} at (${settings.x}, ${settings.y})`;
  }
}

export function initCrop() {
  const container = document.getElementById('crop-presets');
  if (!container) return;

  const buttons = container.querySelectorAll('.preset-btn');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const crop = btn.dataset.crop;
      if (!crop) return;

      // Update active state
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      activeCrop = crop;
      updateCropInfo();
    });
  });
}

export function setVideoSize(w, h) {
  videoWidth = w;
  videoHeight = h;
  updateCropInfo();
}

export function getCropSettings() {
  if (activeCrop === 'none' || videoWidth === 0 || videoHeight === 0) {
    return null;
  }

  const targetRatio = ASPECT_RATIOS[activeCrop];
  if (!targetRatio) return null;

  const currentRatio = videoWidth / videoHeight;

  let cropW, cropH;

  if (currentRatio > targetRatio) {
    // Video is wider than target: crop width
    cropH = videoHeight;
    cropW = Math.round(videoHeight * targetRatio);
  } else {
    // Video is taller than target: crop height
    cropW = videoWidth;
    cropH = Math.round(videoWidth / targetRatio);
  }

  // Ensure even dimensions (required by most codecs)
  cropW = makeEven(cropW);
  cropH = makeEven(cropH);

  // Center the crop
  const x = makeEven(Math.floor((videoWidth - cropW) / 2));
  const y = makeEven(Math.floor((videoHeight - cropH) / 2));

  return {
    width: cropW,
    height: cropH,
    x,
    y,
  };
}
