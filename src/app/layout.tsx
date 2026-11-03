import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { logout } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Rehab PROMs", template: "%s | Rehab PROMs" },
  description: "Portfolio demo: remote PROM monitoring with FHIR R4. Synthetic data only.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en-GB">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <div className="demo-banner" role="note">
          Demo with synthetic data. Not a medical device and not for clinical use.
        </div>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              Rehab PROMs
            </Link>
            {user && (
              <nav aria-label="Account" className="account">
                <span>
                  {user.display_name} <span className="role">({user.role})</span>
                </span>
                {user.role === "clinician" && <Link href="/clinician/audit">Audit log</Link>}
                <form action={logout}>
                  <button type="submit" className="link-button">
                    Sign out
                  </button>
                </form>
              </nav>
            )}
          </div>
        </header>
        <main id="main" className="container" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
