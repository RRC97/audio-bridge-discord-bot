export interface Config {
  token: string;
  clientId: string;
  guildId: string;
  logLevel: string;
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  }
  return value;
}

export function loadConfig(): Config {
  return {
    token: required('DISCORD_TOKEN', process.env.DISCORD_TOKEN),
    clientId: required('DISCORD_CLIENT_ID', process.env.DISCORD_CLIENT_ID),
    guildId: required('DISCORD_GUILD_ID', process.env.DISCORD_GUILD_ID),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}
