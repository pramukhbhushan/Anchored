"use client";

import { useState } from "react";
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
// A shadcn-style Recharts cost picture. The chart is decorative; real buttons
// expose the same amounts to keyboard and touch users and select the work
// covered by that exact paid piece. No quoted price is counted as a number.

/** Explore paid pieces of a bill and the jobs each one covers. */
export function CostPicture({
  bill,
  onSelect,
}: {
  readonly bill: MonthlyBill;
  readonly onSelect: (key: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
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
      <div className={styles.legend} aria-label="Monthly costs">
        {bill.segments.map((s) => (
          <button
            type="button"
            key={s.key}
            aria-pressed={selected === s.key}
            onClick={() => {
              const key = selected === s.key ? null : s.key;
              setSelected(key);
              onSelect(key);
            }}
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
