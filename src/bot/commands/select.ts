import { SlashCommandBuilder, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { getOrCreateSession } from '../../state/user-session.js';
import { setConnectionMuted } from './join.js';

export const data = new SlashCommandBuilder()
  .setName('select')
  .setDescription('Seleciona a fonte de áudio a ser transmitida')
  .addSubcommand((sub) =>
    sub
      .setName('system')
      .setDescription('Áudio do sistema (todo o PC)')
  )
  .addSubcommand((sub) =>
    sub
      .setName('app')
      .setDescription('Áudio de um aplicativo específico (em breve)')
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'Este comando só pode ser usado em um servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const session = getOrCreateSession(interaction.user.id, interaction.guildId);

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'app') {
    await interaction.reply({
      content: 'Captura por aplicativo está planejada para o Stage 2. Por enquanto use `/select system`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // subcommand === 'system'
  const needsRestart = session.isPlaying && session.selectedSource !== 'system';

  session.selectedSource = 'system';
  session.selectedSourceId = null;

  if (needsRestart) {
    // Troca de fonte em tempo de execução: para a atual antes de selecionar a nova
    if (session.connection) {
      setConnectionMuted(session.connection, true);
    }
    session.player.stop();
    session.capturer?.stop();
    session.capturer = null;
    session.isPlaying = false;
  }

  await interaction.reply({
    content: 'Fonte selecionada: **áudio do sistema**. Use `/play` para começar.',
    flags: MessageFlags.Ephemeral,
  });
}
