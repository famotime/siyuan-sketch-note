import { describe, it, expect } from 'vitest';
import {
  createLiveChannel,
  createLiveSession,
  acceptWriter,
  nextRevision,
  recordEvent,
  canReplayFrom,
  getReplayableEvents,
  resetSession,
} from './session';
import type { SketchEventMessage, ClientHelloMessage } from './types';

describe('createLiveChannel', () => {
  it('按规则生成频道名', () => {
    const info = createLiveChannel('abc-123');
    expect(info.channel).toBe('sketch:abc-123:live');
    expect(info.sketchId).toBe('abc-123');
    expect(info.protocolVersion).toBe(1);
  });
});

describe('createLiveSession', () => {
  it('初始 revision 为 0', () => {
    const session = createLiveSession('sk-1');
    expect(session.revision).toBe(0);
    expect(session.events).toHaveLength(0);
    expect(session.sketchId).toBe('sk-1');
  });
});

describe('nextRevision', () => {
  it('单调递增', () => {
    const session = createLiveSession('sk-1');
    expect(nextRevision(session)).toBe(1);
    expect(nextRevision(session)).toBe(2);
    expect(nextRevision(session)).toBe(3);
  });
});

describe('recordEvent', () => {
  it('记录事件并保留 revision', () => {
    const session = createLiveSession('sk-1');
    nextRevision(session);
    const msg: SketchEventMessage = {
      type: 'sketch.event',
      sketchId: 'sk-1',
      revision: 1,
      event: { type: 'stroke', id: 're-1', timestamp: Date.now(), stroke: { id: 's1', points: [], color: '#000', width: 2, tool: 'pen' } },
    };
    recordEvent(session, msg);
    expect(session.events).toHaveLength(1);
    expect(session.events[0].revision).toBe(1);
  });

  it('超过缓存上限时丢弃最旧事件', () => {
    const session = createLiveSession('sk-1');
    for (let i = 0; i < 502; i++) {
      nextRevision(session);
      recordEvent(session, {
        type: 'sketch.event',
        sketchId: 'sk-1',
        revision: i + 1,
        event: { type: 'stroke', id: `re-${i}`, timestamp: Date.now(), stroke: { id: `s${i}`, points: [], color: '#000', width: 2, tool: 'pen' } },
      });
    }
    expect(session.events.length).toBeLessThanOrEqual(500);
  });
});

describe('canReplayFrom / getReplayableEvents', () => {
  it('能补发从指定 revision 之后的事件', () => {
    const session = createLiveSession('sk-1');
    for (let i = 0; i < 5; i++) {
      nextRevision(session);
      recordEvent(session, {
        type: 'sketch.event',
        sketchId: 'sk-1',
        revision: i + 1,
        event: { type: 'stroke', id: `re-${i}`, timestamp: Date.now(), stroke: { id: `s${i}`, points: [], color: '#000', width: 2, tool: 'pen' } },
      });
    }
    expect(canReplayFrom(session, 3)).toBe(true);
    const events = getReplayableEvents(session, 3);
    expect(events).toHaveLength(2);
    expect(events[0].revision).toBe(4);
    expect(events[1].revision).toBe(5);
  });

  it('请求的 revision 太旧时返回 false', () => {
    const session = createLiveSession('sk-1');
    for (let i = 0; i < 5; i++) {
      nextRevision(session);
      recordEvent(session, {
        type: 'sketch.event',
        sketchId: 'sk-1',
        revision: i + 1,
        event: { type: 'stroke', id: `re-${i}`, timestamp: Date.now(), stroke: { id: `s${i}`, points: [], color: '#000', width: 2, tool: 'pen' } },
      });
    }
    session.events = session.events.slice(3);
    expect(canReplayFrom(session, 1)).toBe(false);
  });
});

describe('acceptWriter', () => {
  it('接受协议版本匹配的 writer', () => {
    const hello: ClientHelloMessage = {
      type: 'client.hello',
      clientId: 'mobile-1',
      sketchId: 'sk-1',
      role: 'writer',
      protocolVersion: 1,
    };
    const result = acceptWriter(hello);
    expect(result.accepted).toBe(true);
  });

  it('拒绝协议版本不匹配的 writer', () => {
    const hello = {
      type: 'client.hello' as const,
      clientId: 'mobile-1',
      sketchId: 'sk-1',
      role: 'writer' as const,
      protocolVersion: 99 as 1,
    };
    const result = acceptWriter(hello);
    expect(result.accepted).toBe(false);
  });
});

describe('resetSession', () => {
  it('清空事件和 revision', () => {
    const session = createLiveSession('sk-1');
    nextRevision(session);
    recordEvent(session, {
      type: 'sketch.event',
      sketchId: 'sk-1',
      revision: 1,
      event: { type: 'stroke', id: 're-1', timestamp: Date.now(), stroke: { id: 's1', points: [], color: '#000', width: 2, tool: 'pen' } },
    });
    resetSession(session);
    expect(session.revision).toBe(0);
    expect(session.events).toHaveLength(0);
  });
});
