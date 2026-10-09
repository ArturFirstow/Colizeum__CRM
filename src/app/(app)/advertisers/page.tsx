import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope } from "@/lib/scope";
import { AdvertisersView } from "@/components/advertisers/AdvertisersView";

export const dynamic = "force-dynamic";

export default async function AdvertisersPage() {
  // Личный кабинет: сотрудник видит только своих клиентов.
  const session = await requireSession();
  const advertisers = await prisma.advertiser.findMany({
    where: ownScope(session),
    include: { _count: { select: { deals: true, documents: true, contacts: true } } },
    orderBy: { nameRu: "asc" },
  });

  // ── Почему счётчик документов считается отдельно ────────────────────────────
  //
  // Файлы в сервисе лежат в ДВУХ местах, и это не ошибка проектирования, а две
  // разные задачи:
  //   • Document + версии — документ, который правят: договор, спецификация.
  //     У него есть история версий, и важно, какая из них действующая.
  //   • FileAsset — просто вложение: счёт, медиаплан, макет. Версии ему не нужны,
  //     зато его кладут откуда угодно — из сделки, из карточки, из чата.
  //
  // Беда была в том, что счётчик на карточке знал только о первом хранилище.
  // Человек загружал файлы из сделки, видел их в карточке клиента — и тут же
  // читал «0 док.». Теперь считаем оба и показываем сумму.
  //
  // Связи в базе между клиентом и FileAsset нет (там денормализованное поле
  // advertiserId без внешнего ключа), поэтому _count его не видит — считаем
  // одним групповым запросом и складываем.
  const ids = advertisers.map((a) => a.id);
  const fileCounts = ids.length
    ? await prisma.fileAsset.groupBy({
        by: ["advertiserId"],
        where: { advertiserId: { in: ids } },
        _count: { _all: true },
      })
    : [];
  const filesByAdvertiser = new Map(
    fileCounts.map((f) => [f.advertiserId, f._count._all] as const),
  );

  const withFiles = advertisers.map((a) => ({
    ...a,
    _count: {
      ...a._count,
      documents: a._count.documents + (filesByAdvertiser.get(a.id) ?? 0),
    },
  }));

  return <AdvertisersView initial={withFiles} />;
}
