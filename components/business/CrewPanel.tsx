import Link from "next/link";
import { ChooseButton } from "@/components/business/ChooseButton";
import styles from "@/components/business/CrewPanel.module.css";
import { businessHref } from "@/components/routes";
import { buttonClass } from "@/components/ui/Button";
import { CORE_AGENTS } from "@/lib/domain/agents";
import { turnOnChoice } from "@/lib/domain/crew";
import { readinessFor } from "@/lib/domain/details";
import { FIELDS } from "@/lib/domain/fields";
import { activeAgents } from "@/lib/domain/paths";
import type { BusinessProfile, ChoiceMap, CoreAgentId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The crew screen at the top of Workflows. Every core agent says whether it is
// working, why the plan made that choice, which owner answer led to it, and how
// many required profile facts are ready. An off agent can be turned on in one
// tap through the same saved workflow choice used everywhere else.

/** The owner-facing readiness and next step for one agent. */
function readinessLine(business: BusinessProfile, agent: CoreAgentId): { readonly count: string; readonly next: string | null } {
  const ready = readinessFor({ details: business.details, evidence: business.evidence }, agent);
  const next = ready.next === null ? null : `${CORE_AGENTS[agent].name} still needs ${FIELDS[ready.next].label.toLowerCase()}.`;
  return { count: `${ready.filled} of ${ready.required} required details ready`, next };
}

/** Render the five core agents with reasons, readiness and one-tap turn-on controls. */
export function CrewPanel({ business, choices }: { readonly business: BusinessProfile; readonly choices: ChoiceMap }) {
  const running = new Set(
    activeAgents(business, choices).flatMap((agent) => (agent.id.startsWith("niche:") ? [] : [agent.id as CoreAgentId])),
  );
  const decisions = new Map(business.crew?.map((decision) => [decision.agent, decision]));

  return (
    <section className={styles.section} aria-labelledby="crew-title">
      <header className="section-head">
        <div>
          <h2 id="crew-title">Your crew</h2>
          <p>Why each agent is working or waiting, and what it still needs from you.</p>
        </div>
      </header>
      <div className={styles.grid}>
        {Object.values(CORE_AGENTS).map((agent) => {
          const on = running.has(agent.id);
          const decision = decisions.get(agent.id);
          const readiness = readinessLine(business, agent.id);
          const turnOn = on ? null : turnOnChoice(business, agent.id);
          return (
            <article className={styles.card} key={agent.id}>
              <div className={styles.head}>
                <h3>{agent.name}</h3>
                <span className={styles.state}>{on ? "Working" : "Off"}</span>
              </div>
              <p>{agent.job}</p>
              <p className={styles.reason}>{decision?.reason ?? (on ? "This agent handles work in your approved plan." : "This agent is not in your plan yet.")}</p>
              {decision?.quote && <p className={styles.quote}>&quot;{decision.quote}&quot;</p>}
              <p className={styles.ready}>{readiness.count}</p>
              {readiness.next && (
                <p className={styles.next}>
                  {readiness.next} <Link href={businessHref(business.id, "chat")}>Tell Anchored</Link>.
                </p>
              )}
              {turnOn !== null && (
                <ChooseButton
                  businessId={business.id}
                  request={{ workflow: turnOn.workflow, path: "build" }}
                  className={buttonClass("secondary", "sm")}
                  label={`Turn on ${agent.name}`}
                  runner={`${agent.name} agent`}
                >
                  Turn on
                </ChooseButton>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
