import { ExternalLink } from "lucide-react";
import styles from "@/components/stack/stack.module.css";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// =============================================================================
// Module Overview
// =============================================================================
// The Stack page's rail: free, one-on-one setup help from the SBA's Small
// Business Development Centers and SCORE mentors, for owners who want a person.

/** The free-help links, the state's SBDC first. */
const HELP_LINKS: readonly { readonly label: string; readonly href: string }[] = [
  { label: "Maryland SBDC", href: "https://www.marylandsbdc.org/" },
  { label: "Find your local SBDC", href: "https://www.sba.gov/local-assistance" },
  { label: "Find a SCORE mentor", href: "https://www.score.org/find-mentor" },
];

/** Render the free-help card for the page's right rail. */
export function FreeHelp() {
  return (
    <aside className="rail" aria-label="Free help">
      <Card
        title="Want a person to help you set this up?"
        description="Small Business Development Centers give free, one-on-one advice through the SBA. Bring this page to the meeting."
      >
        <div className={styles.helpLinks}>
          {HELP_LINKS.map((link, i) => (
            <a
              key={link.href}
              className={buttonClass(i === 0 ? "primary" : "secondary", "sm")}
              href={link.href}
              target="_blank"
              rel="noopener"
            >
              {link.label}
              <ExternalLink aria-hidden="true" size={14} />
            </a>
          ))}
        </div>
      </Card>
    </aside>
  );
}
