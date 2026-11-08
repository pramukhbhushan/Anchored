"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { callApi, errorText } from "@/components/api";
import { businessHref } from "@/components/routes";
import { WorkOrder } from "@/components/site/WorkOrder";
import type { CreateBusinessRequest, CreateBusinessResponse } from "@/lib/api/contract";
import { EXAMPLES, exampleProfile } from "@/lib/domain/cases";
import { profileFromSentence } from "@/lib/domain/engine";
import type { BusinessProfile } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The landing hero's right column: the one-sentence "Map it" box, the example
// tabs and the live work order. Mapping runs in the browser with the domain
// rules; "Open the full plan" saves the business through `/api/businesses`.

// The hero opens on the HVAC shop from the team's research, a trade the example restaurant doesn't cover.
const FIRST_EXAMPLE = "hvac";

/** What the work order shows: a picked example, or a sentence already mapped. */
type Shown =
  | { readonly kind: "example"; readonly exampleId: string }
  | { readonly kind: "sentence"; readonly sentence: string; readonly profile: BusinessProfile };

/** Render the sentence box, example tabs and work order, and open the plan on request. */
export function HeroMapper() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [shown, setShown] = useState<Shown>({ kind: "example", exampleId: FIRST_EXAMPLE });
  // Bumped on every "Map it" so the work order remounts and its stamps thunk again.
  const [mapCount, setMapCount] = useState(0);
  const [opening, setOpening] = useState(false);
  const [status, setStatus] = useState("");

  const profile = useMemo(
    () => (shown.kind === "sentence" ? shown.profile : exampleProfile(shown.exampleId)),
    [shown],
  );

  function mapSentence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sentence = text.trim();
    if (sentence === "") return;
    setShown({ kind: "sentence", sentence, profile: profileFromSentence(sentence) });
    setMapCount((n) => n + 1);
  }

  async function openPlan() {
    const request: CreateBusinessRequest =
      shown.kind === "sentence"
        ? { from: "sentence", sentence: shown.sentence }
        : { from: "example", exampleId: shown.exampleId };
    setOpening(true);
    setStatus("Opening your plan...");
    try {
      const { id } = await callApi<CreateBusinessResponse>("/api/businesses", "POST", request);
      // The status line already says "Opening your plan"; a toast here would claim the page opened before it loads.
      router.push(businessHref(id, "workflows"));
    } catch (error) {
      setStatus(errorText(error));
      setOpening(false);
    }
  }

  return (
    <div>
      <form className="try" onSubmit={mapSentence}>
        <label htmlFor="try-text" className="sr">
          Describe a business in one sentence
        </label>
        <input
          type="text"
          id="try-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Try: a food truck that takes catering orders"
        />
        <button className="btn" type="submit">
          Map it
        </button>
      </form>
      <p className="exlabel">Or pick an example</p>
      <div className="tabs" role="group" aria-label="Example businesses">
        {EXAMPLES.map((example) => (
          <button
            key={example.id}
            type="button"
            className="tab"
            aria-pressed={shown.kind === "example" && shown.exampleId === example.id}
            onClick={() => setShown({ kind: "example", exampleId: example.id })}
          >
            {example.label}
          </button>
        ))}
      </div>
      <WorkOrder
        key={shown.kind === "example" ? shown.exampleId : `sentence-${mapCount}`}
        business={profile}
        action={
          <button type="button" className="btn btn-sm" onClick={openPlan} disabled={opening}>
            {opening ? "Opening your plan..." : "Open the full plan"}
          </button>
        }
      />
      <p className="small muted" role="status" style={{ marginTop: 8 }}>
        {status}
      </p>
    </div>
  );
}
