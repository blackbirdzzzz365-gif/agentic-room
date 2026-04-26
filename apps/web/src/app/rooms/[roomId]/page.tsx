import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";

import { fetchJson } from "@/lib/api";
import { normalizeRoomSnapshot } from "@/lib/room-adapters";
import { Button } from "@/components/ui/button";
import RoomDetailClient from "./room-detail-client";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;
  const payload = await fetchJson<unknown>(`/api/rooms/${roomId}`);
  const room = normalizeRoomSnapshot(payload);
  return { title: room?.name ?? "Room" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const payload = await fetchJson<unknown>(`/api/rooms/${roomId}`);
  const room = normalizeRoomSnapshot(payload);

  if (!room) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
        <p className="text-lg font-semibold text-foreground">Room unavailable</p>
        <p className="text-sm text-muted-foreground">
          The room snapshot could not be loaded from the API or does not exist.
        </p>
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/rooms">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Rooms
          </Link>
        </Button>
      </main>
    );
  }

  return <RoomDetailClient room={room} />;
}
