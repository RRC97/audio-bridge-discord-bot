import { REST, Routes } from 'discord.js';
import 'dotenv/config';
import { loadConfig } from '../config.js';
import { getCommandData } from './commands/index.js';
import { logger } from '../utils/logger.js';

async function deploy(): Promise<void> {
  const config = loadConfig();

  try {
    const commands = getCommandData();
    const rest = new REST({ version: '10' }).setToken(config.token);

    logger.info(`Registrando ${commands.length} comandos na guild ${config.guildId}...`);

    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands,
    });

    logger.info('Comandos registrados com sucesso.');
  } catch (error) {
    logger.error({ err: error }, 'Falha ao registrar comandos');
    process.exit(1);
  }
}

void deploy();
