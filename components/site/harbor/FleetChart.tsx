import type { CSSProperties } from "react";
import { CORE_AGENTS } from "@/lib/domain/agents";
import type { CoreAgentId } from "@/lib/domain/types";
import { BOAT_SYMBOL, pennant } from "@/components/site/harbor/Boats";
import styles from "@/components/site/harbor/harbor.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// "How the agents work together": a nautical chart where each agent's boat
// sails a dashed route into one harbor marked You, beside a log of how one
// missed call becomes a booked job, a paid invoice and a review.

const AGENT_ORDER: readonly CoreAgentId[] = ["frontdesk", "followup", "books", "content", "internal"];
const POSITIONS: Readonly<Record<CoreAgentId, readonly [number, number]>> = {
  frontdesk: [70, 70],
  followup: [110, 330],
  books: [300, 370],
  content: [60, 210],
  internal: [260, 40],
};
const HARBOR = [560, 220] as const;
const SOUNDINGS: readonly (readonly [number, number, string])[] = [
  [430, 120, "4"], [470, 330, "6"], [350, 240, "9"], [640, 90, "3"], [200, 150, "12"], [400, 60, "11"],
];

/** The hand-offs, in the order one customer meets them. */
const FLOW: readonly { readonly when: string; readonly agent: CoreAgentId; readonly what: string; readonly how: string }[] = [
  { when: "9:12", agent: "frontdesk", what: "A call goes unanswered", how: "Front Desk drafts a text back with two open times." },
  { when: "Day 3", agent: "followup", what: "The quote goes quiet", how: "Follow-up's Closer drafts a friendly check-in." },
  { when: "Day 30", agent: "books", what: "The invoice runs late", how: "Bookkeeping's Payment Nudger drafts a reminder." },
  { when: "Job done", agent: "content", what: "A review comes in", how: "Follow-up asks for the review. Content drafts your reply." },
  { when: "7:00", agent: "internal", what: "Every morning", how: "Internal Communications sums up what needs you today and what it's worth." },
];

/** Render the chart and the log side by side. */
export function FleetChart() {
  return (
    <div className={styles.chart}>
      <div className={styles.map}>
        <svg viewBox="0 0 700 420" role="img" aria-label="Chart: five agent routes converging on your approvals">
          {[40, 76, 112, 148, 184, 220, 256].map((r) => (
            <ellipse key={r} className={styles.contourLine} cx={HARBOR[0]} cy={HARBOR[1]} rx={r * 1.4} ry={r} />
          ))}
          {SOUNDINGS.map(([x, y, d]) => (
            <text key={`${x}-${y}`} className={styles.ctext} x={x} y={y}>
              {d}
            </text>
          ))}
          {AGENT_ORDER.map((id, i) => {
            const [x, y] = POSITIONS[id];
            const mx = (x + HARBOR[0]) / 2, my = (y + HARBOR[1]) / 2 - 40;
            return (
              <g key={id}>
                <path className={styles.route} d={`M${x + 40} ${y + 14} Q${mx} ${my} ${HARBOR[0] - 36} ${HARBOR[1]}`} style={{ stroke: pennant(id), animationDelay: `-${i * 0.4}s` }} />
                <svg x={x - 10} y={y - 22} width="80" height="56" viewBox="0 0 200 140" style={{ "--pc": pennant(id) } as CSSProperties}>
                  <use href={`#${BOAT_SYMBOL[id]}`} />
                </svg>
                <text className={styles.clabel} x={x + 30} y={y + 48} textAnchor="middle">
                  {CORE_AGENTS[id].name.split(" ")[0]}
                </text>
              </g>
            );
          })}
          <circle className={styles.ring} cx={HARBOR[0]} cy={HARBOR[1]} r="34" />
          <circle className={styles.harborDot} cx={HARBOR[0]} cy={HARBOR[1]} r="34" />
          <text className={styles.youText} x={HARBOR[0]} y={HARBOR[1] - 2} textAnchor="middle">
            YOU
          </text>
          <text className={styles.youSub} x={HARBOR[0]} y={HARBOR[1] + 13} textAnchor="middle">
            approve
          </text>
          <text className={styles.ctext} x="16" y="406">
            38°59′N
          </text>
          <text className={styles.ctext} x="640" y="406">
            N ↑
          </text>
        </svg>
      </div>
      <ol className={styles.log}>
        {FLOW.map((step) => (
          <li key={step.what}>
            <span className={styles.logTime}>{step.when}</span>
            <div>
              <b>
                <i className={styles.dot} style={{ background: pennant(step.agent) }} />
                {step.what}
              </b>
              <span>{step.how}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
