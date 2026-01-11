"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import type { Cam, CamFile, TelemetryEvent } from "../lib/types";
import { OfflineScreen } from "./components/offline-screen";

const DEFAULT_DWELL_SEC = Number(
  process.env.NEXT_PUBLIC_DEFAULT_DWELL_SEC ?? 90
);
const READY_TIMEOUT_SEC = Number(
  process.env.NEXT_PUBLIC_READY_TIMEOUT_SEC ?? 15
);

// Polling interval for cams.json hot-reload
const CAMS_POLL_MS = 5000;

// A short transition pause when skipping (lets the user see fallback briefly)
const SKIP_PAUSE_MS = 1200;

async function postTelemetry(payload: TelemetryEvent) {
  try {
    await fetch("/api/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // no-op
  }
}

export default function KioskPage() {
  const [camFile, setCamFile] = useState<CamFile | null>(null);
  const [idx, setIdx] = useState(0);

  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [statusDetail, setStatusDetail] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const readyTimerRef = useRef<number | null>(null);
  const dwellTimerRef = useRef<number | null>(null);

  const cams: Cam[] = useMemo(() => camFile?.cams ?? [], [camFile]);
  const cam = useMemo(
    () => (cams.length ? cams[idx % cams.length] : null),
    [cams, idx]
  );

  const cleanupPlayer = useCallback(() => {
    if (readyTimerRef.current) {
      window.clearTimeout(readyTimerRef.current);
      readyTimerRef.current = null;
    }
    if (dwellTimerRef.current) {
      window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // ignore
      }
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, []);

  const markReady = useCallback(async () => {
    if (!cam) return;
    setStatus("ready");
    setStatusDetail("");

    await postTelemetry({
      ts: new Date().toISOString(),
      camId: cam.id,
      camName: cam.name,
      kind: cam.kind,
      event: "ready",
    });
  }, [cam]);

  const skipNext = useCallback(
    async (detail: string) => {
      if (!cam) return;
      setStatus("error");
      setStatusDetail(detail);

      await postTelemetry({
        ts: new Date().toISOString(),
        camId: cam.id,
        camName: cam.name,
        kind: cam.kind,
        event: "skip",
        detail,
      });
    },
    [cam]
  );

  const advance = useCallback(() => {
    cleanupPlayer();
    setStatus("loading");
    setStatusDetail("");
    setIdx((v) => v + 1);
  }, [cleanupPlayer]);

  // Load cams and hot-reload by polling /api/cams
  useEffect(() => {
    let mounted = true;

    async function load() {
      const res = await fetch("/api/cams", { cache: "no-store" });
      const data = (await res.json()) as CamFile;
      if (mounted) setCamFile(data);
    }

    load().catch(() =>
      setCamFile({ version: 1, updatedAt: new Date().toISOString(), cams: [] })
    );

    const t = window.setInterval(() => {
      load().catch(() => {});
    }, CAMS_POLL_MS);

    return () => {
      mounted = false;
      window.clearInterval(t);
    };
  }, []);

  // Whenever cam changes: reset, start timers, emit "load"
  useEffect(() => {
    cleanupPlayer();

    if (!cam) {
      setStatus("loading");
      setStatusDetail("");
      return;
    }

    setStatus("loading");
    setStatusDetail("");

    // NEW: API-provided health gate
    const health = (cam as any).health;
    if (health?.ok === false) {
      skipNext(health.detail || "Stream is offline").catch(() => {});
      return;
    }

    postTelemetry({
      ts: new Date().toISOString(),
      camId: cam.id,
      camName: cam.name,
      kind: cam.kind,
      event: "load",
    }).catch(() => {});

    // If we never become "ready", skip.
    readyTimerRef.current = window.setTimeout(() => {
      skipNext(`Not ready within ${READY_TIMEOUT_SEC}s`).catch(() => {});
    }, READY_TIMEOUT_SEC * 1000);

    // Always rotate after dwell (prevents permanent stuck states).
    const dwellMs = (cam.dwellSec ?? DEFAULT_DWELL_SEC) * 1000;
    console.log(
      "Scheduling dwell skip in ms:",
      dwellMs,
      "cam:",
      cam.id,
      cam.name
    );

    dwellTimerRef.current = window.setTimeout(() => {
      console.log("DWELL TIMER FIRED for cam:", cam.id);
      skipNext(`Dwell reached (${cam.dwellSec ?? DEFAULT_DWELL_SEC}s)`).catch(
        () => {}
      );
    }, dwellMs);

    return () => cleanupPlayer();
  }, [cam?.id, cleanupPlayer, skipNext]);

  // HLS wiring
  useEffect(() => {
    if (!cam || cam.kind !== "hls") return;

    const video = videoRef.current;
    if (!video) return;

    const onPlaying = () => {
      markReady().catch(() => {});
    };
    const onError = () => {
      skipNext("Video element error").catch(() => {});
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);

    (async () => {
      try {
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;

        // Native HLS (rare in Chromium on Pi), but cheap to check:
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = cam.url;
          await video.play();
          return;
        }

        if (!Hls.isSupported()) {
          await skipNext("HLS not supported by this browser");
          return;
        }

        const hls = new Hls({
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        hlsRef.current = hls;

        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(cam.url);
        });

        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            skipNext(`HLS fatal: ${data.type}/${data.details}`).catch(() => {});
          }
        });

        await video.play();
      } catch (e: any) {
        await skipNext(`HLS play failed: ${String(e?.message ?? e)}`);
      }
    })().catch(() => {});

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
    };
  }, [cam, markReady, skipNext]);

  // YouTube "ready" heuristic (iframe doesn't reliably expose play state without the IFrame API)
  useEffect(() => {
    if (!cam || cam.kind !== "youtube") return;
    const t = window.setTimeout(() => {
      markReady().catch(() => {});
    }, 2000);
    return () => window.clearTimeout(t);
  }, [cam, markReady]);

  const statusBadgeLabel =
    status === "loading" ? "Loading" : status === "ready" ? "Playing" : "Issue";

  const overlay = (
    <Card className="fixed bottom-4 left-4 w-[min(520px,calc(100%-2rem))] border-white/10 bg-black/60 text-white backdrop-blur">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate font-semibold">
            {cam?.name ?? "No cams configured"}
          </div>
          <Badge variant="secondary" className="bg-white/10 text-white">
            {statusBadgeLabel}
          </Badge>
        </div>

        {status === "error" ? (
          <div className="text-sm text-white/80 truncate">{statusDetail}</div>
        ) : (
          <div className="text-sm text-white/70 truncate">
            Cycling every {cam?.dwellSec ?? DEFAULT_DWELL_SEC}s
          </div>
        )}

        {cam?.attribution ? (
          <div className="text-xs text-white/60 truncate">
            {cam.attribution}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  const fallback = (
    <>
      <OfflineScreen
        cam={cam}
        detail={statusDetail || "The stream did not become ready."}
        autoSkipSec={8}
        onSkipNow={advance}
      />
      {overlay}
    </>
  );

  if (!cam) {
    return (
      <main className="fixed inset-0 grid place-items-center bg-black text-white">
        <Card className="w-[min(720px,calc(100%-2rem))] border-white/10 bg-black/60 text-white backdrop-blur">
          <CardContent className="p-6 space-y-2 text-center">
            <div className="text-xl font-semibold">No cams configured</div>
            <div className="text-sm text-white/80">
              Go to <span className="font-mono">/admin</span> to add cams.
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      {status === "error" ? (
        fallback
      ) : cam.kind === "youtube" ? (
        <>
          <iframe
            key={cam.id}
            src={cam.url}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
          {overlay}
        </>
      ) : (
        <>
          <video
            key={cam.id}
            ref={videoRef}
            muted
            autoPlay
            playsInline
            controls={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {overlay}
        </>
      )}
    </main>
  );
}
