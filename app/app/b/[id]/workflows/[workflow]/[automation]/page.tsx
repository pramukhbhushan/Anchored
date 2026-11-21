import { ArrowLeft, CircleCheck, CircleDashed, MessageSquareText, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { businessHref, cardAnchor, toolsHref } from "@/components/routes";
import { automationSummary, automationsOf, type Automation } from "@/components/workflows/automations";
import { AskInChat } from "@/components/workflows/AskInChat";
import { workflowFlow } from "@/components/workflows/flow";
import { SKILLS } from "@/lib/domain/agents";
import { POST_BRIEF_QUESTION } from "@/lib/domain/posts";
import { askExampleFor } from "@/lib/domain/requests";
import { workflowIdsOf } from "@/lib/domain/paths";
import { stageOf } from "@/lib/domain/stages";
import type { SkillDef, SkillId, WorkflowId } from "@/lib/domain/types";
import { getBusinessOrNotFound, getChoices, getFeed } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// One automation's own page, opened from the Workflows map or the sidebar,
// like a thread inside a project: what it does in one sentence, the drafts it
// has waiting for the owner's OK with a link to approve each in Approvals, its
// recent decisions, and how it works, including what it never does. "Run it
// now" starts real work only: it links to Chat with a request to ask, and for
// payment reminders, an invoice to tell Bookkeeping about.
// Every automation page has a chat box whose words carry over to the business
// chat; for post drafts it asks the one question a post starts from.

type Params = Promise<{ id: string; workflow: string; automation: string }>;

/** Find the automation in the URL at the business, or `null` when it isn't one of its automations. */
async function findAutomation(id: string, workflow: string, key: string) {
  const business = await getBusinessOrNotFound(id);
  const ids = workflowIdsOf(business);
  if (!ids.includes(workflow as WorkflowId)) return null;
  const choices = await getChoices(business);
  const flow = workflowFlow(business, choices, workflow as WorkflowId);
  const automation = automationsOf(flow, stageOf(flow.id)).find((a) => a.key === decodeURIComponent(key));
  return automation === undefined ? null : { business, automation };
}

/** Name the tab after the automation. */
export async function generateMetadata({ params }: { readonly params: Params }): Promise<Metadata> {
  const { id, workflow, automation } = await params;
  const found = await findAutomation(id, workflow, automation);
  return { title: found?.automation.name ?? "Workflows" };
}

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function skillOf(a: Automation): SkillDef | null {
  return Object.hasOwn(SKILLS, a.key) ? SKILLS[a.key as SkillId] : null;
}

/** Render the page for the automation in the URL. */
export default async function AutomationPage({ params }: { readonly params: Params }) {
  const { id, workflow, automation: key } = await params;
  const found = await findAutomation(id, workflow, key);
  if (found === null) notFound();
  const { business, automation: a } = found;
  const { cards } = await getFeed(business);
  const mine = cards.filter((card) => card.skill === a.key);
  const waiting = mine.filter((card) => card.status === "pending");
  const done = mine.filter((card) => card.status !== "pending").slice(0, 6);
  const skill = skillOf(a);
  const workflowsHref = businessHref(business.id, "workflows");
  const approvalsHref = businessHref(business.id, "approvals");
  const Icon = a.kind === "agent" ? MessageSquareText : a.kind === "none" ? CircleDashed : Wrench;

  return (
    <div className="auto-page">
      <nav className="auto-crumbs" aria-label="Breadcrumb">
        <Link href={workflowsHref} className="btn ghost sm">
          <ArrowLeft aria-hidden="true" size={16} /> Back to the map
        </Link>
        <ol>
          <li><Link href={workflowsHref}>Workflows</Link></li>
          <li>{a.stage.name}</li>
          <li><Link href={`${workflowsHref}#wf-${a.workflow}`}>{a.workflowName}</Link></li>
          <li aria-current="page">{a.name}</li>
        </ol>
      </nav>

      <header className="auto-head" data-kind={a.kind} data-wait={waiting.length > 0 ? "true" : undefined}>
        <span className="auto-bub" aria-hidden="true"><Icon size={28} strokeWidth={1.7} /></span>
        <div className="auto-head-text">
          <h1>{a.name}</h1>
          <p>{automationSummary(a)}</p>
        </div>
        {waiting.length > 0 && <span className="auto-wait">{waiting.length === 1 ? "1 needs your OK" : `${waiting.length} need your OK`}</span>}
      </header>

      <section className="auto-card" aria-labelledby="auto-chat">
        <h2 id="auto-chat">Chat about this</h2>
        <AskInChat
          chatHref={businessHref(business.id, "chat")}
          prompt={a.key === "posts" && a.kind === "agent" ? POST_BRIEF_QUESTION : `Ask Anchored about ${a.name.charAt(0).toLowerCase() + a.name.slice(1)}, or tell it what you need.`}
          placeholder={a.key === "posts" ? "Our weekend workshop, where students built solar heaters" : (askExampleFor(a.key) ?? "Type a question or a note for Anchored")}
        />
      </section>

      {business.kind !== "case" && a.kind === "agent" && (a.key === "nudger" || askExampleFor(a.key) !== null) && (
        <section className="auto-card" aria-labelledby="auto-run">
          <h2 id="auto-run">Run it now</h2>
          {a.key === "nudger" ? (
            <p className="muted">
              Tell Bookkeeping about an invoice in <Link href={businessHref(business.id, "chat")}>Chat</Link>, like &quot;Sam Lee owes $240 on invoice 1042.&quot;
            </p>
          ) : (
            <p className="muted">
              Ask for one in <Link href={businessHref(business.id, "chat")}>Chat</Link>, like &quot;{askExampleFor(a.key)}.&quot;
            </p>
          )}
        </section>
      )}

      <div className="auto-grid">
        <div className="auto-main">
          <section className="auto-card auto-card-main" aria-labelledby="auto-waiting">
            <h2 id="auto-waiting">Waiting for your OK</h2>
            {waiting.length > 0 ? (
              <ul className="auto-cards">
                {waiting.map((card) => (
                  <li key={card.key}>
                    <p className="auto-card-title">{card.title}</p>
                    {card.to !== undefined && <p className="fine">To {card.to}</p>}
                    <p className="draft">{card.body}</p>
                    <Link href={`${approvalsHref}#${cardAnchor(card.key)}`} className="btn">
                      Review and approve
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                {a.draft !== null
                  ? `Nothing right now. When ${a.trigger.charAt(0).toLowerCase() + a.trigger.slice(1)}, Anchored writes ${a.draft.charAt(0).toLowerCase() + a.draft.slice(1)} and it waits here for you.`
                  : a.kind === "none"
                    ? "Nobody does this yet, so nothing waits here. Pick who handles it on the Workflows page."
                    : `${a.handler} does this on its own, so nothing waits for you here.`}
              </p>
            )}
          </section>
          <section className="auto-card" aria-labelledby="auto-recent">
            <h2 id="auto-recent">Recent runs</h2>
            {done.length > 0 ? (
              <ul className="auto-hist">
                {done.map((card) => (
                  <li key={card.key}>
                    <time dateTime={card.decidedAt ?? card.createdAt}>{DATE.format(new Date(card.decidedAt ?? card.createdAt))}</time>
                    <b>{card.title}</b>
                    <span>{card.status === "approved" ? (card.edited ? "You edited it, then approved it" : "You approved it") : "You skipped it"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No runs yet. Each one you approve or skip shows up here.</p>
            )}
          </section>
        </div>

        <aside className="auto-side">
          <section className="auto-card" aria-labelledby="auto-how">
            <h2 id="auto-how">How it works</h2>
            <dl className="auto-flow">
              <dt>When</dt>
              <dd>{a.trigger}</dd>
              {a.draft !== null && (
                <>
                  <dt>Anchored</dt>
                  <dd>Writes {a.draft.charAt(0).toLowerCase() + a.draft.slice(1)}</dd>
                  <dt>Your OK</dt>
                  <dd>Nothing is sent until you approve</dd>
                </>
              )}
              {a.rule !== null && (
                <>
                  <dt>Who decides</dt>
                  <dd>{a.rule}</dd>
                </>
              )}
              <dt>Result</dt>
              <dd>{a.result ?? "Nothing yet. You do this yourself."}</dd>
              <dt>Done by</dt>
              <dd>{a.kind === "none" ? "Nobody yet" : `${a.handler}. ${a.note}`}</dd>
            </dl>
            {skill !== null && skill.never.length > 0 && (
              <>
                <h3 className="auto-sub">It never</h3>
                <ul className="auto-never">
                  {skill.never.map((line) => (
                    <li key={line}><CircleCheck aria-hidden="true" size={16} /> {line}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="row">
              <Link href={`${workflowsHref}#wf-${a.workflow}`}>Change who does this</Link>
              <Link href={toolsHref(business.id, a.workflow)}>Compare apps</Link>
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
