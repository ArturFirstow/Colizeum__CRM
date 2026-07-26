import "server-only";
import { EventEmitter } from "node:events";

// Мгновенный realtime мессенджера: in-memory шина событий на одном сервере.
// При отправке сообщения эмитим channelId; SSE-подписчики (открытый чат)
// получают сигнал и подтягивают ленту. На проде с одним инстансом работает;
// для нескольких инстансов позже заменим на Redis pub/sub.
const g = globalThis as unknown as { __chatEmitter?: EventEmitter };
export const chatEvents = g.__chatEmitter ?? (g.__chatEmitter = new EventEmitter());
chatEvents.setMaxListeners(0);

export function emitChatMessage(channelId: string) {
  chatEvents.emit("message", channelId);
}
