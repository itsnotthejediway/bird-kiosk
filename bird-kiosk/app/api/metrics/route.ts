import { getMetrics } from "../../../lib/metrics";

export async function GET() {
  return Response.json(getMetrics(), {
    headers: { "cache-control": "no-store" },
  });
}
