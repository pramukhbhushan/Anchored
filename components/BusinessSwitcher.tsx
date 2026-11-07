"use client";

import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import type { ChangeEvent } from "react";
import { STEPS, businessHref, type Step } from "@/components/routes";

// =============================================================================
// Module Overview
// =============================================================================
// The business picker in the app bar. Picking a business keeps you on the same
// step, as the prototype did; the last option, "Add your business...", opens
// onboarding instead.

const ADD_NEW = "__new";

/** Narrow the selected layout segment to a `Step`, or `null` for the profile page. */
function stepOf(segment: string | null): Step | null {
  return STEPS.find(({ step }) => step !== null && step === segment)?.step ?? null;
}

/** One entry in the picker. */
export interface BusinessOption {
  readonly id: string;
  readonly label: string;
}

/** Render the labelled business picker with `current` selected. */
export function BusinessSwitcher({
  current,
  options,
}: {
  readonly current: string;
  readonly options: readonly BusinessOption[];
}) {
  const router = useRouter();
  const step = stepOf(useSelectedLayoutSegment());

  function pick(event: ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    router.push(id === ADD_NEW ? "/onboard" : businessHref(id, step));
  }

  return (
    <div>
      <label htmlFor="biz-select">Business</label>
      <select id="biz-select" value={current} onChange={pick}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
        <option value={ADD_NEW}>Add your business...</option>
      </select>
    </div>
  );
}
