"use client";

import { Building2, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { APP_HREF, NEW_BUSINESS_HREF, businessHref } from "@/components/routes";
import type { ShellLocation } from "@/components/shell/location";
import type { BusinessSummary } from "@/components/shell/shell-data";

// =============================================================================
// Module Overview
// =============================================================================
// The business picker in the top bar: a native select, so it works with a
// keyboard, a screen reader and a phone's own picker. Picking a business keeps
// the section you're on; "All businesses" and "Start a new business" leave it.

const ALL = "__all";
const NEW = "__new";

/** Return the select's value for `location`. */
function valueOf(location: ShellLocation): string {
  if (location.page === "business") return location.businessId;
  return location.page === "new" ? NEW : ALL;
}

/** Render the labelled business picker for the viewer's `location`. */
export function BusinessSwitcher({
  businesses,
  location,
}: {
  readonly businesses: readonly BusinessSummary[];
  readonly location: ShellLocation;
}) {
  const router = useRouter();
  const own = businesses.filter((b) => b.kind === "custom");
  const samples = businesses.filter((b) => b.kind === "case");

  function pick(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (value === ALL) router.push(APP_HREF);
    else if (value === NEW) router.push(NEW_BUSINESS_HREF);
    else router.push(businessHref(value, location.page === "business" ? location.section : null));
  }

  return (
    <label className="switcher">
      <span className="sr">Business</span>
      <Building2 className="switcher-icon" aria-hidden="true" size={16} />
      <select value={valueOf(location)} onChange={pick}>
        <option value={ALL}>All businesses</option>
        {own.length > 0 && (
          <optgroup label="Your businesses">
            {own.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Sample businesses">
          {samples.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </optgroup>
        <option value={NEW}>Start a new business...</option>
      </select>
      <ChevronsUpDown className="switcher-caret" aria-hidden="true" size={16} />
    </label>
  );
}
