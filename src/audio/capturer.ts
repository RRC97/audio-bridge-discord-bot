import { logger } from '../utils/logger.js';
import { LinuxSystemCapturer } from './sources/linux-system.js';
import { WindowsSystemCapturer } from './sources/windows-system.js';
import type { AudioCapturer, AudioSource, AudioSourceType, CapturerOptions } from './types.js';

/**
 * Factory que cria o capturador correto por plataforma e tipo de fonte.
 */
export function createCapturer(type: AudioSourceType, options: CapturerOptions = {}): AudioCapturer {
  switch (process.platform) {
    case 'linux':
      return createLinuxCapturer(type, options);
    case 'win32':
      return createWindowsCapturer(type, options);
    default:
      throw new Error(`Plataforma não suportada para captura de áudio: ${process.platform}`);
  }
}

function createLinuxCapturer(type: AudioSourceType, _options: CapturerOptions): AudioCapturer {
  switch (type) {
    case 'system':
      return new LinuxSystemCapturer();
    case 'application':
      throw new Error('Captura por aplicativo no Linux ainda não implementada (Stage 2)');
    case 'browser-tab':
      throw new Error('Captura de aba do navegador ainda não implementada (Stage 3)');
    default:
      throw new Error(`Tipo de fonte desconhecido: ${type}`);
  }
}

function createWindowsCapturer(type: AudioSourceType, _options: CapturerOptions): AudioCapturer {
  switch (type) {
    case 'system':
      return new WindowsSystemCapturer();
    case 'application':
      throw new Error('Captura por aplicativo no Windows ainda não implementada (Stage 2)');
    case 'browser-tab':
      throw new Error('Captura de aba do navegador ainda não implementada (Stage 3)');
    default:
      throw new Error(`Tipo de fonte desconhecido: ${type}`);
  }
}

/**
 * Helper para expor fontes disponíveis (usado pelo /select no Stage 2).
 * Retorna lista vazia caso a fonte não suporte listagem.
 */
export async function listSources(type: AudioSourceType): Promise<AudioSource[]> {
  const capturer = createCapturer(type);
  if (!capturer.listSources) {
    return [];
  }
  try {
    return await capturer.listSources();
  } catch (err) {
    logger.error({ err, type }, 'Falha ao listar fontes');
    return [];
  }
}
