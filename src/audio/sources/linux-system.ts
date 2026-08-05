import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { logger } from '../../utils/logger.js';
import type { AudioCapturer } from '../types.js';

const PCM_ARGS = [
  '--raw',
  '--format=s16le',
  '--rate=48000',
  '--channels=2',
  '--latency-msec=20',
  '--device=@DEFAULT_MONITOR@',
];

/**
 * Captura áudio do sistema (sink/monitor padrão) no Linux via PipeWire/PulseAudio.
 * Produz PCM: s16le, 48000Hz, stereo.
 */
export class LinuxSystemCapturer implements AudioCapturer {
  readonly sourceType = 'system' as const;

  private proc: ChildProcessWithoutNullStreams | null = null;
  private pcm = new PassThrough();

  start(): NodeJS.ReadableStream {
    if (this.proc) {
      logger.warn('Captura já em andamento, retornando stream existente');
      return this.pcm;
    }

    if (this.pcm.readableEnded || this.pcm.destroyed) {
      this.pcm = new PassThrough();
    }

    logger.info({ monitor: '@DEFAULT_MONITOR@' }, 'Capturando monitor do áudio do sistema');
    this.proc = spawn('parec', PCM_ARGS);

    let bytesCaptured = 0;
    this.proc.stdout.on('data', (chunk: Buffer) => {
      bytesCaptured += chunk.length;
      if (bytesCaptured === chunk.length) {
        logger.info({ bytes: chunk.length }, 'parec começou a enviar áudio PCM');
      }
    });

    this.proc.stdout.pipe(this.pcm);

    this.proc.stderr.on('data', (chunk: Buffer) => {
      const stderr = chunk.toString().trim();
      if (stderr) {
        logger.warn({ stderr }, 'parec informou um erro');
      }
    });

    this.proc.on('error', (err) => {
      logger.error({ err }, 'Falha ao spawnar parec');
      this.pcm.destroy(err);
    });

    this.proc.on('close', (code, signal) => {
      logger.info({ code, signal, bytesCaptured }, 'parec encerrado');
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
