import { Readable } from 'node:stream';
import { OpusAudioEncoder, FRAME_BYTES } from './encoder.js';
import { logger } from '../utils/logger.js';

export interface StreamEvents {
  data: (chunk: Buffer) => void;
  end: () => void;
}

export type StreamHandler = (events: StreamEvents) => void;

/**
 * Transforma um stream de PCM s16le (48kHz, stereo) em um stream de frames Opus.
 * Faz o frame-alignment (acumula chunks até completar FRAME_BYTES), codifica
 * cada frame e faz push em um Readable (StreamType.Opus).
 */
export function createOpusStream(pcm: NodeJS.ReadableStream): Readable {
  const encoder = new OpusAudioEncoder();

  const opusStream = new Readable({
    // Cada Buffer precisa ser entregue como um pacote Opus inteiro. Em modo
    // byte-stream o Node pode concatenar ou dividir frames consecutivos.
    objectMode: true,
    read() {
      // push-based: dados chegam assincronamente do capturador
    },
  });

  let buffer = Buffer.alloc(0);

  pcm.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= FRAME_BYTES) {
      const frame = buffer.subarray(0, FRAME_BYTES);
      buffer = buffer.subarray(FRAME_BYTES);

      if (buffer.length < FRAME_BYTES) {
        buffer = Buffer.from(buffer);
      }

      try {
        const opusFrame = encoder.encode(frame);
        if (!opusStream.push(opusFrame)) {
          // Back-pressure: consumidor lento, descarta para não acumular
          logger.warn('Back-pressure detectada, descartando frames');
        }
      } catch (err) {
        logger.error({ err }, 'Falha ao codificar frame PCM');
        opusStream.destroy(err as Error);
        return;
      }
    }
  });

  pcm.on('error', (err) => {
    logger.error({ err }, 'Erro no stream PCM');
    opusStream.destroy(err as Error);
  });

  pcm.on('end', () => {
    opusStream.push(null);
  });

  return opusStream;
}
