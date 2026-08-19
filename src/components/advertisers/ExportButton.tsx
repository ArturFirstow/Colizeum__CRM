"use client";

import { useState } from "react";
import { Download } from "lucide-react";

// Кнопка «Выгрузить в Excel» — книга по всем клиентам в области видимости.
// Нужна при передаче дел: коллега открывает файл и видит картину целиком,
// не заходя в сервис.
//
// Скачиваем через fetch, а не обычной ссылкой: так видно «Собираем…» на
// время сборки книги и понятно, что нажатие сработало.
export function ExportButton({ everyone = false }: { everyone?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/export/clients${everyone ? "?all=1" : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Не удалось собрать файл");
      }
      // Имя файла сервер присылает в заголовке — оно с русскими буквами и датой.
      const disp = res.headers.get("Content-Disposition") ?? "";
      const encoded = disp.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const name = encoded ? decodeURIComponent(encoded) : "Клиенты Colizeum.xlsx";

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button className="btn btn-ghost btn-sm" onClick={run} disabled={busy} title="Все клиенты одной книгой Excel">
        <Download size={14} className="text-brand" />
        {busy ? "Собираем…" : everyone ? "Выгрузить отдел в Excel" : "Выгрузить в Excel"}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
