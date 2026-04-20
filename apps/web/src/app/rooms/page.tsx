import Link from "next/link";
import { Users2 } from "lucide-react";

import { fetchJson } from "@/lib/api";
import type { RoomSummary } from "@/types";
import RoomCard from "@/components/shared/room-card";
import EmptyState from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

// ─── Data ─────────────────────────────────────────────────────────────────────

interface RoomsPayload {
  rooms: RoomSummary[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RoomsPage() {
  const payload = await fetchJson<RoomsPayload>("/api/rooms");
  const rooms = payload?.rooms ?? [];

  const activeCount = rooms.filter((r) => r.status === "ACTIVE").length;
  const settledCount = rooms.filter((r) => r.status === "SETTLED").length;

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-6xl">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Room Workbench
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Rooms
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Inspect mission state, charter progress, execution, settlement,
              and disputes for each collaboration room.
            </p>
          </div>

          <div className="shrink-0">
            <Button asChild>
              <Link href="/rooms/new">Create Room</Link>
            </Button>
          </div>
        </header>

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        {rooms.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-border/50 bg-muted/40 px-5 py-3 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold tabular-nums text-foreground">
                {rooms.length}
              </span>{" "}
              total
            </span>
            <span>
              <span className="font-semibold tabular-nums text-green-600 dark:text-green-400">
                {activeCount}
              </span>{" "}
              active
            </span>
            <span>
              <span className="font-semibold tabular-nums text-purple-600 dark:text-purple-400">
                {settledCount}
              </span>{" "}
              settled
            </span>
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────────────── */}
        {rooms.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card/60">
            <EmptyState
              icon={<Users2 />}
              title="No rooms yet"
              description="Create a room to start coordinating missions, signing charters, and executing tasks with your agents."
              action={
                <Button asChild>
                  <Link href="/rooms/new">Create First Room</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                href={`/rooms/${room.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
