import styles from "@/components/site/landing.module.css";
import { businessHref } from "@/components/routes";
import { ButtonLink } from "@/components/ui/Button";
import { money } from "@/components/view-helpers";
import { CORE_AGENTS, SKILLS } from "@/lib/domain/agents";
import type { BusinessProfile, SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page's fourth step: one researched card from a case study, as
// the approvals feed shows it, with the checks it passed and a link to the
// same card in the demo. The card here has no buttons; approving happens in the app.

/** Render `business`'s researched card for `skill`, or nothing if the research wrote none. */
export function ApprovalPreview({ business, skill }: { readonly business: BusinessProfile; readonly skill: SkillId }) {
  const card = business.cards?.[skill];
  if (card === undefined) return null;
  const def = SKILLS[skill];
  const agent = def.agent === null ? null : CORE_AGENTS[def.agent];
  const channel = card.channel === "sms" ? "by text" : card.channel === "email" ? "by email" : "";

  return (
    <article className={styles.card} aria-label="A card waiting for approval">
      <div className={styles.cardHead}>
        <p className={styles.source}>
          {agent === null ? def.name : `${agent.name} agent, ${def.name} skill`}, for {business.name}
        </p>
        <h3 className={styles.cardTitle}>{card.title}</h3>
        {card.to !== undefined && (
          <p className={styles.to}>
            To {card.to} {channel}
          </p>
        )}
      </div>
      <p className={styles.bubble}>{card.body}</p>
      <p className={styles.why}>
        <b>Why now:</b> {card.reason}
      </p>
      <ul className={styles.passed} aria-label="Checks this draft passed">
        {card.checks.map((check) => (
          <li key={check}>{check}</li>
        ))}
      </ul>
      <div className={styles.cardFoot}>
        <p className={styles.stake}>
          {card.stake === undefined ? (
            "Waiting for your tap"
          ) : (
            <>
              <b>{money(card.stake)}</b>riding on it
            </>
          )}
        </p>
        <ButtonLink href={businessHref(business.id, "approvals")} size="sm">
          Approve it in the demo
        </ButtonLink>
      </div>
    </article>
  );
}
