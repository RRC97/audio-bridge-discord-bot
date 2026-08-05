import { Collection, type Client } from 'discord.js';
import type { Command } from '../client.js';
import * as join from './join.js';
import * as leave from './leave.js';
import * as play from './play.js';
import * as pause from './pause.js';
import * as select from './select.js';

const commands: Command[] = [
  join,
  leave,
  play,
  pause,
  select,
];

export function registerCommands(client: Client): void {
  client.commands = new Collection<string, Command>();
  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }
}

export function getCommandData() {
  return commands.map((command) => command.data.toJSON());
}
