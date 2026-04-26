"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";

import { mutateJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Schema ───────────────────────────────────────────────────────────────────

const createRoomSchema = z.object({
  name: z.string().min(2, "Room name must be at least 2 characters"),
  requesterId: z.string().min(1, "Requester ID is required"),
  coordinatorId: z.string().min(1, "Coordinator ID is required"),
  budgetTotal: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ error: "Budget must be a number" }).positive("Budget must be a positive number")
  ),
  executionDeadlineAt: z
    .string()
    .min(1, "Execution deadline is required"),
});

type CreateRoomFormValues = {
  name: string;
  requesterId: string;
  coordinatorId: string;
  budgetTotal: number;
  executionDeadlineAt: string;
};

// ─── API response shape ───────────────────────────────────────────────────────

interface CreateRoomResponse {
  id: string;
  name: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateRoomPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateRoomFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createRoomSchema) as Resolver<CreateRoomFormValues>,
    defaultValues: {
      name: "",
      requesterId: "",
      coordinatorId: "",
      budgetTotal: undefined,
      executionDeadlineAt: "",
    },
  });

  const onSubmit = async (values: CreateRoomFormValues) => {
    setIsSubmitting(true);
    try {
      const executionDeadlineAt = new Date(
        `${values.executionDeadlineAt}T00:00:00`
      ).toISOString();

      const { data, error } = await mutateJson<CreateRoomResponse>(
        "/api/rooms",
        {
          ...values,
          executionDeadlineAt,
        },
        "POST"
      );

      if (error || !data) {
        toast.error("Failed to create room", {
          description: error ?? "An unexpected error occurred. Please try again.",
        });
        return;
      }

      toast.success("Room created", {
        description: `"${data.name}" is ready for mission intake.`,
      });
      router.push(`/rooms/${data.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl">
        {/* ── Back link ────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/rooms">
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Rooms
            </Link>
          </Button>
        </div>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Create Room
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Define the initial parameters for your collaboration room. You can
            refine the mission and charter after creation.
          </p>
        </div>

        {/* ── Form card ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Room Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="grid gap-6">
                {/* Room Name */}
                <div className="grid gap-2">
                  <Label htmlFor="name">Room Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Q3 Ops Analysis"
                    autoComplete="off"
                    aria-describedby={errors.name ? "name-error" : undefined}
                    {...register("name")}
                  />
                  {errors.name && (
                    <p id="name-error" className="text-xs text-destructive">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Requester ID */}
                <div className="grid gap-2">
                  <Label htmlFor="requesterId">Requester ID</Label>
                  <Input
                    id="requesterId"
                    placeholder="agent:requester-001"
                    autoComplete="off"
                    aria-describedby={
                      errors.requesterId ? "requesterId-error" : undefined
                    }
                    {...register("requesterId")}
                  />
                  {errors.requesterId && (
                    <p
                      id="requesterId-error"
                      className="text-xs text-destructive"
                    >
                      {errors.requesterId.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    The agent or user that initiated this room.
                  </p>
                </div>

                {/* Coordinator ID */}
                <div className="grid gap-2">
                  <Label htmlFor="coordinatorId">Coordinator ID</Label>
                  <Input
                    id="coordinatorId"
                    placeholder="agent:coordinator-001"
                    autoComplete="off"
                    aria-describedby={
                      errors.coordinatorId ? "coordinatorId-error" : undefined
                    }
                    {...register("coordinatorId")}
                  />
                  {errors.coordinatorId && (
                    <p
                      id="coordinatorId-error"
                      className="text-xs text-destructive"
                    >
                      {errors.coordinatorId.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    The agent responsible for orchestrating this room.
                  </p>
                </div>

                {/* Budget Total */}
                <div className="grid gap-2">
                  <Label htmlFor="budgetTotal">Budget Total</Label>
                  <Input
                    id="budgetTotal"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="10000"
                    aria-describedby={
                      errors.budgetTotal ? "budgetTotal-error" : undefined
                    }
                    {...register("budgetTotal")}
                  />
                  {errors.budgetTotal && (
                    <p
                      id="budgetTotal-error"
                      className="text-xs text-destructive"
                    >
                      {errors.budgetTotal.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Total budget pool available for allocation at settlement.
                  </p>
                </div>

                {/* Execution Deadline */}
                <div className="grid gap-2">
                  <Label htmlFor="executionDeadlineAt">
                    Execution Deadline
                  </Label>
                  <Input
                    id="executionDeadlineAt"
                    type="date"
                    aria-describedby={
                      errors.executionDeadlineAt
                        ? "executionDeadlineAt-error"
                        : undefined
                    }
                    {...register("executionDeadlineAt")}
                  />
                  {errors.executionDeadlineAt && (
                    <p
                      id="executionDeadlineAt-error"
                      className="text-xs text-destructive"
                    >
                      {errors.executionDeadlineAt.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Target date for task execution completion.
                  </p>
                </div>

                {/* Submit */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="gap-2"
                  >
                    {isSubmitting && (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    )}
                    {isSubmitting ? "Creating…" : "Create Room"}
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/rooms">Cancel</Link>
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
