"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TriangleAlert } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = "/";
    }, 10000);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="fixed inset-0 grid place-items-center bg-background text-foreground">
      <Card className="w-[min(720px,calc(100%-2rem))] border-border bg-card">
        <CardContent className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="h-6 w-6" />
          </div>

          <div className="text-xl font-semibold">Something went wrong</div>

          <div className="text-sm text-muted-foreground">
            This page or stream could not be loaded.
            <br />
            The kiosk will recover automatically.
          </div>

          {error?.message ? (
            <div className="mx-auto max-w-md break-all rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {error.message}
            </div>
          ) : null}

          <div className="flex justify-center gap-2 pt-2">
            <Button variant="secondary" onClick={() => reset()}>
              Try again
            </Button>

            <Button onClick={() => (window.location.href = "/")}>
              Go home
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
