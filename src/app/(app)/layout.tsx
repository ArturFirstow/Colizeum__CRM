import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { MobileTabs } from "@/components/MobileTabs";
import { Notifications } from "@/components/ui/Notifications";
import { ConsentGate } from "@/components/legal/ConsentGate";
import { pendingConsents } from "@/lib/services/consent";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Фото для меню профиля: в сессии его нет, берём из базы.
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatarUrl: true, totpEnabledAt: true, position: true },
  });

  const user = {
    id: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
    track: session.track,
    avatarUrl: me?.avatarUrl,
    totpEnabled: Boolean(me?.totpEnabledAt),
    position: me?.position ?? null,
  };

  // Второй фактор обязателен для админа и безопасности (требование 5.1):
  // у них доступ к управлению и к журналу. Жёстко не блокируем — человек,
  // запертый снаружи, хуже, чем человек с предупреждением на экране.
  const needsTwoFactor =
    (session.role === "Owner" || session.role === "Security") && !me?.totpEnabledAt;

  // Непринятые правовые документы перекрывают работу: без согласия обработка
  // персональных данных незаконна (требование 4.2).
  const consentDocs = await pendingConsents(session.userId);

  return (
    // ⚠️ Раскладка в ряд только с планшета. Раньше здесь стоял просто «flex»,
    // и на телефоне мобильная шапка становилась соседней КОЛОНКОЙ рядом с
    // содержимым: логотип сжимался в узкую полоску слева, а страница — в
    // остаток экрана. Именно из-за этого сервис «не открывался» с телефона.
    <div className="min-h-screen md:flex">
      <Sidebar user={user} twoFactorPending={needsTwoFactor} />
      <main className="min-w-0 flex-1">
        {/* Отступ снизу на телефоне — под нижнюю панель навигации. */}
        {/* ⚠️ Ширина поднята с 1280 до 1600 px: на рабочих мониторах страница
            упиралась в середину экрана, а по краям оставались пустые поля.
            Таблицы, канбан и календари живут плотно — им нужна вся ширина. */}
        <div className="page-enter mx-auto max-w-[1600px] px-4 pb-24 pt-5 sm:px-6 md:pb-8 lg:px-8 lg:py-8">
          {/* ⚠️ Полосы-напоминания наверху страниц больше нет. Она висела на
              КАЖДОМ экране и забирала первый экран у работы; само напоминание
              никуда не делось — точка на аватарке и подсвеченный пункт «Включить
              вход по коду» в меню профиля. */}
          {children}
        </div>
      </main>
      {consentDocs.length > 0 && <ConsentGate docs={consentDocs} />}
      {/* Всплывающие уведомления — на всех страницах кабинета */}
      <Notifications />
      <MobileTabs user={user} />
    </div>
  );
}
