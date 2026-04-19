import type { RoomEvent } from "@agentic-room/contracts";
import { computeEventHash } from "./hash.js";
import { ledgerGenesisHash } from "./store.js";

export type VerificationResult = {
  ok: boolean;
  errors: string[];
};

export function verifyEventChain(events: RoomEvent[]): VerificationResult {
  const errors: string[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedSeq = index;
    const expectedPrevHash = index === 0 ? ledgerGenesisHash : events[index - 1]?.hash;
    const expectedHash = computeEventHash({
      roomId: event.roomId,
      seq: event.seq,
      eventType: event.eventType,
      actorId: event.actorId,
      payload: event.payload,
      timestamp: event.timestamp,
      prevHash: event.prevHash
    });

    if (event.seq !== expectedSeq) {
      errors.push(`Sequence mismatch at index ${index}: expected ${expectedSeq}, received ${event.seq}`);
    }

    if (event.prevHash !== expectedPrevHash) {
      errors.push(
        `prev_hash mismatch at seq ${event.seq}: expected ${expectedPrevHash}, received ${event.prevHash}`
      );
    }

    if (event.hash !== expectedHash) {
      errors.push(`Hash mismatch at seq ${event.seq}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
