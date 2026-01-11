"use client";

import { useEffect, useMemo, useState } from "react";
import type { Cam, CamFile } from "../../lib/types";
import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CamKind = "youtube" | "hls" | "web";

const DEFAULT_DWELL_SEC = Number(
  process.env.NEXT_PUBLIC_DEFAULT_DWELL_SEC ?? 90
);

function normalizeId(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

export default function AdminPage() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "saving" | "error" | "ok"
  >("idle");
  const [message, setMessage] = useState<string>("");

  const [camFile, setCamFile] = useState<CamFile | null>(null);

  // Modal open state
  const [open, setOpen] = useState(false);

  // Are we editing an existing cam?
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [originalId, setOriginalId] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Cam | null>(null);

  // Form state (one cam per submission)
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CamKind>("youtube");
  const [url, setUrl] = useState("");
  const [dwellSec, setDwellSec] = useState<string>(String(DEFAULT_DWELL_SEC));
  const [attribution, setAttribution] = useState("");

  const cams = useMemo(() => camFile?.cams ?? [], [camFile]);

  async function load() {
    setStatus("loading");
    setMessage("Loading…");

    try {
      const res = await fetch("/api/cams", { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text();
        setStatus("error");
        setMessage(`Load failed (${res.status}): ${t}`);
        return;
      }

      const data = (await res.json()) as CamFile;
      setCamFile(data);
      setStatus("ok");
      setMessage(`Loaded ${data.cams?.length ?? 0} cam(s).`);
    } catch (e: any) {
      setStatus("error");
      setMessage(`Load error: ${String(e?.message ?? e)}`);
    }
  }

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = useMemo(() => {
    const idOk = normalizeId(id).length > 0;
    const nameOk = name.trim().length > 0;
    const urlOk = url.trim().length > 0;

    const dwell = Number(dwellSec);
    const dwellOk =
      dwellSec.trim().length === 0 || (!Number.isNaN(dwell) && dwell > 0);

    return idOk && nameOk && urlOk && dwellOk;
  }, [id, name, url, dwellSec]);

  function resetForm(keepKindAndDwell = true) {
    setId("");
    setName("");
    setUrl("");
    setAttribution("");
    setOriginalId(null);
    setMode("add");
    if (!keepKindAndDwell) {
      setKind("youtube");
      setDwellSec(String(DEFAULT_DWELL_SEC));
    }
  }

  function openAdd() {
    resetForm(true);
    setMode("add");
    setOpen(true);
  }

  function openEdit(cam: Cam) {
    setMode("edit");
    setOriginalId(cam.id);

    setId(cam.id);
    setName(cam.name);
    setKind((cam.kind as CamKind) ?? "youtube");
    setUrl(cam.url);
    setDwellSec(String(cam.dwellSec ?? DEFAULT_DWELL_SEC));
    setAttribution(cam.attribution ?? "");

    setOpen(true);
  }

  async function submitCam() {
    const normalizedId = normalizeId(id);

    const cam: Cam = {
      id: normalizedId,
      name: name.trim(),
      kind,
      url: url.trim(),
      attribution: attribution.trim() || undefined,
      dwellSec: dwellSec.trim() ? Number(dwellSec) : undefined,
    };

    setStatus("saving");
    setMessage(mode === "edit" ? "Saving changes…" : "Saving…");

    try {
      // If editing and the ID changed, remove old ID first to avoid duplicates.
      if (mode === "edit" && originalId && originalId !== normalizedId) {
        const delRes = await fetch(
          `/api/cams?id=${encodeURIComponent(originalId)}`,
          {
            method: "DELETE",
          }
        );
        if (!delRes.ok) {
          const t = await delRes.text();
          setStatus("error");
          setMessage(
            `Could not remove old ID (${originalId}) (${delRes.status}): ${t}`
          );
          return;
        }
      }

      const res = await fetch("/api/cams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cam }),
      });

      if (!res.ok) {
        const t = await res.text();
        setStatus("error");
        setMessage(`Save failed (${res.status}): ${t}`);
        return;
      }

      setStatus("ok");
      setMessage(
        mode === "edit" ? "Updated. Reloading list…" : "Saved. Reloading list…"
      );
      await load();

      resetForm(true);
      setOpen(false);
    } catch (e: any) {
      setStatus("error");
      setMessage(`Save error: ${String(e?.message ?? e)}`);
    }
  }

  function confirmDelete(cam: Cam) {
    setDeleteTarget(cam);
    setDeleteOpen(true);
  }

  async function deleteCam() {
    if (!deleteTarget) return;

    setStatus("saving");
    setMessage(`Deleting "${deleteTarget.name}"…`);

    try {
      const res = await fetch(
        `/api/cams?id=${encodeURIComponent(deleteTarget.id)}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const t = await res.text();
        setStatus("error");
        setMessage(`Delete failed (${res.status}): ${t}`);
        return;
      }

      setStatus("ok");
      setMessage("Deleted. Reloading list…");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      setStatus("error");
      setMessage(`Delete error: ${String(e?.message ?? e)}`);
    }
  }

  const badgeText =
    status === "idle"
      ? "Ready"
      : status === "loading"
      ? "Loading"
      : status === "saving"
      ? "Saving"
      : status === "ok"
      ? "OK"
      : "Error";

  return (
    <main className="h-dvh overflow-hidden bg-zinc-950 text-white">
      <div className="mx-auto flex h-full max-w-5xl flex-col gap-4 p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Admin</h1>
            {message ? (
              <div
                className={
                  status === "error"
                    ? "text-sm text-red-300"
                    : "text-sm text-white/70"
                }
              >
                {message}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/10 text-white">
              {badgeText}
            </Badge>

            <Button
              type="button"
              variant="secondary"
              onClick={() => load()}
              className="bg-white/10 text-white hover:bg-white/15"
            >
              Refresh
            </Button>

            {/* Add/Edit cam modal */}
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (!v) {
                  // close -> reset edit state
                  resetForm(true);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  onClick={openAdd}
                  className="bg-white text-black hover:bg-white/90"
                >
                  Add cam
                </Button>
              </DialogTrigger>

              <DialogContent className="border-white/10 bg-zinc-950 text-white">
                <DialogHeader>
                  <DialogTitle>
                    {mode === "edit" ? "Edit cam" : "Add a cam"}
                  </DialogTitle>
                  <DialogDescription className="text-white/60">
                    {mode === "edit"
                      ? "Update this cam’s settings."
                      : "Adds (or replaces) one cam by ID."}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <div className="text-sm text-white/70">ID</div>
                    <Input
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      placeholder="e.g. cornell-feederwatch"
                      className="bg-black/40 border-white/10"
                    />
                    <div className="text-xs text-white/50">
                      Normalized to lowercase/kebab-case on save.
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm text-white/70">Name</div>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Cornell FeederWatch Cam"
                      className="bg-black/40 border-white/10"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm text-white/70">Kind</div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setKind("youtube")}
                        className={
                          kind === "youtube"
                            ? "bg-white text-black hover:bg-white/90"
                            : "bg-white/10 text-white hover:bg-white/15"
                        }
                      >
                        youtube
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setKind("hls")}
                        className={
                          kind === "hls"
                            ? "bg-white text-black hover:bg-white/90"
                            : "bg-white/10 text-white hover:bg-white/15"
                        }
                      >
                        hls
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setKind("web")}
                        className={
                          kind === "web"
                            ? "bg-white text-black hover:bg-white/90"
                            : "bg-white/10 text-white hover:bg-white/15"
                        }
                      >
                        web
                      </Button>
                    </div>
                    <div className="text-xs text-white/50">
                      youtube = embed URL; hls = .m3u8. (Your kiosk page
                      currently supports youtube + hls.)
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm text-white/70">Dwell seconds</div>
                    <Input
                      value={dwellSec}
                      onChange={(e) => setDwellSec(e.target.value)}
                      placeholder={String(DEFAULT_DWELL_SEC)}
                      inputMode="numeric"
                      className="bg-black/40 border-white/10"
                    />
                    <div className="text-xs text-white/50">
                      Optional; defaults to {DEFAULT_DWELL_SEC}.
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm text-white/70">URL</div>
                    <Input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={
                        kind === "youtube"
                          ? "https://www.youtube.com/embed/VIDEO_ID?autoplay=1&mute=1&controls=0&playsinline=1"
                          : kind === "hls"
                          ? "https://example.com/stream.m3u8"
                          : "https://example.com/cam-page"
                      }
                      className="bg-black/40 border-white/10"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm text-white/70">Attribution</div>
                    <Input
                      value={attribution}
                      onChange={(e) => setAttribution(e.target.value)}
                      placeholder="e.g. Cornell Lab Bird Cams"
                      className="bg-black/40 border-white/10"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      resetForm(true);
                      setOpen(false);
                    }}
                    className="bg-white/10 text-white hover:bg-white/15"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="button"
                    disabled={
                      !canSubmit || status === "saving" || status === "loading"
                    }
                    onClick={() => submitCam()}
                    className="bg-white text-black hover:bg-white/90 disabled:opacity-50"
                  >
                    {mode === "edit" ? "Save" : "Add"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete confirmation modal */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogContent className="border-white/10 bg-zinc-950 text-white">
                <DialogHeader>
                  <DialogTitle>Delete cam?</DialogTitle>
                  <DialogDescription className="text-white/60">
                    This will remove{" "}
                    <span className="text-white">
                      {deleteTarget?.name ?? "this cam"}
                    </span>{" "}
                    permanently from
                    <span className="text-white"> cams.json</span>.
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2 sm:gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setDeleteOpen(false);
                      setDeleteTarget(null);
                    }}
                    className="bg-white/10 text-white hover:bg-white/15"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="button"
                    onClick={() => deleteCam()}
                    className="bg-red-500 text-white hover:bg-red-500/90"
                    disabled={status === "saving" || status === "loading"}
                  >
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Cams list */}
        <Card className="flex min-h-0 flex-1 flex-col border-white/10 bg-black/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">Current cams</CardTitle>
              <Badge variant="secondary" className="bg-white/10 text-white">
                {cams.length} total
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="min-h-0 flex-1">
            <ScrollArea className="h-full pr-2">
              {cams.length === 0 ? (
                <div className="text-white/70">
                  No cams yet. Use “Add cam” to create one.
                </div>
              ) : (
                <div className="space-y-2">
                  {cams.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-white/10 bg-black/30 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">
                            {c.name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            id: {c.id}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-white/10 text-white"
                          >
                            {c.kind}
                          </Badge>
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            onClick={() => openEdit(c)}
                            className="h-8 w-8 bg-white/10 text-white hover:bg-white/15"
                            aria-label={`Edit ${c.name}`}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            onClick={() => confirmDelete(c)}
                            className="h-8 w-8 bg-white/10 text-white hover:bg-white/15"
                            aria-label={`Delete ${c.name}`}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2 break-all text-sm text-white/80">
                        {c.url}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
                        <span>dwell: {c.dwellSec ?? DEFAULT_DWELL_SEC}s</span>
                        {c.attribution ? <span>• {c.attribution}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
