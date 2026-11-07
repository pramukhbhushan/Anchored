import { ExternalLink } from "lucide-react";
import styles from "@/components/stack/stack.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The Stack page's rail: free, one-on-one setup help from the SBA's Small
// Business Development Centers and SCORE mentors, for owners who want a person.
// Plain links rather than a card of buttons, so it never outweighs the bill.

/** The free-help links, the state's SBDC first. */
const HELP_LINKS: readonly { readonly label: string; readonly href: string }[] = [
  { label: "Maryland SBDC", href: "https://www.marylandsbdc.org/" },
  { label: "Your local SBDC", href: "https://www.sba.gov/local-assistance" },
  { label: "A SCORE mentor", href: "https://www.score.org/find-mentor" },
];

/** Render the free-help note for the page's right rail: plain links on paper, so the bill stays the one loud thing. */
export function FreeHelp() {
  return (
    <aside className={styles.help} aria-labelledby="help-title">
      <h2 id="help-title" className={styles.helpTitle}>
        Free setup help
      </h2>
      <p className={styles.helpText}>Small Business Development Centers advise for free.</p>
      <ul className={styles.helpLinks}>
        {HELP_LINKS.map((link) => (
          <li key={link.href}>
            <a href={link.href} target="_blank" rel="noopener">
              {link.label}
              <ExternalLink aria-hidden="true" size={14} />
              <span className={styles.srOnly}> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
