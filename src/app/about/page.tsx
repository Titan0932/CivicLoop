import Link from "next/link";

export const metadata = {
  title: "About CivicLoop",
  description: "How CivicLoop helps people follow what happened after an Ottawa public consultation.",
};

export default function AboutPage() {
  return <main id="main" className="about-main calm-ui">
    <article className="about-page">
      <header><span>About CivicLoop</span><h1>See what happened after a public consultation.</h1><p>CivicLoop brings scattered City of Ottawa records into one place, so you can follow public feedback from consultation through decisions and promised action.</p></header>

      <section><h2>What you can do here</h2><div className="about-steps">
        <article><strong>1</strong><div><h3>Find a consultation</h3><p>Search for a project or neighbourhood. If a consultation is missing, submit its official Ottawa page and CivicLoop will begin tracking it.</p></div></article>
        <article><strong>2</strong><div><h3>Understand the outcome</h3><p>Read a short summary of where the project stands, what changed after feedback, and what the City committed to do next.</p></div></article>
        <article><strong>3</strong><div><h3>Check the evidence</h3><p>Open the original municipal records behind important claims, including reports, meeting records, decisions, and project updates.</p></div></article>
      </div></section>

      <section><h2>How CivicLoop finds the story</h2><p>City consultation information often lives across several websites and documents. CivicLoop connects records using official links and identifiers, stores the reason for each connection, and checks those sources for changes.</p><p>AI helps turn long official records into plain-language summaries and identify possible feedback themes or commitments. Every AI-assisted point keeps a link to its source. Official records remain the evidence.</p></section>

      <section><h2>What the labels mean</h2><dl className="about-definitions"><div><dt>Addressed</dt><dd>The checked record shows a corresponding change or action.</dd></div><div><dt>Acknowledged</dt><dd>The concern appears in the record, but no clear action was found.</dd></div><div><dt>No public response found</dt><dd>CivicLoop did not find a response in the sources checked. It does not mean the City did nothing.</dd></div></dl></section>

      <aside><strong>CivicLoop is an independent civic-transparency prototype.</strong><p>It does not represent the City of Ottawa and does not replace official municipal records.</p></aside>
      <Link className="about-cta" href="/">Browse consultations</Link>
    </article>
  </main>;
}
