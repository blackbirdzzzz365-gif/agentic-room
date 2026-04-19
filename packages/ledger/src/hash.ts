import { createHash } from "node:crypto";

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalizePayload(payload: unknown): string {
  if (Array.isArray(payload)) {
    return "[" + (payload as unknown[]).map(canonicalizePayload).join(",") + "]";
  }
  if (payload !== null && typeof payload === "object") {
    const sorted = Object.keys(payload as object)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonicalizePayload((payload as Record<string, unknown>)[k]))
      .join(",");
    return "{" + sorted + "}";
  }
  return JSON.stringify(payload);
}

export function computeEventHash(input: {
  roomId: string;
  seq: number;
  eventType: string;
  actorId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  prevHash: string;
}) {
  return sha256Hex(
    [
      input.roomId,
      String(input.seq),
      input.eventType,
      input.actorId,
      canonicalizePayload(input.payload),
      input.timestamp,
      input.prevHash
    ].join("|")
  );
}
