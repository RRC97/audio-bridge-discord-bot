import { SlashCommandBuilder, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { getSession } from '../../state/user-session.js';
import { setConnectionMuted } from './join.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pausa o streaming de áudio');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const session = getSession(interaction.user.id);

  if (!session?.connection) {
    await interaction.reply({
      content: 'Use `/play` para eu entrar no canal e começar a transmitir.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!session.isPlaying) {
    await interaction.reply({
      content: 'Nenhum áudio tocando no momento.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  session.player.pause();
  setConnectionMuted(session.connection, true);
  session.isPlaying = false;

  await interaction.reply({
    content: 'Streaming pausado.',
    flags: MessageFlags.Ephemeral,
  });
}
