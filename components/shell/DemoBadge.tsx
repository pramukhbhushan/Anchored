import { FlaskConical } from "lucide-react";
import type { DemoStatus } from "@/components/shell/shell-data";

// =============================================================================
// Module Overview
// =============================================================================
// The "Demo mode" badge in the top bar, the one demo label in the app. It
// shows when accounts, the AI provider or the database is off, and opens to
// say in plain words what that changes. A native `<details>`, so it opens by
// keyboard with no script.

/** Render the badge and its note, or nothing when accounts, AI and the database are all on. */
export function DemoBadge({ status }: { readonly status: DemoStatus }) {
  const notes = [
    status.accountsOn ? null : "Accounts are off, so your work stays with this browser.",
    status.aiOn ? null : "No AI provider is set up, so Anchored's own rules write every draft.",
    status.databaseOn ? null : "No database is connected, so your work resets when the server restarts.",
  ].filter((note) => note !== null);
  if (notes.length === 0) return null;

  return (
    <details className="demo">
      <summary>
        <FlaskConical aria-hidden="true" size={14} />
        <span className="demo-text">Demo mode</span>
      </summary>
      <div className="demo-pop">
        <ul>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
          <li>Nothing leaves Anchored. Approved texts and emails land in the demo outbox.</li>
        </ul>
      </div>
    </details>
  );
}
