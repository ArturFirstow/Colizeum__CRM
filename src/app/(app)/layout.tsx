import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { Notifications } from "@/components/ui/Notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Фото для меню профиля: в сессии его нет, берём из базы.
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatarUrl: true },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{
          id: session.userId,
          name: session.name,
          email: session.email,
          role: session.role,
          track: session.track,
          avatarUrl: me?.avatarUrl,
        }}
      />
      <main className="min-w-0 flex-1">
        <div className="page-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
      {/* Всплывающие уведомления — на всех страницах кабинета */}
      <Notifications />
    </div>
  );
}
