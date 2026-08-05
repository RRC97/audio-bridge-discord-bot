import { SlashCommandBuilder, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { getSession, cleanupSession } from '../../state/user-session.js';

export const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Faz o bot sair do canal de voz');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const session = getSession(interaction.user.id);

  if (!session?.connection) {
    await interaction.reply({
      content: 'Não estou conectado a nenhum canal de voz.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  cleanupSession(session);

  await interaction.reply({
    content: 'Desconectado e transmissão parada. A fonte selecionada foi mantida para o próximo `/play`.',
    flags: MessageFlags.Ephemeral,
  });
}
