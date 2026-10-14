// Small shared pieces for the GEO web app pages (usegeo.app/login, /start, /dash).
import type { ReactNode } from "react";

export function Logo() {
  return (
    <a className="w-logo" href="/">
      <i aria-hidden="true" />
      GEO
    </a>
  );
}

/** One white card on the lilac gradient: sign in, check your email, add your store. */
export function Solo({ children }: { children: ReactNode }) {
  return (
    <div className="w">
      <main className="w-solo">
        <div className="w-card">
          <Logo />
          {children}
        </div>
      </main>
    </div>
  );
}
