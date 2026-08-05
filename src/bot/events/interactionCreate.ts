import { Events, MessageFlags, type Client, type ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../../utils/logger.js';
import type { Command } from '../client.js';

async function handleInteraction(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command: Command | undefined = client.commands.get(interaction.commandName);
  if (!command) {
    logger.warn({ command: interaction.commandName }, 'Comando não encontrado');
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error({ err: error, command: interaction.commandName }, 'Erro ao executar comando');
    const reply = {
      content: 'Ocorreu um erro ao executar este comando.',
      flags: MessageFlags.Ephemeral,
    } as const;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}

export function registerEvents(client: Client): void {
  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(client, interaction as ChatInputCommandInteraction);
  });

  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Bot online como ${readyClient.user.tag}`);
  });
}
