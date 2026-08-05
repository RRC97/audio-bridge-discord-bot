import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { createAudioResource, StreamType } from '@discordjs/voice';
import { createCapturer } from '../../audio/capturer.js';
import { createOpusStream } from '../../audio/streamer.js';
import { logger } from '../../utils/logger.js';
import { ensureVoiceConnection, setConnectionMuted } from './join.js';
import type { AudioCapturer } from '../../audio/types.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Inicia ou retoma o streaming de áudio');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const result = await ensureVoiceConnection(interaction);
  if (!result) return;

  const { connection, session } = result;

  // Primeira utilização: o padrão é o áudio do sistema. Uma fonte já
  // selecionada anteriormente continua sendo usada.
  if (!session.selectedSource) {
    session.selectedSource = 'system';
    session.selectedSourceId = null;
    logger.info({ userId: interaction.user.id }, 'Nenhuma fonte selecionada; usando áudio do sistema');
  }

  if (session.isPlaying) {
    await interaction.editReply(
      'O áudio já está tocando.',
    );
    return;
  }

  if (session.player.state.status === 'paused') {
    setConnectionMuted(connection, false);
    session.player.unpause();
    session.isPlaying = true;
    await interaction.editReply(
      'Streaming retomado.',
    );
    return;
  }

  let capturer: AudioCapturer | null = null;

  try {
    capturer = createCapturer(session.selectedSource, {
      sourceId: session.selectedSourceId ?? undefined,
    });

    const pcmStream = capturer.start();
    pcmStream.once('data', () => {
      setConnectionMuted(connection, false);
      logger.info({ userId: interaction.user.id }, 'Primeiro bloco PCM recebido; transmissão desmutada');
    });
    const opusStream = createOpusStream(pcmStream);
    const resource = createAudioResource(opusStream, {
      // createOpusStream já entrega pacotes Opus completos. StreamType.Raw
      // representa PCM e faria uma segunda codificação, gerando áudio inválido.
      inputType: StreamType.Opus,
    });

    session.capturer = capturer;
    session.player.play(resource);
    session.isPlaying = true;

    const onPlayerStateChange = (oldState: { status: string }, newState: { status: string }): void => {
      logger.info(
        { userId: interaction.user.id, oldStatus: oldState.status, status: newState.status },
        'AudioPlayer estado alterado',
      );
    };
    session.player.on('stateChange', onPlayerStateChange);

    session.player.once('idle', () => {
      session.player.off('stateChange', onPlayerStateChange);
      session.isPlaying = false;
      setConnectionMuted(connection, true);
      if (session.capturer === capturer) {
        session.capturer = null;
      }
      capturer?.stop();
    });

    await interaction.editReply(
      `Transmitindo áudio do **${session.selectedSource}**.`,
    );
  } catch (error) {
    capturer?.stop();
    session.capturer = null;
    setConnectionMuted(connection, true);
    logger.error({ err: error, userId: interaction.user.id }, 'Falha ao iniciar streaming');
    await interaction.editReply(
      'Falha ao iniciar o streaming de áudio.',
    );
  }
}
