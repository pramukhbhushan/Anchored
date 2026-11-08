import Link from "next/link";
import { businessHref, type Section } from "@/components/routes";

// =============================================================================
// Module Overview
// =============================================================================
// The four stops through the example business, in sidebar order, so a first
// visitor learns the product's story and the sidebar at once: where AI helps,
// which tools fit, approving the drafts, then what it all costs. The example's
// overview shows it under the page title; an owner's own business never does.

/** One stop: the page it opens, what to do there and what that shows. */
interface Stop {
  readonly section: Section;
  readonly title: string;
  readonly text: string;
}

const STOPS: readonly Stop[] = [
  { section: "workflows", title: "See how the day runs", text: "Each job drawn step by step, with who handles it." },
  { section: "tools", title: "Compare the tools", text: "Each one scored out of 100 on seven checks." },
  { section: "approvals", title: "Approve the drafts", text: "Agents write. Nothing goes out until you tap Approve." },
  { section: "stack", title: "See the monthly bill", text: "Every tool and agent, and what it costs." },
];

/** Render the numbered stops through the example business `businessId`. */
export function ExampleTour({ businessId }: { readonly businessId: string }) {
  return (
    <nav className="tour" aria-labelledby="tour-title">
      <h2 id="tour-title" className="tour-title">
        Four stops through the example
      </h2>
      <ol className="tour-list">
        {STOPS.map((stop) => (
          <li key={stop.section}>
            <Link href={businessHref(businessId, stop.section)}>
              <b>{stop.title}</b>
              <span>{stop.text}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
