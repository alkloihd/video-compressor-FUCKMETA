/**
 * stitch.js - Stitch tab UI for video concatenation
 */

import { showNotification } from './app.js';
import { formatBytes, formatDuration } from './filemanager.js';
import { loadVideo } from './player.js';

let stitchClips = [];
let stitchCompress = false;
let stitchPreset = 'balanced';
let stitchCodec = 'h265';
let stitchFormat = 'mp4';
let sortableInstance = null;

// ─── Clip Management ─────────────────────────────────────────────
function addStitchFiles(fileList) {
  const files = Array.from(fileList);
  for (const file of files) {
    const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    stitchClips.push({
      id,
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      serverPath: null,
      probeData: null,
      trim: null,
    });
  }
  renderStitchClips();
  updateStitchButton();
}

async function uploadStitchClip(entry) {
  const formData = new FormData();
  formData.append('file', entry.file);

  try {
    entry.status = 'uploading';
    renderStitchClips();

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');

    const data = await res.json();
    entry.serverPath = data.files[0].path;

    // Probe the clip
    const probeRes = await fetch(`/api/probe?path=${encodeURIComponent(entry.serverPath)}`);
    if (probeRes.ok) entry.probeData = await probeRes.json();

    entry.status = 'ready';
  } catch (err) {
    entry.status = 'error';
    entry.error = err.message;
  }
  renderStitchClips();
  updateStitchButton();
}

function removeStitchClip(id) {
  stitchClips = stitchClips.filter((c) => c.id !== id);
  renderStitchClips();
  updateStitchButton();
}

function previewClip(clip) {
  if (clip.serverPath) {
    const previewSection = document.getElementById('preview-section');
    if (previewSection) previewSection.classList.remove('hidden');
    loadVideo(`/api/stream?path=${encodeURIComponent(clip.serverPath)}`);
  }
}

// ─── Stitch Action ───────────────────────────────────────────────
async function doStitch() {
  const readyClips = stitchClips.filter((c) => c.status === 'ready');
  if (readyClips.length < 2) {
    showNotification('Need at least 2 clips to stitch', 'warning');
    return;
  }

  const stitchBtn = document.getElementById('stitch-btn');
  if (stitchBtn) {
    stitchBtn.disabled = true;
    const txtNode = Array.from(stitchBtn.childNodes).find((n) => n.nodeType === 3);
    if (txtNode) txtNode.textContent = ' Stitching...';
  }

  // Show progress area (server awaits completion, so show a spinner)
  const progressArea = document.getElementById('stitch-progress');
  if (progressArea) {
    progressArea.style.display = '';
    progressArea.innerHTML = `
      <div style="padding: 16px; background: var(--card-bg); border: 2px solid var(--card-border); border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 13px; font-weight: 600; color: var(--text-primary); font-family: 'SF Mono', monospace; text-transform: uppercase;">Stitching ${readyClips.length} clips...</span>
          <span class="status-badge status-compressing">Processing</span>
        </div>
      </div>
    `;
  }

  try {
    const body = {
      clips: readyClips.map((c) => ({
        path: c.serverPath,
        name: c.name,
        trim: c.trim || undefined,
      })),
      compress: stitchCompress,
      preset: stitchPreset,
      codec: stitchCodec,
      format: stitchFormat,
    };

    const res = await fetch('/api/stitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Stitch failed' }));
      throw new Error(err.error);
    }

    const data = await res.json();

    // Server returns result directly (awaits completion)
    if (progressArea) {
      progressArea.innerHTML = `
        <div style="padding: 16px; background: var(--status-done-bg); border: 2px solid var(--status-done-border); border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; font-weight: 600; color: var(--status-done-text); font-family: 'SF Mono', monospace; text-transform: uppercase;">Stitch Complete (${data.method})</span>
            <span class="status-badge status-done">Done</span>
          </div>
          <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">Output: ${formatBytes(data.outputSize || 0)}</div>
          ${data.outputPath ? `<a href="/api/download?path=${encodeURIComponent(data.outputPath)}" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; padding: 6px 14px; font-size: 12px; font-weight: 700; color: var(--accent); background: var(--accent-bg-10); border: 2px solid var(--accent-border-25); border-radius: 4px; text-decoration: none; font-family: 'SF Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em;">Download</a>` : ''}
        </div>
      `;
    }

    showNotification(`Stitch complete! (${data.method})`, 'success');
  } catch (err) {
    showNotification(`Stitch failed: ${err.message}`, 'error');
    if (progressArea) {
      progressArea.innerHTML = `
        <div style="padding: 16px; background: var(--status-error-bg); border: 2px solid var(--status-error-border); border-radius: 4px;">
          <span style="font-size: 13px; font-weight: 600; color: var(--status-error-text);">Stitch Failed: ${err.message}</span>
        </div>
      `;
    }
  }

  if (stitchBtn) {
    stitchBtn.disabled = false;
    const txtNode = Array.from(stitchBtn.childNodes).find((n) => n.nodeType === 3);
    if (txtNode) txtNode.textContent = ' Stitch Clips';
  }
}

// ─── Progress Updates ────────────────────────────────────────────
export function updateStitchProgress(jobId, data) {
  const progressArea = document.getElementById('stitch-progress');
  if (!progressArea || progressArea.dataset.jobId !== jobId) return;

  if (data.type === 'progress') {
    const fill = document.getElementById('stitch-progress-fill');
    const stats = document.getElementById('stitch-progress-stats');
    if (fill) fill.style.width = `${Math.round(data.percent)}%`;
    if (stats) {
      stats.innerHTML = `
        <span style="color: var(--progress-speed);">${data.speed || '--'}</span>
        <span style="color: var(--progress-eta);">${Math.round(data.percent)}%${data.eta ? ' | ETA: ' + data.eta : ''}</span>
      `;
    }
  } else if (data.type === 'complete') {
    progressArea.innerHTML = `
      <div style="padding: 16px; background: var(--status-done-bg); border: 2px solid var(--status-done-border); border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 13px; font-weight: 600; color: var(--status-done-text); font-family: 'SF Mono', monospace; text-transform: uppercase;">Stitch Complete</span>
          <span class="status-badge status-done">Done</span>
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">Output: ${formatBytes(data.outputSize || 0)}</div>
        ${data.outputPath ? `<a href="/api/download?path=${encodeURIComponent(data.outputPath)}" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; padding: 6px 14px; font-size: 12px; font-weight: 700; color: var(--accent); background: var(--accent-bg-10); border: 2px solid var(--accent-border-25); border-radius: 4px; text-decoration: none; font-family: 'SF Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em;">Download</a>` : ''}
      </div>
    `;
    showNotification('Stitch complete!', 'success');
    const stitchBtn = document.getElementById('stitch-btn');
    if (stitchBtn) {
      stitchBtn.disabled = false;
      const txtNode = Array.from(stitchBtn.childNodes).find((n) => n.nodeType === 3);
      if (txtNode) txtNode.textContent = ' Stitch Clips';
    }
  } else if (data.type === 'error') {
    progressArea.innerHTML = `
      <div style="padding: 16px; background: var(--status-error-bg); border: 2px solid var(--status-error-border); border-radius: 4px;">
        <span style="font-size: 13px; font-weight: 600; color: var(--status-error-text);">Stitch Failed: ${data.error}</span>
      </div>
    `;
    showNotification(`Stitch failed: ${data.error}`, 'error');
    const stitchBtn = document.getElementById('stitch-btn');
    if (stitchBtn) {
      stitchBtn.disabled = false;
      const txtNode = Array.from(stitchBtn.childNodes).find((n) => n.nodeType === 3);
      if (txtNode) txtNode.textContent = ' Stitch Clips';
    }
  }
}

// ─── Render ──────────────────────────────────────────────────────
function renderStitchClips() {
  const container = document.getElementById('stitch-clips');
  const emptyMsg = document.getElementById('stitch-empty');
  if (!container) return;

  // Destroy stale SortableJS instance before replacing DOM
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }

  if (stitchClips.length === 0) {
    container.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = '';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';

  container.innerHTML = stitchClips
    .map((c, i) => {
      const probe = c.probeData;
      const meta = probe
        ? `${probe.width}x${probe.height} | ${probe.codec?.toUpperCase()} | ${formatDuration(probe.duration)}`
        : '';

      return `
      <div class="stitch-clip-card" data-clip-id="${c.id}" style="padding: 10px 12px; background: var(--card-bg); border: 2px solid var(--card-border); border-radius: 4px; display: flex; align-items: center; gap: 10px; cursor: grab;">
        <span style="font-size: 14px; font-weight: 700; color: var(--text-muted); font-family: 'SF Mono', monospace; min-width: 24px;">${i + 1}</span>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 13px; font-weight: 600; color: var(--card-name-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.name}</div>
          <div style="font-size: 11px; color: var(--card-meta-color); margin-top: 2px;">${meta || formatBytes(c.size)}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          ${c.serverPath ? `<button data-clip-preview="${c.id}" style="padding: 3px 8px; font-size: 11px; background: var(--accent-bg-10); border: 1px solid var(--accent-border-25); border-radius: 4px; color: var(--accent); cursor: pointer; font-family: 'SF Mono', monospace;">Preview</button>` : ''}
          <button data-clip-remove="${c.id}" style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: var(--status-error-bg); border: 1px solid var(--status-error-border); border-radius: 4px; color: var(--status-error-text); cursor: pointer; font-size: 12px;">&times;</button>
        </div>
      </div>
    `;
    })
    .join('');

  // Wire handlers
  container.querySelectorAll('[data-clip-preview]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const clip = stitchClips.find((c) => c.id === btn.dataset.clipPreview);
      if (clip) previewClip(clip);
    });
  });

  container.querySelectorAll('[data-clip-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeStitchClip(btn.dataset.clipRemove);
    });
  });

  // Init SortableJS
  if (typeof Sortable !== 'undefined' && !sortableInstance) {
    sortableInstance = new Sortable(container, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        const [moved] = stitchClips.splice(evt.oldIndex, 1);
        stitchClips.splice(evt.newIndex, 0, moved);
        renderStitchClips();
      },
    });
  }
}

function updateStitchButton() {
  const btn = document.getElementById('stitch-btn');
  if (!btn) return;
  const readyCount = stitchClips.filter((c) => c.status === 'ready').length;
  btn.disabled = readyCount < 2;
}

// ─── Init ────────────────────────────────────────────────────────
export function initStitch() {
  // Wire drop zone
  const dropZone = document.getElementById('stitch-drop');
  const fileInput = document.getElementById('stitch-file-input');

  if (dropZone && fileInput) {
    let dragCounter = 0;

    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropZone.classList.remove('drag-over');
      }
    });
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        addStitchFiles(files);
        for (const entry of stitchClips.filter((c) => c.status === 'pending')) {
          await uploadStitchClip(entry);
        }
      }
    });

    dropZone.addEventListener('click', (e) => {
      if (!e.target.closest('button') && !e.target.closest('a')) fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
      if (fileInput.files.length > 0) {
        addStitchFiles(fileInput.files);
        for (const entry of stitchClips.filter((c) => c.status === 'pending')) {
          await uploadStitchClip(entry);
        }
        fileInput.value = '';
      }
    });
  }

  // Wire compress toggle
  const compressToggle = document.getElementById('stitch-compress-toggle');
  const compressOptions = document.getElementById('stitch-compress-options');
  if (compressToggle && compressOptions) {
    compressToggle.addEventListener('change', () => {
      stitchCompress = compressToggle.checked;
      compressOptions.style.display = stitchCompress ? '' : 'none';
    });
  }

  // Wire preset/codec/format selectors
  document.querySelectorAll('[data-stitch-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('[data-stitch-preset]')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      stitchPreset = btn.dataset.stitchPreset;
    });
  });

  document.querySelectorAll('[data-stitch-codec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-stitch-codec]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      stitchCodec = btn.dataset.stitchCodec;
    });
  });

  document.querySelectorAll('[data-stitch-format]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('[data-stitch-format]')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      stitchFormat = btn.dataset.stitchFormat;
    });
  });

  // Wire stitch button
  const stitchBtn = document.getElementById('stitch-btn');
  if (stitchBtn) stitchBtn.addEventListener('click', doStitch);

  renderStitchClips();
}
