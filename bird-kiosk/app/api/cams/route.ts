import { readCamsFileCached, writeCamsFile } from "../../../lib/cams";
import type { Cam, CamFile } from "../../../lib/types";

type AddCamRequest = {
  cam: Cam;
};

function validateCam(cam: any): cam is Cam {
  if (!cam || typeof cam !== "object") return false;
  if (typeof cam.id !== "string" || !cam.id.trim()) return false;
  if (typeof cam.name !== "string" || !cam.name.trim()) return false;
  if (typeof cam.kind !== "string" || !cam.kind.trim()) return false;
  if (typeof cam.url !== "string" || !cam.url.trim()) return false;

  if (
    cam.dwellSec != null &&
    (typeof cam.dwellSec !== "number" || Number.isNaN(cam.dwellSec))
  )
    return false;
  if (cam.attribution != null && typeof cam.attribution !== "string")
    return false;

  // Optional: constrain allowed kinds
  if (!["youtube", "hls", "web"].includes(cam.kind)) return false;

  return true;
}

export async function GET() {
  const data = readCamsFileCached();
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  let body: AddCamRequest;

  try {
    body = (await req.json()) as AddCamRequest;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  if (!body?.cam || !validateCam(body.cam)) {
    return new Response(
      "Body must be { cam: { id, name, kind, url, dwellSec?, attribution? } }",
      { status: 400 }
    );
  }

  const current: CamFile = readCamsFileCached();
  const cams = Array.isArray(current.cams) ? [...current.cams] : [];

  // Upsert by id (replace if same id already exists)
  const idx = cams.findIndex((c) => c.id === body.cam.id);
  if (idx >= 0) cams[idx] = body.cam;
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
