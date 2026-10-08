import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { MobileTabs } from "@/components/MobileTabs";
import { Notifications } from "@/components/ui/Notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Фото для меню профиля: в сессии его нет, берём из базы.
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatarUrl: true, totpEnabledAt: true },
  });

  const user = {
    id: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
    track: session.track,
    avatarUrl: me?.avatarUrl,
    totpEnabled: Boolean(me?.totpEnabledAt),
  };

  // Второй фактор обязателен для админа и безопасности (требование 5.1):
  // у них доступ к управлению и к журналу. Жёстко не блокируем — человек,
  // запертый снаружи, хуже, чем человек с предупреждением на экране.
  const needsTwoFactor =
    (session.role === "Owner" || session.role === "Security") && !me?.totpEnabledAt;

  return (
    // ⚠️ Раскладка в ряд только с планшета. Раньше здесь стоял просто «flex»,
    // и на телефоне мобильная шапка становилась соседней КОЛОНКОЙ рядом с
    // содержимым: логотип сжимался в узкую полоску слева, а страница — в
    // остаток экрана. Именно из-за этого сервис «не открывался» с телефона.
    <div className="min-h-screen md:flex">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1">
        {/* Отступ снизу на телефоне — под нижнюю панель навигации. */}
        <div className="page-enter mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 md:pb-8 lg:px-8 lg:py-8">
          {needsTwoFactor && (
            <div className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
              <b>Включите вход по коду.</b> У вашей роли есть доступ к управлению и к журналу
              действий, поэтому одного пароля мало — это требование по безопасности.
              Откройте меню под своим именем слева внизу → «Вход по коду». Займёт минуту.
            </div>
          )}
          {children}
        </div>
      </main>
      {/* Всплывающие уведомления — на всех страницах кабинета */}
      <Notifications />
      <MobileTabs user={user} />
    </div>
  );
}
