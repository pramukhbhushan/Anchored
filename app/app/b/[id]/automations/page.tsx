import type { Metadata } from "next";
import Link from "next/link";
import { automationHref, businessHref, toolsHref } from "@/components/routes";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutomationSwitch } from "@/components/workflows/AutomationSwitch";
import { automationsOf } from "@/components/workflows/automations";
import { workflowFlow } from "@/components/workflows/flow";
import styles from "@/components/workflows/automations.module.css";
import { workflowIdsOf } from "@/lib/domain/paths";
import { groupByStage } from "@/lib/domain/stages";
import { onChoice } from "@/lib/server/automations";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The Automations page: every job the business runs, grouped by stage, each
// with an on/off switch, who does it now (Anchored or an app such as Stripe),
// its automations linking to their own pages, and a link to compare apps.
// Turning a job on that Anchored drafts asks its first question in Chat.

export const metadata: Metadata = { title: "Automations" };

/** Render every job's switch for the business in the URL. */
export default async function AutomationsPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const [choices, feed] = await Promise.all([getChoices(business), getFeed(business)]);
  const pending = feed.cards.filter((card) => card.status === "pending");
  const chatHref = businessHref(business.id, "chat");
  const example = business.kind === "case";

  return (
    <>
      <PageHeader title="Automations" description={`Turn each of ${business.name}'s jobs on or off. When you turn on a job Anchored drafts, it asks you a question in Chat to get started.`} />
      <div className={styles.stages}>
        {groupByStage(workflowIdsOf(business)).map(({ stage, workflows }) => (
          <section key={stage.id} className={styles.stage} aria-labelledby={`st-${stage.id}`}>
            <h2 id={`st-${stage.id}`}>{stage.name}</h2>
            <p className={styles.stageBlurb}>{stage.blurb}</p>
            <ul className={styles.jobs}>
              {workflows.map((workflow) => {
                const flow = workflowFlow(business, choices, workflow);
                const on = flow.handler.kind !== "none";
                const canTurnOn = onChoice(business, workflow) !== null;
                const disabledReason = example
                  ? "This is an example. Set up your business to turn jobs on."
                  : !on && !canTurnOn
                    ? "Anchored doesn't draft this job, and you don't have an app for it yet. Compare apps to pick one."
                    : null;
                return (
                  <li key={workflow} className={styles.job} data-on={on}>
                    <div className={styles.jobHead}>
                      <h3>{flow.name}</h3>
                      <AutomationSwitch businessId={business.id} workflow={workflow} jobName={flow.name} on={on} chatHref={chatHref} disabledReason={disabledReason} />
                    </div>
                    <p className={styles.who}>
                      <b>{on ? flow.handler.name : "Off"}</b>
                      {on ? `. ${flow.handler.note}` : ". Nobody handles this yet, so you do it yourself."}
                    </p>
                    <ul className={styles.autos} aria-label={`Automations in ${flow.name}`}>
                      {automationsOf(flow, stage).map((a) => {
                        const waiting = pending.filter((card) => card.skill === a.key).length;
                        return (
                          <li key={a.key}>
                            <Link href={automationHref(business.id, a.workflow, a.key)}>{a.name}</Link>
                            {waiting > 0 && <span className={styles.wait}>{waiting === 1 ? "1 needs your OK" : `${waiting} need your OK`}</span>}
                          </li>
                        );
                      })}
                    </ul>
                    <p className={styles.links}>
                      <Link href={toolsHref(business.id, workflow)}>Compare apps</Link>
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
