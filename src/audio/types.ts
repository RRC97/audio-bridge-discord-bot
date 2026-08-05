export type AudioSourceType = 'system' | 'application' | 'browser-tab';

export interface AudioSource {
  id: string;
  name: string;
  type: AudioSourceType;
}

export interface CapturerOptions {
  sourceId?: string;
}

export interface AudioCapturer {
  readonly sourceType: AudioSourceType;
  readonly sourceId?: string;

  /** Stage 2+: lista fontes de áudio disponíveis (apps rodando) */
  listSources?(): Promise<AudioSource[]>;

  /** Inicia captura e retorna stream Readable de PCM s16le 48kHz stereo */
  start(): NodeJS.ReadableStream;

  /** Para captura e mata processo nativo */
  stop(): void;
}
