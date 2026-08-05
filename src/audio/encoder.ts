import opus from '@discordjs/opus';

/** 20ms de áudio a 48kHz, stereo, s16le */
export const SAMPLE_RATE = 48_000;
export const CHANNELS = 2;
export const FRAME_SAMPLES = SAMPLE_RATE / 50; // 960 samples por canal (20ms)
export const FRAME_BYTES = FRAME_SAMPLES * CHANNELS * 2; // 3840 bytes

/**
 * Wrapper do OpusEncoder do @discordjs/opus.
 * Codifica PCM s16le (48000Hz, stereo) em frames Opus.
 */
export class OpusAudioEncoder {
  private readonly encoder = new opus.OpusEncoder(SAMPLE_RATE, CHANNELS);

  /** Encode de exatamente FRAME_BYTES de PCM para um frame Opus. */
  encode(pcm: Buffer): Buffer {
    return this.encoder.encode(pcm);
  }
}
