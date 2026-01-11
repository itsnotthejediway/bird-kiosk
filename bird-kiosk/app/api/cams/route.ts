import { lookup } from "node:dns/promises";
import type { Cam, CamFile } from "../../../lib/types";
import { readCamsFileCached, writeCamsFile } from "../../../lib/cams";

type CamHealth = {
  ok: boolean;
  checkedAt: string;
  detail?: string;
};

type CamWithHealth = Cam & { health?: CamHealth };
type CamFileWithHealth = Omit<CamFile, "cams"> & { cams: CamWithHealth[] };

const HEALTH_CACHE_TTL_MS = 30_000;
const HTTP_TIMEOUT_MS = 2500;

const healthCache = new Map<string, { at: number; health: CamHealth }>();

function nowIso() {
  return new Date().toISOString();
}

function hostnameFromUrl(raw: string): string | null {
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

async function httpCheck(
  url: string
): Promise<{ ok: boolean; detail?: string }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });

    // Some sites reject HEAD; treat “reachable” as success even if status is 403/405/etc.
    return { ok: true, detail: `HTTP ${res.status} (reachable)` };
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "HTTP check timed out"
        : String(e?.message ?? e);
    return { ok: false, detail: msg };
  } finally {
    clearTimeout(t);
  }
}

async function checkCamHealth(cam: Cam): Promise<CamHealth> {
  const checkedAt = nowIso();
  const host = hostnameFromUrl(cam.url);

  if (!host) return { ok: false, checkedAt, detail: "Invalid URL" };

  const cacheKey = `${cam.kind}:${host}`;
  const cached = healthCache.get(cacheKey);
  if (cached && Date.now() - cached.at < HEALTH_CACHE_TTL_MS)
    return cached.health;

  // DNS check
  try {
    await lookup(host);
  } catch (e: any) {
    const health = {
      ok: false,
      checkedAt,
      detail: `DNS lookup failed for ${host}: ${String(
        e?.code ?? e?.message ?? e
      )}`,
    };
    healthCache.set(cacheKey, { at: Date.now(), health });
    return health;
  }

  // Quick reachability check
  const http = await httpCheck(cam.url);
  const health: CamHealth = {
    ok: http.ok,
    checkedAt,
    detail: http.ok ? http.detail : `Reachability failed: ${http.detail}`,
  };

  healthCache.set(cacheKey, { at: Date.now(), health });
  return health;
}

function validateCam(cam: any): cam is Cam {
  if (!cam || typeof cam !== "object") return false;
  if (typeof cam.id !== "string" || !cam.id.trim()) return false;
  if (typeof cam.name !== "string" || !cam.name.trim()) return false;
  if (typeof cam.kind !== "string" || !cam.kind.trim()) return false;
  if (typeof cam.url !== "string" || !cam.url.trim()) return false;
  if (cam.dwellSec != null && typeof cam.dwellSec !== "number") return false;
  if (cam.attribution != null && typeof cam.attribution !== "string")
    return false;
  return true;
}

// ✅ GET (this is what fixes your 405)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeHealth = url.searchParams.get("health") !== "0"; // default ON

  const data = readCamsFileCached() as CamFile;

  if (!includeHealth) {
    return Response.json(data, { headers: { "cache-control": "no-store" } });
  }

  const cams = Array.isArray(data.cams) ? data.cams : [];
  const withHealth: CamWithHealth[] = await Promise.all(
    cams.map(async (c) => ({ ...c, health: await checkCamHealth(c) }))
  );

  const out: CamFileWithHealth = { ...data, cams: withHealth };
  return Response.json(out, { headers: { "cache-control": "no-store" } });
}

// ✅ POST upserts one cam
export async function POST(req: Request) {
  let body: { cam: Cam };

  try {
    body = (await req.json()) as { cam: Cam };
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  if (!body?.cam || !validateCam(body.cam)) {
    return new Response(
      "Body must be { cam: { id, name, kind, url, dwellSec?, attribution? } }",
      {
        status: 400,
      }
    );
  }

  const current = readCamsFileCached() as CamFile;
  const cams = Array.isArray(current.cams) ? [...current.cams] : [];

  const i = cams.findIndex((c) => c.id === body.cam.id);
  if (i >= 0) cams[i] = body.cam;
  else cams.push(body.cam);

  writeCamsFile({
    version: current.version ?? 1,
    updatedAt: new Date().toISOString(),
    cams,
  });

  return Response.json(
    { ok: true, count: cams.length },
    { headers: { "cache-control": "no-store" } }
  );
}

// ✅ DELETE by ?id=
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const current = readCamsFileCached() as CamFile;
  const cams = Array.isArray(current.cams) ? current.cams : [];
  const next = cams.filter((c) => c.id !== id);

  if (next.length === cams.length)
    return new Response("Not found", { status: 404 });

  writeCamsFile({
    version: current.version ?? 1,
    updatedAt: new Date().toISOString(),
    cams: next,
  });

  return Response.json(
    { ok: true, count: next.length },
    { headers: { "cache-control": "no-store" } }
  );
}
