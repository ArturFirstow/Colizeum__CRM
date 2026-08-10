import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope } from "@/lib/scope";
import { DocumentsView } from "@/components/documents/DocumentsView";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ advertiser?: string }>;
}) {
  const { advertiser } = await searchParams;

  // Личный кабинет: документы только своих клиентов.
  const session = await requireSession();
  const advertisers = await prisma.advertiser.findMany({
    where: ownScope(session),
    orderBy: { nameRu: "asc" },
    select: {
      id: true,
      nameRu: true,
      type: true,
      deals: { select: { id: true, title: true }, orderBy: { updatedAt: "desc" } },
      documents: {
        orderBy: { type: "asc" },
        select: {
          id: true,
          type: true,
          title: true,
          dealId: true,
          currentVersionId: true,
          versions: {
            orderBy: { versionNo: "desc" },
            select: {
              id: true,
              versionNo: true,
              fileName: true,
              sizeBytes: true,
              mimeType: true,
              changeNote: true,
              createdAt: true,
              uploadedBy: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return <DocumentsView advertisers={advertisers} initialAdvertiserId={advertiser} />;
}
