import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { PermissionsBitField } from 'discord.js';
import { loadConfig } from '../config.js';
import { logger } from '../utils/logger.js';

const PERMISSIONS = [
  'ViewChannel',
  'SendMessages',
  'Connect',
  'Speak',
] as const;

const SCOPES = ['bot', 'applications.commands'];

function invite(): void {
  const config = loadConfig();

  const permissions = new PermissionsBitField([...PERMISSIONS]);

  const params = new URLSearchParams({
    client_id: config.clientId,
    permissions: permissions.bitfield.toString(),
    scope: SCOPES.join(' '),
  });

  const url = `https://discord.com/oauth2/authorize?${params.toString()}`;

  // Grava num arquivo para abrir sem risco de cópia corrompida
  writeFileSync('INVITE.txt', `${url}\n`, 'utf8');

  logger.info(`Permissões solicitadas: ${PERMISSIONS.join(', ')}`);
  logger.info(`Scopes: ${SCOPES.join(', ')}`);
  logger.info(`Link salvo em INVITE.txt. Abra no navegador:`);
  console.log(url);
}

invite();
