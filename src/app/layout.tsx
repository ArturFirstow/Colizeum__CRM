import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RuValidation } from "@/components/ui/RuValidation";

export const metadata: Metadata = {
  title: "Colizeum Agency",
  description:
    "Colizeum Agency — сервис менеджера рекламных проектов: CRM, документы, база знаний, журнал.",
};

export const viewport: Viewport = {
  themeColor: "#0E0E0F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Oswald:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RuValidation />
        {children}
      </body>
    </html>
  );
}
