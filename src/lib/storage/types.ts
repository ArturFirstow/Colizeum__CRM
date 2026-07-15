// Абстракция файлового хранилища (блупринт 4.4, 10).
// В БД — только метаданные; бинарь — в StorageProvider. Реализации (local/S3)
// переключаются переменной окружения STORAGE_DRIVER, код не меняется.

export interface PutResult {
  storageKey: string;
  sizeBytes: number;
  sha256: string;
}

export interface StorageProvider {
  /** Сохранить объект по ключу. Возвращает метаданные (размер, хеш). */
  put(storageKey: string, data: Buffer, mimeType: string): Promise<PutResult>;
  /** Прочитать объект (для отдачи через backend с проверкой прав). */
  get(storageKey: string): Promise<{ data: Buffer; mimeType?: string } | null>;
  /** Удалить объект. */
  delete(storageKey: string): Promise<void>;
  /**
   * Временная ссылка на объект. В local-реализации это внутренний backend-роут
   * /api/versions/:id/download (прямой публичный доступ к бакету запрещён).
   */
  getSignedUrl(storageKey: string): Promise<string>;
}
