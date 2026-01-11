import fs from "node:fs";
import path from "node:path";
import { CamFile } from "./types";

const DATA_DIR = process.env.DATA_DIR || "/data";
const CAMS_PATH = path.join(DATA_DIR, "cams.json");

function defaultCamFile(): CamFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    cams: [],
  };
}

export function readCamsFile(): CamFile {
  try {
    const raw = fs.readFileSync(CAMS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as CamFile;
    if (!parsed?.cams) return defaultCamFile();
    return parsed;
  } catch {
    return defaultCamFile();
  }
}

export function writeCamsFile(next: CamFile) {
  const out: CamFile = {
    version: next.version ?? 1,
    updatedAt: new Date().toISOString(),
    cams: Array.isArray(next.cams) ? next.cams : [],
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CAMS_PATH, JSON.stringify(out, null, 2), "utf-8");
}

// Simple in-memory cache with file mtime check (hot reload in prod via polling)
let cached: { mtimeMs: number; data: CamFile } | null = null;

export function readCamsFileCached(): CamFile {
  try {
    const stat = fs.statSync(CAMS_PATH);
    if (!cached || cached.mtimeMs !== stat.mtimeMs) {
      cached = { mtimeMs: stat.mtimeMs, data: readCamsFile() };
    }
    return cached.data;
  } catch {
    cached = { mtimeMs: 0, data: readCamsFile() };
    return cached.data;
  }
}
