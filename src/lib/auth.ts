// ─────────────────────────────────────────────────────────────────────────────
// Аутентификация: приватный сервис на два аккаунта (блупринт 3, 11).
// Пароли — bcrypt. Сессия — подписанный JWT в httpOnly+secure cookie.
// Ключ подписи AUTH_SECRET только на сервере. Регистрация закрыта: пользователи
// заводятся сидом. Ролевую модель (RBAC) закладываем полем role, включаем в v2.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Role, UserTrack } from "@/lib/enums";

const COOKIE_NAME = "colizeum_session";

// Заглушки из .env.example и deploy/env.production.example — с ними на прод нельзя.
const PLACEHOLDER_SECRETS = new Set([
  "change-me-please-generate-a-long-random-secret-string",
  "ВСТАВЬТЕ_СЮДА_СЛУЧАЙНУЮ_СТРОКУ",
]);
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 дней

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET не задан или слишком короткий (см. .env).");
  }
  // Значение из .env.example достаточно длинное, чтобы пройти проверку выше, но
  // оно есть в репозитории — зная его, можно подделать cookie и войти любым
  // сотрудником. На проде такой запуск останавливаем.
  if (process.env.NODE_ENV === "production" && PLACEHOLDER_SECRETS.has(secret)) {
    throw new Error(
      "AUTH_SECRET оставлен из примера. Сгенерируйте свой: openssl rand -base64 32 — и впишите в .env.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  track: UserTrack;
};

async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Проверяет логин/пароль и, при успехе, ставит cookie-сессию. */
export async function login(
  email: string,
  password: string,
): Promise<{ ok: true; user: SessionPayload } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return { ok: false, error: "Неверный логин или пароль" };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false, error: "Неверный логин или пароль" };

  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    track: (user.track as UserTrack) ?? "Ads",
  };
  const token = await signSession(payload);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return { ok: true, user: payload };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Возвращает данные сессии из cookie или null. Не ходит в БД. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      track: (payload.track as UserTrack) ?? "Ads",
    };
  } catch {
    return null;
  }
}

/** Для API/страниц, где сессия обязательна. Бросает, если гость. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Не авторизован");
    this.name = "UnauthorizedError";
  }
}
