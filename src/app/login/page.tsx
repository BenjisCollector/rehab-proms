import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(user.role === "clinician" ? "/clinician" : "/patient");

  return (
    <div className="narrow">
      <h1>Sign in</h1>
      <LoginForm />
      <section className="panel" aria-labelledby="demo-accounts">
        <h2 id="demo-accounts">Demo accounts</h2>
        <p>
          All accounts use the password <code>demo-password-not-secret</code>. Every person here is
          synthetic.
        </p>
        <ul>
          <li>
            <code>clinician@example.test</code> (clinician portal)
          </li>
          <li>
            <code>dev@example.test</code> (patient with no answers yet)
          </li>
          <li>
            <code>ada@example.test</code> (patient with history)
          </li>
        </ul>
      </section>
    </div>
  );
}
