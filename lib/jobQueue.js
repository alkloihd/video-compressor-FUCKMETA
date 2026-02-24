import { spawn } from 'child_process';
import { stat } from 'fs/promises';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import PQueue from 'p-queue';

const FFMPEG_PATH = '/opt/homebrew/bin/ffmpeg';

function throttle(fn, ms) {
  let lastCall = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    const remaining = ms - (now - lastCall);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = null;
      lastCall = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

function parseProgress(line) {
  const result = {};
  const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d+)/);
  if (timeMatch) {
    result.time =
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3]) +
      parseFloat(`0.${timeMatch[4]}`);
  }
  const speedMatch = line.match(/speed=\s*([\d.]+)x/);
  if (speedMatch) result.speed = parseFloat(speedMatch[1]);
  const fpsMatch = line.match(/fps=\s*([\d.]+)/);
  if (fpsMatch) result.fps = parseFloat(fpsMatch[1]);
  return result;
}

export class JobQueue extends EventEmitter {
  constructor() {
    super();
    this._queue = new PQueue({ concurrency: 4 });
    this._jobs = new Map();
  }

  addJob(jobSpec) {
    const id = uuidv4();
    const record = {
      id,
      status: 'queued',
      inputPath: jobSpec.inputPath,
      outputPath: jobSpec.outputPath,
      preset: jobSpec.preset,
      codec: jobSpec.codec,
      format: jobSpec.format,
      startedAt: null,
      completedAt: null,
      originalSize: jobSpec.originalSize || 0,
      compressedSize: 0,
      percent: 0,
      fps: 0,
      speed: 0,
      eta: null,
      duration: jobSpec.duration || 0,
      _process: null,
    };
    this._jobs.set(id, record);
    this._queue.add(() => this._runJob(id, jobSpec));
    return this._sanitise(record);
  }

  cancelJob(jobId) {
    const record = this._jobs.get(jobId);
    if (!record) return false;
    if (record.status === 'queued') {
      record.status = 'cancelled';
      return true;
    }
    if (record.status === 'running' && record._process) {
      record._process.kill('SIGTERM');
      record.status = 'cancelled';
      return true;
    }
    return false;
  }

  getJobs() {
    return Array.from(this._jobs.values()).map((r) => this._sanitise(r));
  }
  getJob(jobId) {
    const r = this._jobs.get(jobId);
    return r ? this._sanitise(r) : undefined;
  }

  _runJob(jobId, jobSpec) {
    return new Promise((resolve) => {
      const record = this._jobs.get(jobId);
      if (!record || record.status === 'cancelled') {
        resolve();
        return;
      }

      record.status = 'running';
      record.startedAt = new Date();

      const proc = spawn(FFMPEG_PATH, jobSpec.ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      record._process = proc;

      const emitProgress = throttle(() => {
        this.emit('progress', this._sanitise(record));
      }, 1000);

      let stderrBuffer = '';
      proc.stderr.on('data', (chunk) => {
        stderrBuffer += chunk.toString();
        const lines = stderrBuffer.split('\r');
        stderrBuffer = lines.pop() || '';

        for (const line of lines) {
          const progress = parseProgress(line);
          if (progress.time !== undefined && record.duration > 0) {
            record.percent = Math.min(
              100,
              Math.round((progress.time / record.duration) * 1000) / 10,
            );
            if (progress.speed && progress.speed > 0) {
              const remaining = record.duration - progress.time;
              record.eta = Math.round(remaining / progress.speed);
            }
          }
          if (progress.fps !== undefined) record.fps = progress.fps;
          if (progress.speed !== undefined) record.speed = progress.speed;
          emitProgress();
        }
      });

      proc.on('error', (err) => {
        record.status = 'error';
        record.completedAt = new Date();
        this.emit('error', { id: jobId, message: `Failed to start FFmpeg: ${err.message}` });
        resolve();
      });

      proc.on('close', async (code) => {
        if (record.status === 'cancelled') {
          resolve();
          return;
        }
        if (code === 0) {
          record.status = 'complete';
          record.percent = 100;
          record.completedAt = new Date();
          try {
            const s = await stat(jobSpec.outputPath);
            record.compressedSize = s.size;
          } catch {
            record.compressedSize = 0;
          }
          this.emit('complete', this._sanitise(record));
        } else {
          record.status = 'error';
          record.completedAt = new Date();
          this.emit('error', { id: jobId, message: `FFmpeg exited with code ${code}` });
        }
        resolve();
      });
    });
  }

  _sanitise(record) {
    const { _process, ...clean } = record;
    return clean;
  }
}
