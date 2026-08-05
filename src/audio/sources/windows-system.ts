import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { logger } from '../../utils/logger.js';
import type { AudioCapturer } from '../types.js';

/**
 * Captura áudio do sistema no Windows via FFmpeg dshow (WASAPI loopback / Stereo Mix).
 * Pré-requisito: FFmpeg instalado e no PATH, e um dispositivo de loopback habilitado.
 * Produz PCM: s16le, 48000Hz, stereo.
 */
export class WindowsSystemCapturer implements AudioCapturer {
  readonly sourceType = 'system' as const;

  private readonly device: string;
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pcm = new PassThrough();

  constructor(device = 'Stereo Mix') {
    this.device = device;
  }

  start(): NodeJS.ReadableStream {
    if (this.proc) {
      logger.warn('Captura já em andamento, retornando stream existente');
      return this.pcm;
    }

    this.proc = spawn('ffmpeg', [
      '-f', 'dshow',
      '-i', `audio="${this.device}"`,
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1',
    ]);

    this.proc.stdout.pipe(this.pcm);

    this.proc.stderr.on('data', (chunk: Buffer) => {
      logger.debug({ stderr: chunk.toString().trim() }, 'ffmpeg stderr');
    });

    this.proc.on('error', (err) => {
      logger.error({ err }, 'Falha ao spawnar ffmpeg');
      this.pcm.destroy(err);
    });

    this.proc.on('close', (code) => {
      logger.info({ code }, 'ffmpeg encerrado');
      this.pcm.end();
      this.proc = null;
    });

    return this.pcm;
  }

  stop(): void {
    if (this.proc) {
      this.proc.kill('SIGTERM');
      this.proc = null;
    }
    if (!this.pcm.destroyed) {
      this.pcm.end();
    }
  }
}
