import type { BillGroup, BillGroupId, BillLine, MonthlyBill as Bill } from "@/components/stack/bill";
import styles from "@/components/stack/stack.module.css";
import { Card } from "@/components/ui/Card";
import { money } from "@/components/view-helpers";

// =============================================================================
// Module Overview
// =============================================================================
// The Stack page's cost picture: the monthly total, a stacked bar of every
// paid piece sized by dollars, and the four groups under it that name each
// piece and what it does. The bar is drawn for the eye; its `aria-label` and
// the groups below carry the same numbers as text.

// Below a fifth of the bar a name shrinks to a letter and an ellipsis; the groups under the bar name the piece instead.
/** Smallest share of the bar whose segment also prints the piece's name beside its price. */
const NAMED_SHARE = 0.2;

/** What each group is called, and what it says when it has nothing in it. */
const GROUP_COPY: Readonly<Record<BillGroupId, { readonly title: string; readonly none: string }>> = {
  buy: { title: "New tools", none: "Nothing new to sign up for." },
  build: { title: "Anchored drafts, you approve", none: "Nothing for Anchored to draft yet." },
  turnon: { title: "Tools you already have", none: "None of your tools are in the plan yet." },
  skip: { title: "Not handled yet", none: "Every job has someone on it." },
};

/** Return the agents' price line, the one group hint that says something the amounts don't. */
function agentsHint(plan: number): string {
  return plan > 0 ? `One ${money(plan)} plan covers every agent.` : "Free until you pick work for an agent.";
}

/** Render the monthly total, the stacked bar and the four groups, with the pricing fine print. */
export function MonthlyBill({ bill }: { readonly bill: Bill }) {
  const per = bill.onQuote.length > 0 ? `a month, plus ${bill.onQuote.join(" and ")} on quote` : "a month";
  return (
    <Card
      title="Your monthly bill"
      className={styles.bill}
      action={
        <p className={styles.total}>
          <b>{money(bill.total)}</b>
          <span>{per}</span>
        </p>
      }
    >
      <Bar bill={bill} />
      <ul className={styles.groups}>
        {bill.groups.map((group) => (
          <Group key={group.id} group={group} plan={bill.plan} />
        ))}
      </ul>
      <p className={styles.finePrint}>
        {bill.plan > 0 && `Includes Anchored at a proposed ${money(bill.plan)} a month for all agents. `}
        Tools you already pay for count as $0 here.
        {bill.pricesCheckedOn !== null && ` Tool prices come from pages checked ${bill.pricesCheckedOn}.`}
      </p>
    </Card>
  );
}

/** Render the stacked bar, or a dashed empty track when nothing costs money. */
function Bar({ bill }: { readonly bill: Bill }) {
  if (bill.segments.length === 0) {
    return <p className={styles.barEmpty}>Nothing to pay yet</p>;
  }
  const label = `${money(bill.total)} a month: ${bill.segments.map((s) => `${s.name} ${money(s.amount)}`).join(", ")}`;
  return (
    <div className={styles.bar} role="img" aria-label={label}>
      {bill.segments.map((segment) => (
        // Dollars drive flex-grow directly, so widths stay proportional whatever the total
        <span key={segment.key} className={styles.seg} data-group={segment.group} style={{ flexGrow: segment.amount }}>
          <b>{money(segment.amount)}</b>
          {segment.share >= NAMED_SHARE && <span className={styles.segName}>{segment.name}</span>}
        </span>
      ))}
    </div>
  );
}

/** Render one group: its color rule, title and total, then each piece in it. */
function Group({ group, plan }: { readonly group: BillGroup; readonly plan: number }) {
  const copy = GROUP_COPY[group.id];
  return (
    <li className={styles.group} data-group={group.id}>
      <h3 className={styles.groupHead}>
        {copy.title}
        <span className={styles.groupAmount}>{money(group.amount)}</span>
      </h3>
      {group.id === "build" && <p className={styles.hint}>{agentsHint(plan)}</p>}
      {group.lines.length === 0 ? (
        <p className={styles.none}>{copy.none}</p>
      ) : (
        <ul className={styles.lines}>
          {group.lines.map((line) => (
            <Line key={line.key} line={line} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Render one piece: its name, price when it has its own, and what it does. */
function Line({ line }: { readonly line: BillLine }) {
  return (
    <li className={styles.line}>
      <span className={styles.lineName}>{line.name}</span>
      {line.price !== null && <span className={styles.linePrice}>{line.price}</span>}
      {line.does.length > 0 && (
        <ul className={styles.lineDoes}>
          {line.does.map((job) => (
            <li key={job}>{job}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
