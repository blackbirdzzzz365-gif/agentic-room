import { randomUUID } from "node:crypto";
import type { RoomEvent, RoomEventType } from "@agentic-room/contracts";
import { computeEventHash } from "@agentic-room/ledger";

export function makeRoomEventFixture(input: {
  roomId?: string;
  seq: number;
  eventType: RoomEventType;
  actorId?: string;
  payload?: Record<string, unknown>;
  prevHash?: string;
  timestamp?: string;
}): RoomEvent {
  const roomId = input.roomId ?? randomUUID();
  const actorId = input.actorId ?? "system";
  const payload = input.payload ?? {};
  const timestamp = input.timestamp ?? new Date(2026, 0, 1, 0, 0, input.seq).toISOString();
  const prevHash = input.prevHash ?? "GENESIS";
  const hash = computeEventHash({
    roomId,
    seq: input.seq,
    eventType: input.eventType,
    actorId,
    payload,
    timestamp,
    prevHash
  });

  return {
    id: randomUUID(),
    roomId,
    seq: input.seq,
    eventType: input.eventType,
    actorId,
    payload,
    timestamp,
    prevHash,
    hash
  };
}
