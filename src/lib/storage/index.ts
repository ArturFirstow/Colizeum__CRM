import "server-only";
import { createHash } from "node:crypto";
import { LocalDiskProvider } from "./local";
import type { StorageProvider } from "./types";

export type { StorageProvider, PutResult } from "./types";

let provider: StorageProvider | null = null;

/** Возвращает активный StorageProvider по STORAGE_DRIVER (local | s3). */
export function getStorage(): StorageProvider {
  if (provider) return provider;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  switch (driver) {
    case "local":
      provider = new LocalDiskProvider();
      break;
    case "s3":
      // Реализация S3Provider — фаза v3 (Cloudflare R2 / B2 / Selectel).
      throw new Error("S3Provider ещё не реализован (фаза v3). Используйте STORAGE_DRIVER=local.");
    default:
      throw new Error(`Неизвестный STORAGE_DRIVER: ${driver}`);
  }
  return provider;
}

/** SHA-256 буфера — для дедупа и распознавания версий. */
export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Безопасное имя файла для ключа объекта. */
export function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim();
  return base.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 200) || "file";
}

/** Ключ объекта по схеме блупринта (раздел 10). */
export function buildStorageKey(
  advertiserId: string,
  documentId: string,
  versionNo: number,
  fileName: string,
): string {
  return `advertisers/${advertiserId}/documents/${documentId}/v${versionNo}/${sanitizeFileName(fileName)}`;
}
