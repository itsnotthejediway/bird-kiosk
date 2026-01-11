import { TelemetryEvent } from "./types";

type Counters = Record<string, number>;

const counters: Counters = {
  telemetry_total: 0,
  ready_total: 0,
  error_total: 0,
  skip_total: 0,
  load_total: 0,
};

const lastErrors: TelemetryEvent[] = [];

export function recordTelemetry(evt: TelemetryEvent) {
  counters.telemetry_total++;

  const key = `${evt.event}_total`;
  counters[key] = (counters[key] ?? 0) + 1;

  if (evt.event === "error") {
    lastErrors.unshift(evt);
    if (lastErrors.length > 50) lastErrors.pop();
  }
}

export function getMetrics() {
  return {
    counters,
    lastErrors,
  };
}
