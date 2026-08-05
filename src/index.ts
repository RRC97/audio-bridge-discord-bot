import 'dotenv/config';
import { loadConfig } from './config.js';
import { createClient } from './bot/client.js';
import { registerCommands } from './bot/commands/index.js';
import { registerEvents } from './bot/events/interactionCreate.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const client = createClient();
  registerCommands(client);
  registerEvents(client);

  await client.login(config.token);
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Falha ao iniciar o bot');
  process.exit(1);
});
