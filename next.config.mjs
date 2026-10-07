/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Файловые загрузки идут через route handlers; поднимаем лимит тела для multipart.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // Страница, открытая меньше 15 секунд назад, при возврате показывается
    // сразу из памяти браузера, без похода на сервер. Люди щёлкают между
    // разделами туда-сюда — на этих переходах и ощущалась задержка.
    // 15 секунд намеренно мало: сохранение любой формы обновляет свою
    // страницу принудительно, так что устаревших данных на экране не будет.
    staleTimes: {
      dynamic: 15,
      static: 180,
    },
  },

  // ── Заголовки безопасности ──────────────────────────────────────────────
  // Браузер сам соблюдает эти правила — ничего настраивать в nginx не нужно.
  async headers() {
    const csp = [
      // По умолчанию грузим только своё.
      "default-src 'self'",
      // Next.js вшивает свои скрипты в страницу, поэтому inline разрешён.
      // Главное — посторонние домены в список не входят: чужой скрипт
      // (например, вставленный через найденную дыру) не загрузится.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Шрифты подключены с Google — и стиль, и сам файл шрифта.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      // Картинки: свои файлы, вставки data:/blob: (превью перед загрузкой).
      "img-src 'self' data: blob:",
      // Запросы с фронта — только на свой же сервер.
      "connect-src 'self'",
      // Формы никуда наружу не отправляются.
      "form-action 'self'",
      // Сервис нельзя открыть внутри рамки на чужом сайте — защита от того,
      // что поверх него положат невидимые кнопки и человек нажмёт не туда.
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Старый аналог frame-ancestors — для браузеров, которые не знают CSP.
          { key: "X-Frame-Options", value: "DENY" },
          // Запрещает браузеру «угадывать» тип файла: загруженный документ не
          // выполнится как скрипт.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // При переходе на внешний сайт адрес нашей страницы не передаётся —
          // в нём бывают идентификаторы клиентов и сделок.
          { key: "Referrer-Policy", value: "no-referrer" },
          // Камера, микрофон, геолокация сервису не нужны.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
