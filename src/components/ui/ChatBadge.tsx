"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Маячок непрочитанного напротив «Мессенджера»: иначе не видно, что тебе пишут.
export function ChatBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      // Мы внутри мессенджера — значит всё прочитано, не мигаем.
      if (pathname?.startsWith("/messenger")) {
        setCount(0);
        return;
      }
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/chat/unread", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { count: number } };
        if (alive) setCount(data.data?.count ?? 0);
      } catch {
        // Сеть моргнула — попробуем на следующем круге.
      }
    }

    load();
    const timer = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pathname]);

  if (count === 0) return null;

  return (
    <span
      className="ml-auto inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-ink-950"
      title={`Непрочитанных сообщений: ${count}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
