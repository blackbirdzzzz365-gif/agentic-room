import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";

import { fetchJson } from "@/lib/api";
import type { RoomSnapshot } from "@/types";
import { Button } from "@/components/ui/button";
import RoomDetailClient from "./room-detail-client";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;
  const room = await fetchJson<RoomSnapshot>(`/api/rooms/${roomId}`);
  return { title: room?.name ?? "Room" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const room = await fetchJson<RoomSnapshot>(`/api/rooms/${roomId}`);

  if (!room) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
        <p className="text-lg font-semibold text-foreground">Room not found</p>
        <p className="text-sm text-muted-foreground">
          The room you are looking for does not exist or has been removed.
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
