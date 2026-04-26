import { Skeleton } from "@/components/ui/skeleton";

export default function RoomDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-36" />
      <div className="space-y-3">
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-14 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
