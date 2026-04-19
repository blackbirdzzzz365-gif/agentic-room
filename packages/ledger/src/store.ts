import { randomUUID } from "node:crypto";
import type { Pool, QueryResult } from "pg";
import type { RoomEvent, RoomEventType } from "@agentic-room/contracts";
import { computeEventHash } from "./hash.js";

const GENESIS_HASH = "GENESIS";

type EventRecord = {
  id: string;
  room_id: string;
  seq: number;
  event_type: string;
  actor_id: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  prev_hash: string;
  hash: string;
};

function mapEventRow(row: EventRecord): RoomEvent {
  return {
    id: row.id,
    roomId: row.room_id,
    seq: row.seq,
    eventType: row.event_type as RoomEventType,
    actorId: row.actor_id,
    payload: row.payload,
    timestamp: row.timestamp.toISOString(),
    prevHash: row.prev_hash,
    hash: row.hash
  };
}

export async function appendRoomEvent(
  client: Pick<Pool, "query">,
  input: {
    roomId: string;
    eventType: RoomEventType;
    actorId: string;
    payload: Record<string, unknown>;
  }
) {
  const previous = await client.query<Pick<EventRecord, "seq" | "hash">>(
    `
      SELECT seq, hash
      FROM room_events
      WHERE room_id = $1
      ORDER BY seq DESC
      LIMIT 1
      FOR UPDATE
    `,
    [input.roomId]
  );

  const last = previous.rows[0];
  const nextSeq = (last?.seq ?? -1) + 1;
  const prevHash = last?.hash ?? GENESIS_HASH;
  const timestamp = new Date().toISOString();
  const id = randomUUID();
  const hash = computeEventHash({
    roomId: input.roomId,
    seq: nextSeq,
    eventType: input.eventType,
    actorId: input.actorId,
    payload: input.payload,
    timestamp,
    prevHash
  });

  const insert = await client.query<EventRecord>(
    `
      INSERT INTO room_events (
        id, room_id, seq, event_type, actor_id, payload, timestamp, prev_hash, hash
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
      RETURNING *
    `,
    [id, input.roomId, nextSeq, input.eventType, input.actorId, JSON.stringify(input.payload), timestamp, prevHash, hash]
  );

  return mapEventRow(insert.rows[0]);
}

export async function fetchRoomEvents(client: Pick<Pool, "query">, roomId: string) {
  const result = await client.query<EventRecord>(
    `
      SELECT *
      FROM room_events
      WHERE room_id = $1
      ORDER BY seq ASC
    `,
    [roomId]
  );
  return result.rows.map(mapEventRow);
}

export const ledgerGenesisHash = GENESIS_HASH;
