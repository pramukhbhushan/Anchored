import { describe, expect, it } from "vitest";
import { DAY, DAY_END, DAY_START, clockLabel, dayAt } from "@/components/site/harbor/watch-bill";

describe("dayAt", () => {
  it("shows every row scheduled before the day starts", () => {
    const state = dayAt(DAY_START - 1);
    expect(state.rows.every((r) => r.chip.kind === "sched" && r.future)).toBe(true);
    expect([state.drafts, state.sent, state.held]).toEqual([0, 0, 0]);
  });

  it("waits for the owner before a draft goes out", () => {
    const callback = DAY.findIndex((r) => r.skill === "Callback");
    const at = DAY[callback]!.minute;
    expect(dayAt(at).rows[callback]!.chip.kind).toBe("draft");
    expect(dayAt(at + 45).rows[callback]!.chip.kind).toBe("wait");
    expect(dayAt(at + 90).rows[callback]!.chip.kind).toBe("sent");
  });

  it("ends the day with the late text held and nothing sent without the owner", () => {
    const end = dayAt(DAY_END, true);
    expect(end.rows.at(-1)!.chip.kind).toBe("held");
    expect(end.drafts).toBe(DAY.filter((r) => r.steps.length > 1).length);
    expect(end.sent + end.copied + end.held).toBe(end.drafts);
  });
});

describe("example agent identities", () => {
  it("groups first-contact and follow-up examples under Customer", () => {
    expect(DAY.filter((row) => ["Callback", "Closer", "Review Asker"].includes(row.skill)).every((row) => row.agent === "customer")).toBe(true);
  });

  it("shows a copied Marketing draft separately from sent messages", () => {
    const marketing = DAY.findIndex((row) => row.agent === "content");
    const end = dayAt(DAY_END, true);
    expect(end.rows[marketing]!.chip).toEqual({ kind: "copied", label: "Approved · copied" });
    expect(end.copied).toBe(1);
  });
});

describe("clockLabel", () => {
  it("pads hours and minutes and stops at the end of the day", () => {
    expect(clockLabel(552)).toBe("09:12");
    expect(clockLabel(9999)).toBe(clockLabel(DAY_END));
  });
});
