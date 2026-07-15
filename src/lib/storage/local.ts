import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PutResult, StorageProvider } from "./types";

// Локальное файловое хранилище (dev). Кладёт файлы под STORAGE_LOCAL_DIR,
// сохраняя структуру ключа объекта (advertisers/.../v{n}/file).
export class LocalDiskProvider implements StorageProvider {
  private root: string;

  constructor(root?: string) {
    this.root = path.resolve(process.cwd(), root ?? process.env.STORAGE_LOCAL_DIR ?? "./storage");
  }

  private full(storageKey: string): string {
    // Защита от traversal: нормализуем и запрещаем выход за root.
    const target = path.resolve(this.root, storageKey);
    if (!target.startsWith(this.root)) {
      throw new Error("Некорректный ключ объекта");
    }
    return target;
  }

  async put(storageKey: string, data: Buffer, _mimeType: string): Promise<PutResult> {
    const target = this.full(storageKey);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    const sha256 = createHash("sha256").update(data).digest("hex");
    return { storageKey, sizeBytes: data.length, sha256 };
  }

  async get(storageKey: string): Promise<{ data: Buffer } | null> {
    try {
      const data = await fs.readFile(this.full(storageKey));
      return { data };
    } catch {
      return null;
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await fs.unlink(this.full(storageKey));
    } catch {
      /* уже нет — ок */
    }
  }

  async getSignedUrl(storageKey: string): Promise<string> {
    // В dev отдаём через backend-роут; storageKey → id версии резолвится в роуте.
    return `/api/storage-object?key=${encodeURIComponent(storageKey)}`;
  }
}
