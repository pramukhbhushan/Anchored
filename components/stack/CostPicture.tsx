"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyBill } from "./bill";
import { money } from "@/components/view-helpers";
import styles from "./cost-picture.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The stacked bar of a bill's paid pieces, drawn with Recharts, and a button
// per piece under it. The bar is for the eye: its label carries the amounts as
// text, and the buttons give keyboard and touch the same pieces. Picking one
// lists the work it covers. A tool that is only on quote has no number, so it
// is not in the bar.

/** Render the bar and the piece buttons; `selected` is the picked piece's key, which `onSelect` changes. */
export function CostPicture({
  bill,
  selected,
  onSelect,
}: {
  readonly bill: MonthlyBill;
  readonly selected: string | null;
  readonly onSelect: (key: string | null) => void;
}) {
  if (bill.segments.length === 0)
    return <p className={styles.empty}>Nothing to pay yet</p>;
  const label = `${money(bill.total)} a month: ${bill.segments.map((s) => `${s.name} ${money(s.amount)}`).join(", ")}`;
  const data = [
    Object.fromEntries(bill.segments.map((s) => [s.key, s.amount])),
  ];
  const piece = bill.segments.find((s) => s.key === selected);
  const lines =
    piece?.group === "build"
      ? bill.groups.find((g) => g.id === "build")?.lines
      : bill.groups
          .find((g) => g.id === "buy")
          ?.lines.filter((l) => l.key === selected);
  return (
    <div className={styles.picture}>
      <div role="img" aria-label={label}>
        <div aria-hidden="true" className={styles.chart}>
          <ResponsiveContainer
            width="100%"
            height={64}
            minWidth={1}
            initialDimension={{ width: 600, height: 64 }}
          >
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
            >
              <XAxis type="number" hide domain={[0, bill.total]} />
              <YAxis type="category" hide />
              <Tooltip
                cursor={false}
                formatter={(value, name) => [
                  money(Number(value)),
                  bill.segments.find((s) => s.key === name)?.name ?? name,
                ]}
                contentStyle={{
                  background: "var(--sheet)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r)",
                }}
              />
              {bill.segments.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="cost"
                  fill={i % 2 === 0 ? "var(--ink)" : "var(--link)"}
                  fillOpacity={
                    selected === null || selected === s.key ? 1 : 0.3
                  }
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className={styles.hint}>Pick a cost to see the work it covers.</p>
      <div className={styles.legend} role="group" aria-label="Monthly costs">
        {bill.segments.map((s) => (
          <button
            type="button"
            key={s.key}
            aria-pressed={selected === s.key}
            onClick={() => onSelect(selected === s.key ? null : s.key)}
          >
            <span>{s.name}</span>
            <strong>
              {money(s.amount)}
              <small>/mo</small>
            </strong>
          </button>
        ))}
      </div>
      {piece && (
        <div className={styles.detail} role="status">
          <strong>{piece.name} {piece.group === "build" ? "cover" : "covers"}</strong>
          <ul>
            {lines?.flatMap((l) =>
              l.does.map((job) => <li key={`${l.key}:${job}`}>{job}</li>),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
