"use client";

import { useRouter } from "next/navigation";
import { toolsHref } from "@/components/routes";
import { WORKFLOWS } from "@/lib/domain/workflows";
import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The tools page's workflow filter: pill toggles with `aria-pressed`. The
// filter lives in the URL as `?workflow=`, so a pick swaps the query and the
// server renders the matching tools.

/** Render one pill per workflow, plus "All your workflows", with `active` pressed. */
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

  function pick(workflow: WorkflowId | "all") {
    router.push(toolsHref(businessId, workflow === "all" ? undefined : workflow), { scroll: false });
  }

  return (
    <div className="filters" role="group" aria-label="Filter tools by workflow">
      <button type="button" className="tab" aria-pressed={active === "all"} onClick={() => pick("all")}>
        All your workflows
      </button>
      {workflows.map((workflow) => (
        <button
          key={workflow}
          type="button"
          className="tab"
          aria-pressed={active === workflow}
          onClick={() => pick(workflow)}
        >
          {WORKFLOWS[workflow].name}
        </button>
      ))}
    </div>
  );
}
