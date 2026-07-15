import { NextRequest } from "next/server";
import { z } from "zod";
import { login } from "@/lib/auth";
import { fail, ok, handleError } from "@/lib/api";

const schema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const result = await login(body.email, body.password);
    if (!result.ok) return fail("invalid_credentials", result.error, 401);
    return ok({ user: result.user });
  } catch (err) {
    return handleError(err);
  }
}
