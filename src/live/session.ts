import type {
  LiveChannelInfo,
  ClientHelloMessage,
  SketchEventMessage,
  ServerReadyMessage,
} from './types';
import {
  LIVE_PROTOCOL_VERSION,
  LIVE_CHANNEL_PREFIX,
  LIVE_CHANNEL_SUFFIX,
  LIVE_EVENT_CACHE_SIZE,
} from './types';

export interface LiveSession {
  sketchId: string;
  revision: number;
  events: CachedEvent[];
}

export interface CachedEvent {
  revision: number;
  message: SketchEventMessage;
}

export function createLiveChannel(sketchId: string): LiveChannelInfo {
  return {
    sketchId,
    channel: `${LIVE_CHANNEL_PREFIX}:${sketchId}:${LIVE_CHANNEL_SUFFIX}`,
    protocolVersion: LIVE_PROTOCOL_VERSION,
  };
}

export function createLiveSession(sketchId: string): LiveSession {
  return {
    sketchId,
    revision: 0,
    events: [],
  };
}

export function nextRevision(session: LiveSession): number {
  session.revision += 1;
  return session.revision;
}

export function recordEvent(session: LiveSession, message: SketchEventMessage): void {
  session.events.push({ revision: message.revision, message });
  while (session.events.length > LIVE_EVENT_CACHE_SIZE) {
    session.events.shift();
  }
}

export function canReplayFrom(session: LiveSession, fromRevision: number): boolean {
  if (session.events.length === 0) return false;
  return session.events[0].revision <= fromRevision + 1;
}

export function getReplayableEvents(
  session: LiveSession,
  afterRevision: number,
): SketchEventMessage[] {
  return session.events
    .filter(e => e.revision > afterRevision)
    .map(e => e.message);
}

export function acceptWriter(hello: ClientHelloMessage): ServerReadyMessage {
  const accepted = hello.protocolVersion === LIVE_PROTOCOL_VERSION;
  return {
    type: 'server.ready',
    sketchId: hello.sketchId,
    accepted,
    protocolVersion: LIVE_PROTOCOL_VERSION,
    requiredSnapshot: accepted,
  };
}

export function resetSession(session: LiveSession): void {
  session.revision = 0;
  session.events = [];
}
