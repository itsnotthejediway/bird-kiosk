"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { CamFile } from "../../lib/types";

function safeJsonParse(
  raw: string
): { ok: true; value: any } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

function validateCamFile(obj: any): string[] {
  const errors: string[] = [];
  if (!obj || typeof obj !== "object") return ["Root must be an object"];
  if (!Array.isArray(obj.cams)) errors.push("Missing or invalid 'cams' array");

  if (Array.isArray(obj.cams)) {
    obj.cams.forEach((c: any, i: number) => {
      if (!c || typeof c !== "object") {
        errors.push(`cams[${i}] must be an object`);
        return;
      }
      if (!c.id || typeof c.id !== "string")
        errors.push(`cams[${i}].id must be a string`);
      if (!c.name || typeof c.name !== "string")
        errors.push(`cams[${i}].name must be a string`);
      if (!c.kind || typeof c.kind !== "string")
        errors.push(`cams[${i}].kind must be a string`);
      if (!c.url || typeof c.url !== "string")
        errors.push(`cams[${i}].url must be a string`);
      if (c.dwellSec != null && typeof c.dwellSec !== "number")
        errors.push(`cams[${i}].dwellSec must be a number`);
    });
  }

  return errors;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "saving" | "error" | "ok"
  >("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("admin_token") ?? "";
    setToken(saved);
  }, []);

  const parseResult = useMemo(() => safeJsonParse(raw), [raw]);
  const validationErrors = useMemo(() => {
    if (!raw.trim()) return [];
    if (!parseResult.ok) return [`Invalid JSON: ${parseResult.error}`];
    return validateCamFile(parseResult.value);
  }, [raw, parseResult]);

  const isValid = validationErrors.length === 0 && raw.trim().length > 0;

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
      setRaw(JSON.stringify(data, null, 2));
      setStatus("ok");
      setMessage("Loaded.");
    } catch (e: any) {
      setStatus("error");
      setMessage(`Load error: ${String(e?.message ?? e)}`);
    }
  }

  async function save() {
    localStorage.setItem("admin_token", token);

    if (!token.trim()) {
      setStatus("error");
      setMessage("Missing admin token.");
      return;
    }

    if (!parseResult.ok) {
      setStatus("error");
      setMessage(`Invalid JSON: ${parseResult.error}`);
      return;
    }

    const errs = validateCamFile(parseResult.value);
    if (errs.length) {
      setStatus("error");
      setMessage("Fix validation errors before saving.");
      return;
    }

    setStatus("saving");
    setMessage("Saving…");

    try {
      const res = await fetch("/api/cams", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(parseResult.value),
      });

      if (!res.ok) {
        const t = await res.text();
        setStatus("error");
        setMessage(`Save failed (${res.status}): ${t}`);
        return;
      }

      setStatus("ok");
      setMessage("Saved. Kiosk will pick up changes within ~5 seconds.");
    } catch (e: any) {
      setStatus("error");
      setMessage(`Save error: ${String(e?.message ?? e)}`);
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
    <main className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <Badge variant="secondary" className="bg-white/10 text-white">
            {badgeText}
          </Badge>
        </div>

        <Card className="border-white/10 bg-black/40">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
              <div className="space-y-1">
                <div className="text-sm text-white/70">Admin token</div>
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter ADMIN_TOKEN"
                  className="bg-black/40 border-white/10"
                />
                <div className="text-xs text-white/50">
                  Stored locally in this browser. Required to save.
                </div>
              </div>

              <Button
                onClick={load}
                variant="secondary"
                className="bg-white/10 text-white hover:bg-white/15"
              >
                Load
              </Button>

              <Button
                onClick={save}
                disabled={
                  !isValid || status === "saving" || status === "loading"
                }
                className="bg-white text-black hover:bg-white/90 disabled:opacity-50"
              >
                Save
              </Button>
            </div>

            {message ? (
              <div className="text-sm text-white/70">
                <span
                  className={
                    status === "error" ? "text-red-300" : "text-white/70"
                  }
                >
                  {message}
                </span>
              </div>
            ) : null}

            {validationErrors.length ? (
              <Card className="border-white/10 bg-black/30">
                <CardContent className="p-3 space-y-2">
                  <div className="text-sm font-semibold">Validation</div>
                  <ul className="text-sm text-white/70 list-disc pl-5 space-y-1">
                    {validationErrors.slice(0, 12).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  {validationErrors.length > 12 ? (
                    <div className="text-xs text-white/50">
                      …and {validationErrors.length - 12} more
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <div className="text-sm text-white/60">
              Edit <code className="text-white/80">cams.json</code>. The kiosk
              polls <code className="text-white/80">/api/cams</code> every ~5
              seconds.
            </div>

            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
              className="min-h-[60vh] bg-black/50 border-white/10 font-mono text-xs text-white/90"
              placeholder='Click "Load" to fetch current cams.json, then edit and "Save".'
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
