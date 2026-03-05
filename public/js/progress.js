/**
 * progress.js - WebSocket client for real-time compression progress
 */

import { appState, showNotification, updateCompressButton } from './app.js';
import { updateJobStatus, renderFiles } from './filemanager.js';
import { updateStitchProgress } from './stitch.js';

let ws = null;
let reconnectTimer = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

function getWSUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

function handleMessage(data) {
  switch (data.type) {
    case 'progress': {
      const job = appState.activeJobs[data.jobId];
      if (job) {
        job.progress = data.percent || 0;
        job.speed = data.speed || null;
        job.eta = data.eta || null;
        job.fps = data.fps || null;
        job.status = 'compressing';

        const file = appState.files.find((f) => f.jobId === data.jobId);
        if (file) {
          file.status = 'compressing';
        }

        updateJobStatus(data.jobId, {
          type: 'progress',
          percent: job.progress,
          speed: job.speed,
          eta: job.eta,
          fps: job.fps,
        });
      }
      // Forward to stitch progress handler
      updateStitchProgress(data.jobId, data);
      break;
    }

    case 'complete': {
      const job = appState.activeJobs[data.jobId];
      if (job) {
        job.status = 'done';
        job.progress = 100;

        const file = appState.files.find((f) => f.jobId === data.jobId);
        if (file) {
          file.status = 'done';
          file.outputPath = data.outputPath;
          file.outputSize = data.outputSize;
        }

        updateJobStatus(data.jobId, {
          type: 'complete',
          outputPath: data.outputPath,
          outputSize: data.outputSize,
          duration: data.duration,
        });

        delete appState.activeJobs[data.jobId];

        const fileName = file ? file.name : 'File';
        showNotification(`${fileName} compressed successfully!`, 'success');
        updateCompressButton();
        renderFiles();
      }
      // Forward to stitch progress handler
      updateStitchProgress(data.jobId, data);
      break;
    }

    case 'error': {
      const job = appState.activeJobs[data.jobId];
      if (job) {
        job.status = 'error';

        const file = appState.files.find((f) => f.jobId === data.jobId);
        if (file) {
          file.status = 'error';
          file.error = data.error || 'Compression failed';
        }

        updateJobStatus(data.jobId, {
          type: 'error',
          error: data.error || 'Compression failed',
        });

        delete appState.activeJobs[data.jobId];

        const fileName = file ? file.name : 'File';
        showNotification(`${fileName} failed: ${data.error || 'Unknown error'}`, 'error');
        updateCompressButton();
        renderFiles();
      }
      // Forward to stitch progress handler
      updateStitchProgress(data.jobId, data);
      break;
    }

    case 'queued': {
      const file = appState.files.find((f) => f.jobId === data.jobId);
      if (file) {
        file.status = 'queued';
      }

      const job = appState.activeJobs[data.jobId];
      if (job) {
        job.status = 'queued';
      }

      updateJobStatus(data.jobId, {
        type: 'queued',
        position: data.position,
      });
      renderFiles();
      break;
    }

    case 'metaclean-complete':
    case 'metaclean-error':
      // Handled inline by metaclean.js via fetch response
      break;

    default:
      break;
  }
}

function connect() {
  const url = getWSUrl();

  try {
    ws = new WebSocket(url);
  } catch (err) {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    appState.wsConnected = true;
    reconnectDelay = 1000;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch {
      // Ignore non-JSON messages
    }
  };

  ws.onclose = () => {
    appState.wsConnected = false;
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = () => {
    appState.wsConnected = false;
    if (ws) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
    // Exponential backoff
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }, reconnectDelay);
}

export function initProgress() {
  connect();
}
