import { describe, expect, it } from "vitest";
import { SAMPLE_BUSINESS } from "@/lib/domain/cases";
import { workflowIdsOf } from "@/lib/domain/paths";
import { groupByStage, STAGES, stageOf } from "@/lib/domain/stages";
import type { WorkflowId } from "@/lib/domain/types";
import { WORKFLOW_IDS } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The stages the Workflows graph groups a business's day into: every workflow
// lands in one stage an owner recognizes, the stages keep their order, and a
// workflow id the code no longer knows still lands somewhere.

describe("stageOf", () => {
  it("puts finding customers, serving them and getting paid in their own stages", () => {
    expect(stageOf("leads").name).toBe("Getting customers");
    expect(stageOf("social").name).toBe("Getting customers");
    expect(stageOf("reviews").name).toBe("Getting customers");
    expect(stageOf("calls").name).toBe("Serving customers");
    expect(stageOf("noshows").name).toBe("Serving customers");
    expect(stageOf("catering").name).toBe("Serving customers");
    expect(stageOf("quotes").name).toBe("Serving customers");
    expect(stageOf("books").name).toBe("Getting paid and running the shop");
    expect(stageOf("invoices").name).toBe("Getting paid and running the shop");
    expect(stageOf("scheduling").name).toBe("Getting paid and running the shop");
    expect(stageOf("disputes").name).toBe("Getting paid and running the shop");
  });

  it("places every workflow in one of the listed stages", () => {
    for (const id of WORKFLOW_IDS) expect(STAGES).toContain(stageOf(id));
  });

  it("falls back to the last stage for a workflow id saved before a rename", () => {
    // Saved plans are read back from the store, so an id can outlive its catalog entry.
    expect(stageOf("retired" as WorkflowId)).toBe(STAGES.at(-1));
  });
});

describe("groupByStage", () => {
  it("keeps the stage order and the workflow order, and leaves out empty stages", () => {
    const groups = groupByStage(["books", "calls", "social", "noshows"]);
    expect(groups.map((g) => [g.stage.name, g.workflows])).toEqual([
      ["Getting customers", ["social"]],
      ["Serving customers", ["calls", "noshows"]],
      ["Getting paid and running the shop", ["books"]],
    ]);
    expect(groupByStage(["calls"]).map((g) => g.stage.name)).toEqual(["Serving customers"]);
  });

  it("shows each of the restaurant's workflows once", () => {
    const ids = workflowIdsOf(SAMPLE_BUSINESS);
    const grouped = groupByStage(ids).flatMap((g) => g.workflows);
    expect([...grouped].sort()).toEqual([...ids].sort());
  });
});
