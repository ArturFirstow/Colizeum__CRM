import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/lib/markdown";
import { KnowledgeView } from "@/components/knowledge/KnowledgeView";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  // Порядок чтения — по циклу сделки (orderIndex), «сверху вниз для новичка».
  const articles = await prisma.knowledgeArticle.findMany({
    orderBy: [{ orderIndex: "asc" }, { title: "asc" }],
  });

  const withHtml = articles.map((a) => ({
    ...a,
    htmlBody: renderMarkdown(a.bodyMarkdown),
  }));

  return <KnowledgeView articles={withHtml} />;
}
