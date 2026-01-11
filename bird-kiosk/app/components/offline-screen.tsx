"use client";

import { useEffect, useMemo, useState } from "react";
import { TriangleAlert, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { Cam } from "@/lib/types";

export function OfflineScreen({
  cam,
  detail,
  autoSkipSec = 8,
  onSkipNow,
}: {
  cam: Cam | null;
  detail?: string;
  autoSkipSec?: number;
  onSkipNow: () => void;
}) {
  const [left, setLeft] = useState(autoSkipSec);

  useEffect(() => {
    setLeft(autoSkipSec);
    const t = window.setInterval(
      () => setLeft((v) => Math.max(0, v - 1)),
      1000
    );
    return () => window.clearInterval(t);
  }, [autoSkipSec, cam?.id]);

  useEffect(() => {
    if (left <= 0) onSkipNow();
  }, [left, onSkipNow]);

  const title = useMemo(() => cam?.name ?? "This stream", [cam?.name]);

  return (
    <main className="fixed inset-0 grid place-items-center bg-background text-foreground">
      <Card className="w-[min(760px,calc(100%-2rem))] border-border bg-card">
        <CardContent className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <div className="text-xl font-semibold">This stream is offline</div>
            <div className="text-sm text-muted-foreground">
              {title} couldn’t be loaded right now.
            </div>
          </div>

          {cam ? (
            <div className="mx-auto w-full max-w-[680px] space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-left">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">
                    {cam.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    id: {cam.id}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-foreground/5 text-foreground"
                >
                  {cam.kind}
                </Badge>
              </div>

              <div className="break-all text-xs text-muted-foreground">
                {cam.url}
              </div>

              {detail ? (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/90">
                    Details:
                  </span>{" "}
                  {detail}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col items-center gap-2 pt-1">
            <div className="text-sm text-muted-foreground">
              Switching to the next cam in{" "}
              <span className="font-semibold text-foreground">{left}s</span>
            </div>

            <Button onClick={onSkipNow} className="gap-2">
              <SkipForward className="h-4 w-4" />
              Skip now
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
