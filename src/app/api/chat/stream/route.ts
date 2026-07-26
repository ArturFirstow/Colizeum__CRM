import { getSession } from "@/lib/auth";
import { chatEvents } from "@/lib/chat-events";

export const dynamic = "force-dynamic";

// SSE-поток событий чата: на каждое новое сообщение приходит channelId.
// Клиент решает, обновлять ли ленту (если открыт этот канал).
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let listener: (channelId: string) => void = () => {};
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));
      listener = (channelId: string) => {
        try {
          controller.enqueue(encoder.encode(`event: message\ndata: ${channelId}\n\n`));
        } catch {
          /* поток закрыт */
        }
      };
      chatEvents.on("message", listener);
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* поток закрыт */
        }
      }, 25000);
    },
    cancel() {
      chatEvents.off("message", listener);
      clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
