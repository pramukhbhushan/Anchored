import { describe, expect, it } from "vitest";
import { CARDS, DAY_END, DAY_START, boardAt, clockLabel, columnAt } from "@/components/site/harbor/day-board";

describe("boardAt", () => {
  it("starts the day with an empty board", () => {
    const board = boardAt(DAY_START);
    expect([board.wait.length, board.done.length, board.held.length]).toEqual([0, 0, 0]);
  });

  it("puts every message in Waiting on you before the owner approves it", () => {
    for (const card of CARDS) expect(columnAt(card, card.at)).toBe("wait");
  });

  it("ends the day with each message where it belongs and the late one held", () => {
    const board = boardAt(DAY_END);
    expect(board.held.map((card) => card.id)).toEqual(["lee"]);
    expect(board.done.map((card) => card.id)).toEqual(["dana", "post", "avocado"]);
    expect(board.wait.map((card) => card.id)).toEqual(["marcus", "listing", "allergy"]);
  });

  it("never sends the allergy question", () => {
    const allergy = CARDS.find((card) => card.id === "allergy")!;
    expect(columnAt(allergy, DAY_END)).toBe("wait");
  });
});

describe("clockLabel", () => {
  it("pads hours and minutes and stops at the end of the day", () => {
    expect(clockLabel(552)).toBe("09:12");
    expect(clockLabel(9999)).toBe(clockLabel(DAY_END));
  });
});
