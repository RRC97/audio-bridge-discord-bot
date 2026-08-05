import {
  SlashCommandBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type VoiceChannel,
} from 'discord.js';
import {
  joinVoiceChannel,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus,
  type VoiceConnection,
} from '@discordjs/voice';
import { getOrCreateSession, type UserSession } from '../../state/user-session.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Faz o bot entrar no seu canal de voz');

interface VoiceJoinResult {
  connection: VoiceConnection;
  session: UserSession;
  voiceChannel: VoiceChannel;
}

const observedConnections = new WeakSet<VoiceConnection>();

function observeConnection(connection: VoiceConnection, userId: string, session: UserSession): void {
  if (observedConnections.has(connection)) return;
  observedConnections.add(connection);

  connection.on('stateChange', (oldState, newState) => {
    logger.info(
      { userId, oldStatus: oldState.status, status: newState.status },
      `VoiceConnection estado: ${oldState.status} → ${newState.status}`,
    );
  });

  connection.on('error', (error) => {
    logger.error({ err: error, userId }, 'Erro interno na conexão de voz');
  });

  if (process.env.VOICE_DEBUG === 'true') {
    connection.on('debug', (message) => {
      logger.debug({ userId }, message);
    });
  }

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
      }
      if (session.connection === connection) {
        session.connection = null;
        session.voiceChannelId = null;
        session.capturer?.stop();
        session.capturer = null;
        session.isPlaying = false;
      }
      logger.info({ userId: session.userId }, 'Desconectado do canal de voz');
    }
  });
}

export function setConnectionMuted(connection: VoiceConnection, muted: boolean): void {
  if (connection.state.status !== VoiceConnectionStatus.Ready) return;
  if (connection.joinConfig.selfMute === muted) return;

  if (!connection.rejoin({
    channelId: connection.joinConfig.channelId,
    selfMute: muted,
    selfDeaf: true,
  })) {
    logger.warn({ muted }, 'Não foi possível atualizar o mute da conexão de voz');
  }
}

export async function ensureVoiceConnection(
  interaction: ChatInputCommandInteraction,
): Promise<VoiceJoinResult | null> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'Este comando só pode ser usado em um servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  const member = interaction.member;
  const voiceChannel = member.voice.channel as VoiceChannel | null;

  if (!voiceChannel) {
    await interaction.reply({
      content: 'Você precisa estar em um canal de voz primeiro.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  const guildId = voiceChannel.guild.id;
  const session = getOrCreateSession(interaction.user.id, guildId);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let connection: VoiceConnection | null = null;

  try {
    const existing = getVoiceConnection(guildId);
    const sameChannel = existing?.joinConfig.channelId === voiceChannel.id;
    const voiceConnection = existing && sameChannel
      ? existing
      : joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          // O bot apenas transmite; não recebe o áudio da call.
          selfDeaf: true,
          selfMute: true,
          debug: process.env.VOICE_DEBUG === 'true',
        });
    connection = voiceConnection;

    observeConnection(voiceConnection, interaction.user.id, session);

    if (voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
      await entersState(voiceConnection, VoiceConnectionStatus.Ready, 15_000);
    }

    voiceConnection.subscribe(session.player);
    session.connection = voiceConnection;
    session.voiceChannelId = voiceChannel.id;
    setConnectionMuted(voiceConnection, true);

    return { connection: voiceConnection, session, voiceChannel };
  } catch (error) {
    const status = connection?.state.status ?? 'unknown';
    logger.error(
      { err: error, userId: interaction.user.id, status },
      'Falha ao entrar no canal de voz',
    );

    if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
    }
    if (session.connection === connection) {
      session.connection = null;
      session.voiceChannelId = null;
    }

    await interaction.editReply(
      'Falha ao completar a conexão de voz. Verifique as permissões **Conectar** e **Falar** e se a hospedagem/firewall permite tráfego UDP.',
    );
    return null;
  }
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const result = await ensureVoiceConnection(interaction);
  if (!result) return;

  await interaction.editReply(
    `Conectado ao canal **${result.voiceChannel.name}**. Use \`/play\` para transmitir.`,
  );
}
