import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/lib/markdown";
import { KnowledgeView } from "@/components/knowledge/KnowledgeView";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  // Порядок чтения — по циклу сделки (orderIndex), «сверху вниз для новичка».
  const [articles, files] = await Promise.all([
    prisma.knowledgeArticle.findMany({ orderBy: [{ orderIndex: "asc" }, { title: "asc" }] }),
    prisma.knowledgeFile.findMany({ orderBy: { uploadedAt: "desc" } }),
  ]);

  const withHtml = articles.map((a) => ({
    ...a,
    htmlBody: renderMarkdown(a.bodyMarkdown),
  }));

  return (
    <KnowledgeView
      articles={withHtml}
      files={files.map((f) => ({
        id: f.id,
        title: f.title,
        category: f.category,
        description: f.description,
        fileName: f.fileName,
        sizeBytes: f.sizeBytes,
      }))}
    />
  );
}
