import { recordTelemetry } from "../../../lib/metrics";
import type { TelemetryEvent } from "../../../lib/types";

export async function POST(req: Request) {
  let evt: TelemetryEvent;
  try {
    evt = (await req.json()) as TelemetryEvent;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  if (!evt?.event || !evt?.ts) {
    return new Response("Missing fields", { status: 400 });
  }

  recordTelemetry(evt);
  return new Response("ok", { status: 200 });
}
