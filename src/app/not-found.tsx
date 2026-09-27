import Link from "next/link";

export default function NotFound() {
  return <main id="main" className="not-found"><span>404</span><h1>That consultation is not tracked.</h1><p>The record may have moved, or CivicLoop has not added it yet.</p><Link href="/">Return to tracked consultations</Link></main>;
}
