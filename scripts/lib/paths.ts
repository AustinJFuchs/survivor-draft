import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SEASON = process.env.SEASON ?? "51";
export const DATA_DIR = join(ROOT, "data", SEASON);
export const GENERATED_DIR = join(ROOT, "src", "generated");

export function readJson<T>(path: string, fallback?: T): T {
  if (!existsSync(path)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing file: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export const dataPath = (name: string) => join(DATA_DIR, name);
