import { readCamsFileCached, writeCamsFile, readCamsFile } from "../../../lib/cams";
import type { CamFile } from "../../../lib/types";

function isAuthorized(req: Request) {
  const expected = process.env.ADMIN_TOKEN || "";
  if (!expected) return false;
  const got = req.headers.get("x-admin-token") || "";
  return got === expected;
}

export async function GET() {
  const data = readCamsFileCached();
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: CamFile;
  try {
    body = (await req.json()) as CamFile;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // Very light validation
  const cams = Array.isArray(body?.cams) ? body.cams : [];
  for (const cam of cams) {
    if (!cam?.id || !cam?.name || !cam?.kind || !cam?.url) {
      return new Response("Each cam must have id, name, kind, url", {
        status: 400,
      });
    }
  }

  writeCamsFile({
    version: body.version ?? 1,
    updatedAt: body.updatedAt ?? new Date().toISOString(),
    cams,
  });

  return new Response("Saved", { status: 200 });
}
