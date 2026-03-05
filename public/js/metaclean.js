/**
 * metaclean.js - MetaClean tab UI for stripping metadata
 */

import { showNotification } from './app.js';
import { formatBytes } from './filemanager.js';

let exiftoolStatus = null;
let metacleanFiles = [];
let currentMode = 'attribution';

// ─── ExifTool Status ─────────────────────────────────────────────
async function checkExifTool() {
  const badge = document.getElementById('exiftool-status');
  if (!badge) return;

  try {
    const res = await fetch('/api/exiftool');
    if (res.ok) {
      exiftoolStatus = await res.json();
      if (exiftoolStatus.installed) {
        badge.textContent = `ExifTool ${exiftoolStatus.version}`;
        badge.style.color = 'var(--status-done-text)';
        badge.style.borderColor = 'var(--status-done-border)';
        badge.style.background = 'var(--status-done-bg)';
      } else {
        badge.textContent = 'ExifTool not installed';
        badge.style.color = 'var(--status-error-text)';
        badge.style.borderColor = 'var(--status-error-border)';
        badge.style.background = 'var(--status-error-bg)';
      }
      updateCleanButton();
    }
  } catch {
    badge.textContent = 'ExifTool check failed';
    badge.style.color = 'var(--status-error-text)';
  }
}

// ─── File Management ─────────────────────────────────────────────
function addMetaFiles(fileList) {
  const files = Array.from(fileList);
  for (const file of files) {
    const id = `meta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    metacleanFiles.push({
      id,
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      serverPath: null,
      result: null,
      error: null,
    });
  }
  renderMetaFiles();
  updateCleanButton();
}

async function uploadMetaFile(entry) {
  const formData = new FormData();
  formData.append('file', entry.file);

  try {
    entry.status = 'uploading';
    renderMetaFiles();

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');

    const data = await res.json();
    entry.serverPath = data.files[0].path;
    entry.status = 'ready';
  } catch (err) {
    entry.status = 'error';
    entry.error = err.message;
  }
  renderMetaFiles();
  updateCleanButton();
}

function removeMetaFile(id) {
  metacleanFiles = metacleanFiles.filter((f) => f.id !== id);
  renderMetaFiles();
  updateCleanButton();
}

// ─── Clean Files ─────────────────────────────────────────────────
async function cleanFiles() {
  const readyFiles = metacleanFiles.filter((f) => f.status === 'ready');
  if (readyFiles.length === 0) return;

  const cleanBtn = document.getElementById('metaclean-btn');
  if (cleanBtn) {
    cleanBtn.disabled = true;
    const txtNode = Array.from(cleanBtn.childNodes).find((n) => n.nodeType === 3);
    if (txtNode) txtNode.textContent = ' Cleaning...';
  }

  try {
    const res = await fetch('/api/metaclean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: readyFiles.map((f) => ({ path: f.serverPath, name: f.name })),
        mode: currentMode,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Clean failed' }));
      throw new Error(err.error);
    }

    const data = await res.json();

    for (let i = 0; i < data.results.length; i++) {
      const result = data.results[i];
      const file = readyFiles[i];
      if (file) {
        file.result = result;
        file.status = result.error ? 'error' : 'done';
        if (result.error) file.error = result.error;
      }
    }

    const cleaned = data.results.filter((r) => r.status === 'cleaned').length;
    const alreadyClean = data.results.filter((r) => r.status === 'clean').length;

    if (cleaned > 0) showNotification(`${cleaned} file(s) cleaned successfully!`, 'success');
    if (alreadyClean > 0) showNotification(`${alreadyClean} file(s) already clean`, 'info');
  } catch (err) {
    showNotification(`MetaClean failed: ${err.message}`, 'error');
  }

  if (cleanBtn) {
    cleanBtn.disabled = false;
    const txtNode = Array.from(cleanBtn.childNodes).find((n) => n.nodeType === 3);
    if (txtNode) txtNode.textContent = ' Clean Files';
  }

  renderMetaFiles();
}

// ─── Render ──────────────────────────────────────────────────────
function renderMetaFiles() {
  const container = document.getElementById('metaclean-files');
  const emptyMsg = document.getElementById('metaclean-empty');
  if (!container) return;

  if (metacleanFiles.length === 0) {
    container.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = '';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';

  const statusMap = {
    pending: '<span class="status-badge status-pending">Pending</span>',
    uploading: '<span class="status-badge status-uploading">Uploading</span>',
    ready: '<span class="status-badge status-pending">Ready</span>',
    done: '<span class="status-badge status-done">Done</span>',
    error: '<span class="status-badge status-error">Error</span>',
  };

  container.innerHTML = metacleanFiles
    .map((f) => {
      let resultHTML = '';
      if (f.result && f.status === 'done') {
        const removed = f.result.removed || [];
        const preserved = f.result.preserved || f.result.preservedCount || 0;
        resultHTML = `
        <div style="margin-top: 8px; padding: 8px; background: var(--bg-elevated); border: 2px solid var(--glass-border); border-radius: 4px; font-size: 12px;">
          <div style="color: var(--accent-primary, var(--accent)); font-weight: 700; font-family: 'SF Mono', monospace; text-transform: uppercase; font-size: 11px; margin-bottom: 4px;">
            ${removed.length} tag${removed.length !== 1 ? 's' : ''} removed | ${preserved} preserved
          </div>
          ${removed.map((r) => `<div style="color: var(--text-muted); font-size: 11px;">\u2022 ${r.tag}: <span style="color: var(--status-error-text); text-decoration: line-through;">${String(r.oldValue).substring(0, 60)}</span></div>`).join('')}
          ${f.result.outputPath ? `<a href="/api/download?path=${encodeURIComponent(f.result.outputPath)}" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--accent-bg-10); border: 2px solid var(--accent-border-25); border-radius: 4px; text-decoration: none; font-family: 'SF Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em;">Download Clean</a>` : ''}
        </div>
      `;
      }

      if (f.error && f.status === 'error') {
        resultHTML = `<div style="margin-top: 6px; color: var(--status-error-text); font-size: 12px;">${f.error}</div>`;
      }

      return `
      <div style="padding: 12px; background: var(--card-bg); border: 2px solid var(--card-border); border-radius: 4px; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="font-size: 13px; font-weight: 600; color: var(--card-name-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${f.name}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; color: var(--card-size-color);">${formatBytes(f.size)}</span>
            ${statusMap[f.status] || ''}
            <button data-meta-remove="${f.id}" style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: var(--status-error-bg); border: 1px solid var(--status-error-border); border-radius: 4px; color: var(--status-error-text); cursor: pointer; font-size: 12px; line-height: 1;">&times;</button>
          </div>
        </div>
        ${resultHTML}
      </div>
    `;
    })
    .join('');

  // Wire remove buttons
  container.querySelectorAll('[data-meta-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeMetaFile(btn.dataset.metaRemove);
    });
  });
}

function updateCleanButton() {
  const btn = document.getElementById('metaclean-btn');
  if (!btn) return;
  const readyCount = metacleanFiles.filter((f) => f.status === 'ready').length;
  btn.disabled = readyCount === 0 || !exiftoolStatus?.installed;
}

// ─── Init ────────────────────────────────────────────────────────
export function initMetaClean() {
  checkExifTool();

  // Wire mode toggle
  const modeButtons = document.querySelectorAll('[data-metaclean-mode]');
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      modeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.metacleanMode;
    });
  });

  // Wire drop zone
  const dropZone = document.getElementById('metaclean-drop');
  const fileInput = document.getElementById('metaclean-file-input');

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
        addMetaFiles(files);
        for (const entry of metacleanFiles.filter((f) => f.status === 'pending')) {
          await uploadMetaFile(entry);
        }
      }
    });

    dropZone.addEventListener('click', (e) => {
      if (!e.target.closest('button') && !e.target.closest('a')) fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
      if (fileInput.files.length > 0) {
        addMetaFiles(fileInput.files);
        for (const entry of metacleanFiles.filter((f) => f.status === 'pending')) {
          await uploadMetaFile(entry);
        }
        fileInput.value = '';
      }
    });
  }

  // Wire clean button
  const cleanBtn = document.getElementById('metaclean-btn');
  if (cleanBtn) cleanBtn.addEventListener('click', cleanFiles);
}
