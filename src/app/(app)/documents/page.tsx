import { prisma } from "@/lib/prisma";
import { DocumentsView } from "@/components/documents/DocumentsView";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ advertiser?: string }>;
}) {
  const { advertiser } = await searchParams;

  const advertisers = await prisma.advertiser.findMany({
    orderBy: { nameRu: "asc" },
    select: {
      id: true,
      nameRu: true,
      type: true,
      documents: {
        orderBy: { type: "asc" },
        select: {
          id: true,
          type: true,
          title: true,
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
