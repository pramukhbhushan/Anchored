import type { Metadata } from "next";
import { OnboardForm } from "@/components/OnboardForm";
import { aiLabel } from "@/lib/server/ai";

// =============================================================================
// Module Overview
// =============================================================================
// The onboarding page: the form beside a "what happens next" panel. It asks
// the server which AI provider is configured, if any, so the form can say
// whether that provider or Anchored's own rules will read the answers.

export const metadata: Metadata = { title: "Describe your business" };

// Provider keys can be set after a build, so check them per request rather than once at build time.
export const dynamic = "force-dynamic";

/** Render the onboarding form and the panel that explains what comes next. */
export default function OnboardPage() {
  const aiName = aiLabel();
  return (
    <div className="wrap view">
      <div className="viewhead">
        <div>
          <h2>Tell Anchored about your business</h2>
          <p>
            A few questions. Skip what you don&apos;t know. The example answers describe a landscaping company. Replace
            them with yours.
          </p>
        </div>
      </div>
      <div className="cols">
        <OnboardForm aiName={aiName} />
        <div className="stack-y">
          <div className="panel">
            <h3>What happens next</h3>
            <ol style={{ margin: "10px 0 0", paddingLeft: 20, color: "var(--ink-2)" }}>
              <li>Anchored writes a one-page profile you confirm.</li>
              <li>You get the five shared workflows, plus the ones your answers add.</li>
              <li>Each workflow gets three paths and our pick.</li>
              <li>Work only some businesses have, such as a SNAP stocking check, can get its own niche agent.</li>
              <li>Agents you choose start drafting cards for you to approve.</li>
            </ol>
          </div>
          <div className="notice">
            {aiName
              ? `Your answers stay in this demo session and go only to ${aiName}, and nothing is texted to anyone. This is a prototype.`
              : "Your answers stay in this demo session, and nothing is texted to anyone. This is a prototype."}
          </div>
        </div>
      </div>
    </div>
  );
}
