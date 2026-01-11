export type CamKind = "youtube" | "hls" | "web";

export type Cam = {
  id: string;
  name: string;
  kind: CamKind;
  url: string;
  dwellSec?: number;
  attribution?: string;
};

export type CamFile = {
  version: number;
  updatedAt: string;
  cams: Cam[];
};

export type TelemetryEvent = {
  ts: string; // ISO
  camId?: string;
  camName?: string;
  kind?: string;
  event: "ready" | "error" | "skip" | "load";
  detail?: string;
};
