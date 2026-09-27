import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./reading.css";

export const metadata: Metadata = {
  title: "CivicLoop — Follow public decisions",
  description: "Evidence-backed tracking from public consultation to municipal action in Ottawa.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="CivicLoop home">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span>CivicLoop</span>
          </Link>
          <nav className="site-nav" aria-label="Primary navigation"><Link href="/">Consultations</Link><Link href="/notifications">Notifications</Link><Link href="/about">About</Link></nav>
        </header>
        {children}
        <footer className="site-footer">
          <div><strong>CivicLoop</strong> is an independent civic-transparency prototype.</div>
          <div>Facts link to original City of Ottawa records. Missing public evidence is never treated as proof that no work occurred.</div>
        </footer>
      </body>
    </html>
  );
}
