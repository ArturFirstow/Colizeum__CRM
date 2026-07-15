import { logout } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function POST() {
  await logout();
  return ok({ ok: true });
}
