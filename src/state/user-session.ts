import {
  type VoiceConnection,
  type AudioPlayer,
  createAudioPlayer,
  NoSubscriberBehavior,
} from '@discordjs/voice';
import type { AudioCapturer, AudioSourceType } from '../audio/types.js';

export interface UserSession {
  userId: string;
  guildId: string;
  voiceChannelId: string | null;
  connection: VoiceConnection | null;
  player: AudioPlayer;
  capturer: AudioCapturer | null;
  selectedSource: AudioSourceType | null;
  selectedSourceId: string | null;
  isPlaying: boolean;
}

const sessions = new Map<string, UserSession>();

export function createSession(userId: string, guildId: string): UserSession {
  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
      // A fonte é um stream ao vivo; não deve parar por uma pequena lacuna
      // entre dois blocos PCM.
      maxMissedFrames: 250,
    },
  });

  const session: UserSession = {
    userId,
    guildId,
    voiceChannelId: null,
    connection: null,
    player,
    capturer: null,
    selectedSource: null,
    selectedSourceId: null,
    isPlaying: false,
  };

  sessions.set(userId, session);
  return session;
}

export function getSession(userId: string): UserSession | undefined {
  return sessions.get(userId);
}

export function getOrCreateSession(userId: string, guildId: string): UserSession {
  const existing = sessions.get(userId);
  if (existing) {
    return existing;
  }
  return createSession(userId, guildId);
}

export function hasSession(userId: string): boolean {
  return sessions.has(userId);
}

export function removeSession(userId: string): void {
  sessions.delete(userId);
}

export function cleanupSession(session: UserSession): void {
  session.capturer?.stop();
  session.player.stop();
  session.connection?.destroy();

  session.connection = null;
  session.capturer = null;
  session.isPlaying = false;
  session.voiceChannelId = null;
}
