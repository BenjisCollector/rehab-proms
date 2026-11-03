"use server";

import { redirect } from "next/navigation";
import { attemptLogin } from "@/lib/auth-core";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { currentUser, endSession, startSession } from "@/lib/session";

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email address and password." };

  const result = attemptLogin(getDb(), email, password);
  if (!result.ok) {
    audit({ id: null, role: null }, "login", "Session", null, "denied");
    return {
      error:
        result.reason === "locked"
          ? "This account is temporarily locked after too many attempts. Try again in 15 minutes."
          : "The email address or password is not correct.",
    };
  }
  await startSession(result.user.id);
  audit({ id: result.user.id, role: result.user.role }, "login", "Session", null);
  redirect(result.user.role === "clinician" ? "/clinician" : "/patient");
}

export async function logout() {
  const user = await currentUser();
  await endSession();
  if (user) audit({ id: user.id, role: user.role }, "logout", "Session", null);
  redirect("/login");
}
