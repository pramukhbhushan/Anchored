"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { toolsHref } from "@/components/routes";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The tools page's workflow filter: one native select, so it takes a line on
// a phone instead of a wall of pills and works with the phone's own picker.
// The filter lives in the URL as `?workflow=`, so a pick swaps the query and
// the server renders the matching tools.

const ALL = "all";

/** Render the "For" select with every workflow of the business, plus "All your workflows", showing `active`. */
export function WorkflowFilter({
  businessId,
  workflows,
  active,
}: {
  readonly businessId: string;
  readonly workflows: readonly WorkflowId[];
  readonly active: WorkflowId | "all";
}) {
  const router = useRouter();

  function pick(event: ChangeEvent<HTMLSelectElement>) {
    // `ALL` matches no workflow, so picking it clears the filter.
    const workflow = workflows.find((w) => w === event.target.value);
    router.push(toolsHref(businessId, workflow), { scroll: false });
  }

  return (
    <label className="filter">
      <span>For</span>
      <select value={active} onChange={pick} aria-label="Filter tools by workflow">
        <option value={ALL}>All your workflows</option>
        {workflows.map((workflow) => (
          <option key={workflow} value={workflow}>
            {WORKFLOWS[workflow].name}
          </option>
        ))}
      </select>
    </label>
  );
}
