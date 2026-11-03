import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type Role, type User, createSession, deleteSession, userForSession } from "./auth-core";
import { getDb } from "./db";

const COOKIE = "rp_session";

export async function startSession(userId: string) {
  const { id, expires } = createSession(getDb(), userId);
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) deleteSession(getDb(), id);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  return id ? userForSession(getDb(), id) : null;
}

/** For pages: send unauthenticated users to login and wrong-role users home. */
export async function requireRole(role: Role): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect("/");
  return user;
}
