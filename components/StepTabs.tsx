"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { STEPS, businessHref } from "@/components/routes";

// =============================================================================
// Module Overview
// =============================================================================
// The five numbered step tabs under the business name. The `/b/[id]` layout
// can't see which page is open, so this reads the selected child segment and
// sets `aria-current` on that tab.

/** Render the step tabs for `businessId` with the open page marked. */
export function StepTabs({ businessId }: { readonly businessId: string }) {
  // `null` on the profile page, otherwise the step folder name, such as "compare".
  const segment = useSelectedLayoutSegment();
  return (
    <nav className="stepbar" aria-label="Steps">
      <ol>
        {STEPS.map(({ step, label }, index) => (
          <li key={label}>
            <Link href={businessHref(businessId, step)} aria-current={segment === step ? "page" : undefined}>
              <i>{index + 1}</i>
              {label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
