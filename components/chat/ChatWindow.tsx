"use client";

import { Anchor, ArrowLeftRight, ArrowUp, Check, ChevronDown, CircleAlert, Minus, Plus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { callApi, errorText, getApi } from "@/components/api";
import { ResizablePanel } from "@/components/resize/ResizablePanel";
import { businessHref, NEW_BUSINESS_HREF } from "@/components/routes";
import { Button, ButtonLink } from "@/components/ui/Button";
import { GENERIC_STARTERS } from "@/components/chat/starters";
import type { BusinessChatResponse, ChatMessage, IntakeAnswerRequest, IntakeResponse, StartIntakeResponse } from "@/lib/api/contract";
import { answerText, CHANGE_AREA_LABEL, type IntakeQuestion, type KnownFact, type ProfileChange } from "@/lib/domain/intake";
import styles from "./chat.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The chat Anchored uses for onboarding and for each business afterwards.
// `ChatWindow` in `intake` mode asks one question at a time beside a live
// "What Anchored knows" card and ends on "Open your plan"; in `business` mode
// the owner says what changed and the page refreshes to show the new plan.

/** Onboard a new business, or talk to one that exists. The example business passes `readOnly`; `starters` are the first messages offered. */
export type ChatWindowProps =
  | { readonly mode: "intake" }
  | { readonly mode: "business"; readonly businessId: string; readonly readOnly?: boolean; readonly starters?: readonly string[] };

/** Render the chat for `props.mode`. */
export function ChatWindow(props: ChatWindowProps) {
  return props.mode === "intake" ? (
    <IntakeChat />
  ) : (
    <BusinessChat businessId={props.businessId} readOnly={props.readOnly ?? false} starters={props.starters ?? GENERIC_STARTERS} />
  );
}

// =============================================================================
// Requests
// =============================================================================

const LOAD_FAILED = "Anchored couldn't load this chat. Check your connection and try again.";

/** A request in flight or failed. `text` is the owner's words, shown before the server has them. */
interface Outgoing {
  readonly text: string | null;
  readonly status: "sending" | "failed";
  readonly error?: string;
  readonly retry?: () => void;
}

/** Run one chat request at a time, showing the owner's words while it runs and a retry when it fails. */
function useSender(): { outgoing: Outgoing | null; busy: boolean; run: (text: string | null, work: () => Promise<void>) => Promise<void> } {
  const [outgoing, setOutgoing] = useState<Outgoing | null>(null);
  async function run(text: string | null, work: () => Promise<void>): Promise<void> {
    setOutgoing({ text, status: "sending" });
    try {
      await work();
      setOutgoing(null);
    } catch (error) {
      setOutgoing({ text, status: "failed", error: errorText(error), retry: () => void run(text, work) });
    }
  }
  return { outgoing, busy: outgoing?.status === "sending", run };
}

/** Keep the newest message in view, jumping instead of gliding when the owner prefers less motion. */
function useStickToBottom(ref: RefObject<HTMLElement | null>, signal: unknown): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top: element.scrollHeight, behavior: still ? "auto" : "smooth" });
  }, [ref, signal]);

  // When the thread gets shorter, as when chips wrap or the slip opens, stay at the bottom if the owner was there.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let atBottom = true;
    const track = () => {
      atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
    };
    const observer = new ResizeObserver(() => {
      if (atBottom) element.scrollTop = element.scrollHeight;
    });
    element.addEventListener("scroll", track, { passive: true });
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", track);
      observer.disconnect();
    };
  }, [ref]);
}

// =============================================================================
// Onboarding
// =============================================================================

// The current intake survives a reload in this tab, so an accidental refresh doesn't lose the answers.
const INTAKE_KEY = "anchored.intake";

function savedIntakeId(): string | null {
  try {
    return window.sessionStorage.getItem(INTAKE_KEY);
  } catch {
    // Storage can be blocked; the chat then simply starts fresh.
    return null;
  }
}

function rememberIntake(id: string | null): void {
  try {
    if (id === null) window.sessionStorage.removeItem(INTAKE_KEY);
    else window.sessionStorage.setItem(INTAKE_KEY, id);
  } catch {
    // Storage can be blocked; resuming after a reload is a convenience only.
  }
}

/** An intake as the screen holds it. */
type IntakeView = IntakeResponse & { readonly intakeId: string };

/** The fields whose known value changed between two summaries, for the card to highlight. */
function changedFields(before: readonly KnownFact[], after: readonly KnownFact[]): ReadonlySet<string> {
  return new Set(after.filter((fact) => fact.value !== null && before.find((old) => old.field === fact.field)?.value !== fact.value).map((fact) => fact.field));
}

/** A key that changes whenever Anchored asks something new, so chip selections reset with each question. */
function questionKey(question: IntakeQuestion | null): string {
  return question ? `${question.field}\n${question.text}` : "";
}

function IntakeChat() {
  const router = useRouter();
  const [view, setView] = useState<IntakeView | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [selection, setSelection] = useState<{ readonly key: string; readonly values: readonly string[] }>({ key: "", values: [] });
  const [building, setBuilding] = useState(false);
  const { outgoing, busy, run } = useSender();
  const booted = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const focusNext = useRef(false);

  const question = view?.question ?? null;
  const key = questionKey(question);
  const picked = selection.key === key ? selection.values : (question?.options ?? []).filter((option) => option.selected).map((option) => option.value);

  async function start(): Promise<void> {
    await run(null, async () => {
      const opened = await callApi<StartIntakeResponse>("/api/intake", "POST");
      rememberIntake(opened.intakeId);
      setFresh(new Set());
      setView(opened);
    });
  }

  // Runs once on mount: resume this tab's intake, or start one. React's development
  // double-mount runs effects twice, and the ref keeps that to one intake.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const saved = savedIntakeId();
    if (saved === null) {
      void start();
      return;
    }
    void (async () => {
      try {
        const resumed = await getApi<IntakeResponse>(`/api/intake/${encodeURIComponent(saved)}`, LOAD_FAILED);
        if (!resumed.done) {
          setView({ ...resumed, intakeId: saved });
          return;
        }
      } catch {
        // A stale or reset intake can't be resumed; a new one starts below.
      }
      await start();
    })();
  }, []);

  // After an answer lands, put focus where the next answer goes: the first chip for a chip question, or the text box.
  // A text question's chips row holds only Skip, and focusing it would let Enter skip the question.
  const hasOptions = question?.options !== undefined;
  useEffect(() => {
    if (!focusNext.current || busy) return;
    focusNext.current = false;
    const chip = hasOptions ? chipsRef.current?.querySelector("button") : null;
    if (chip) chip.focus();
    else inputRef.current?.focus();
  }, [key, busy, hasOptions]);

  async function answer(request: IntakeAnswerRequest): Promise<void> {
    if (!view || !question || busy) return;
    const current = view;
    focusNext.current = true;
    // Confirming builds the plan, which takes longer than a question; the typing line says so.
    setBuilding(question.field === "confirm" && request.picks?.[0] === "yes");
    await run(answerText(question, request), async () => {
      const next = await callApi<IntakeResponse>(`/api/intake/${encodeURIComponent(current.intakeId)}`, "POST", request);
      setFresh(changedFields(current.known, next.known));
      setView({ ...next, intakeId: current.intakeId });
      if (next.done) rememberIntake(null);
    });
    setBuilding(false);
  }

  function toggle(value: string): void {
    setSelection({ key, values: picked.includes(value) ? picked.filter((item) => item !== value) : [...picked, value] });
  }

  function startOver(): void {
    rememberIntake(null);
    setView(null);
    void start();
  }

  // Typed words on a multi-select question carry the chips too, but only once the owner has touched them.
  const typed = (text: string) => answer(question?.multi && selection.key === key ? { text, picks: picked } : { text });
  const builtId = view?.done ? view.businessId : undefined;

  return (
    <div className={styles.chat}>
      <div className={`${styles.frame} ${styles.intake}`}>
        <Thread
          messages={view?.messages ?? []}
          outgoing={outgoing}
          typing={busy || view === null ? (building ? "Building your plan" : "typing") : null}
          label="Onboarding conversation with Anchored"
        />
        <ResizablePanel
          storageKey="chat-knows"
          side="left"
          defaultWidth={360}
          min={280}
          max={560}
          label="Resize What Anchored knows"
          className={styles.knowsPanel}
        >
          <KnowsCard known={view?.known ?? []} fresh={fresh} done={builtId !== undefined} onStartOver={startOver} disabled={busy} />
        </ResizablePanel>
        <div className={styles.composer}>
          {/* A reset or restarted server loses the intake, so a retry can't land; starting over always can. */}
          {outgoing?.status === "failed" && <FailLine error={outgoing.error} retry={outgoing.retry} startOver={view === null ? undefined : startOver} />}
          {builtId !== undefined ? (
            <div className={styles.ready}>
              <p>Your plan is ready to review.</p>
              <Button
                onClick={() => {
                  router.push(businessHref(builtId));
                  // The shell's sidebar and switcher were rendered before this business existed; refresh them to list it.
                  router.refresh();
                }}
                autoFocus
              >
                Open your plan
              </Button>
            </div>
          ) : (
            <>
              {question?.options && (
                <QuickReplies
                  question={question}
                  picked={picked}
                  disabled={busy || outgoing?.status === "failed"}
                  chipsRef={chipsRef}
                  onToggle={toggle}
                  onPick={(value) => void answer({ picks: [value] })}
                  onDone={() => void answer({ picks: picked })}
                  onSkip={() => void answer({ text: "Skip" })}
                />
              )}
              {question && !question.options && (
                <div className={styles.chips} role="group" aria-label="Quick replies" ref={chipsRef}>
                  <button type="button" className={styles.skip} onClick={() => void answer({ text: "Skip" })} disabled={busy || outgoing?.status === "failed"}>
                    Skip
                  </button>
                </div>
              )}
              <Composer
                inputRef={inputRef}
                placeholder={question?.multi ? "Or type it in your own words" : "Type your answer"}
                disabled={view === null || question === null || outgoing?.status === "failed"}
                busy={busy}
                onSend={(text) => void typed(text)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Business chat
// =============================================================================

function BusinessChat({
  businessId,
  readOnly,
  starters,
}: {
  readonly businessId: string;
  readonly readOnly: boolean;
  readonly starters: readonly string[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<readonly ChatMessage[] | null>(null);
  const { outgoing, busy, run } = useSender();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const url = `/api/businesses/${encodeURIComponent(businessId)}/chat`;

  useEffect(() => {
    let live = true;
    void run(null, async () => {
      const chat = await getApi<BusinessChatResponse>(url, LOAD_FAILED);
      if (live) setMessages(chat.messages);
    });
    return () => {
      live = false;
    };
    // `run` is recreated each render on purpose; loading depends only on which business this is.
  }, [url]);

  async function send(text: string): Promise<void> {
    if (busy || readOnly) return;
    await run(text, async () => {
      const chat = await callApi<BusinessChatResponse>(url, "POST", { text });
      setMessages(chat.messages);
      // Changed facts can add or drop workflows, so the page around the chat re-renders from the server.
      if (chat.changes.length > 0) router.refresh();
    });
    inputRef.current?.focus();
  }

  const fresh = messages !== null && messages.every((message) => message.role === "anchored");
  return (
    <div className={styles.chat}>
      <div className={`${styles.frame} ${styles.business}`}>
        <Thread messages={messages ?? []} outgoing={outgoing} typing={busy || messages === null ? "typing" : null} label="Conversation with Anchored about this business" />
        <div className={styles.composer}>
          {outgoing?.status === "failed" && <FailLine error={outgoing.error} retry={outgoing.retry} />}
          {readOnly ? (
            // Anchored's own message in the thread says why the example can't change; the footer only offers the way out.
            <div className={styles.readOnly}>
              <ButtonLink variant="secondary" size="sm" href={NEW_BUSINESS_HREF}>
                Start your own business
              </ButtonLink>
            </div>
          ) : (
            <>
              {fresh && (
                <div className={styles.chips} role="group" aria-label="Things you can tell Anchored">
                  {starters.map((starter) => (
                    <button key={starter} type="button" className={styles.chip} onClick={() => void send(starter)} disabled={busy}>
                      {starter}
                    </button>
                  ))}
                </div>
              )}
              <Composer inputRef={inputRef} placeholder="Tell Anchored what changed, and it updates your workflows" disabled={messages === null || outgoing?.status === "failed"} busy={busy} onSend={(text) => void send(text)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Shared pieces
// =============================================================================

/** The scrolling message list. New messages are announced to screen readers as they arrive. */
function Thread({
  messages,
  outgoing,
  typing,
  label,
}: {
  readonly messages: readonly ChatMessage[];
  readonly outgoing: Outgoing | null;
  readonly typing: string | null;
  readonly label: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useStickToBottom(scrollRef, `${messages.length}:${outgoing?.status ?? ""}:${typing ?? ""}`);
  return (
    <section className={styles.thread} aria-label={label}>
      <div className={styles.scroll} ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions">
        <ol className={styles.messages}>
          {messages.map((message) => (
            <MessageItem key={message.id} role={message.role} text={message.text} changes={message.changes} />
          ))}
          {outgoing?.text != null && <MessageItem role="owner" text={outgoing.text} state={outgoing.status} />}
          {typing !== null && (
            <li className={styles.theirs}>
              <span className={styles.avatar} aria-hidden="true">
                <Anchor size={15} strokeWidth={2.4} />
              </span>
              <p className={styles.typing}>
                <span className={styles.dots} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {typing === "typing" ? <span className={styles.srOnly}>Anchored is typing</span> : <span>{typing}</span>}
              </p>
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}

/** One message. An owner message that hasn't reached the server shows as sending or not sent. */
function MessageItem({ role, text, changes, state }: { readonly role: ChatMessage["role"]; readonly text: string; readonly changes?: readonly ProfileChange[]; readonly state?: Outgoing["status"] }) {
  const mine = role === "owner";
  return (
    <li className={mine ? styles.mine : styles.theirs} data-state={state}>
      {!mine && (
        <span className={styles.avatar} aria-hidden="true">
          <Anchor size={15} strokeWidth={2.4} />
        </span>
      )}
      <div className={styles.body}>
        <p className={styles.bubble}>
          <span className={styles.srOnly}>{mine ? "You said: " : "Anchored said: "}</span>
          {text}
        </p>
        {state === "failed" && <span className={styles.notSent}>Not sent</span>}
        {changes && changes.length > 0 && <ChangeList changes={changes} />}
      </div>
    </li>
  );
}

const OP_ICON: Readonly<Record<ProfileChange["op"], ReactNode>> = {
  added: <Plus size={14} strokeWidth={2.6} aria-hidden="true" />,
  removed: <Minus size={14} strokeWidth={2.6} aria-hidden="true" />,
  changed: <ArrowLeftRight size={14} strokeWidth={2.4} aria-hidden="true" />,
};

/** What one reply changed in the business, under the reply that says so. */
function ChangeList({ changes }: { readonly changes: readonly ProfileChange[] }) {
  return (
    <div className={styles.changes}>
      <p className={styles.changesTitle}>Updated in your plan</p>
      <ul>
        {changes.map((change) => (
          <li key={`${change.op}:${change.area}:${change.label}`} data-op={change.op}>
            {OP_ICON[change.op]}
            <span className={styles.srOnly}>{change.op}: </span>
            <span className={styles.area}>{CHANGE_AREA_LABEL[change.area]}</span>
            <span>{change.to === undefined ? change.label : `${change.label}: ${change.to}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Chips for the current question. Multi-select chips toggle and finish with Done; single ones answer at once. */
function QuickReplies({
  question,
  picked,
  disabled,
  chipsRef,
  onToggle,
  onPick,
  onDone,
  onSkip,
}: {
  readonly question: IntakeQuestion;
  readonly picked: readonly string[];
  readonly disabled: boolean;
  readonly chipsRef: RefObject<HTMLDivElement | null>;
  readonly onToggle: (value: string) => void;
  readonly onPick: (value: string) => void;
  readonly onDone: () => void;
  readonly onSkip: () => void;
}) {
  const options = question.options ?? [];
  const review = question.field === "confirm" || question.field === "change";
  const hinted = options.some((option) => option.suggested);
  return (
    <>
      <div className={styles.chips} role="group" aria-label={question.multi ? "Pick all that apply, then Done" : "Quick replies"} ref={chipsRef}>
        {options.map((option) =>
          question.multi ? (
            <button
              key={option.value}
              type="button"
              className={styles.chip}
              aria-pressed={picked.includes(option.value)}
              data-suggested={option.suggested || undefined}
              onClick={() => onToggle(option.value)}
              disabled={disabled}
            >
              {picked.includes(option.value) && <Check size={14} strokeWidth={2.8} aria-hidden="true" />}
              {option.label}
            </button>
          ) : (
            <button key={option.value} type="button" className={styles.chip} data-suggested={option.suggested || undefined} onClick={() => onPick(option.value)} disabled={disabled}>
              {option.label}
            </button>
          ),
        )}
        {question.multi && (
          <button type="button" className={styles.done} onClick={onDone} disabled={disabled}>
            {picked.length > 0 ? `Done (${picked.length})` : "None of these"}
          </button>
        )}
        {!review && (
          <button type="button" className={styles.skip} onClick={onSkip} disabled={disabled}>
            Skip
          </button>
        )}
      </div>
      {hinted && <p className={styles.hint}>Highlighted options are common for businesses like yours.</p>}
    </>
  );
}

/** The text box: Enter sends, Shift+Enter starts a new line. */
function Composer({
  inputRef,
  placeholder,
  disabled,
  busy,
  onSend,
}: {
  readonly inputRef: RefObject<HTMLTextAreaElement | null>;
  readonly placeholder: string;
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const id = useId();
  const ready = !disabled && !busy && text.trim() !== "";

  function submit(event?: FormEvent): void {
    event?.preventDefault();
    if (!ready) return;
    onSend(text.trim());
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter while an input method is composing picks a character; it must not send.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor={id} className={styles.srOnly}>
        Message Anchored
      </label>
      <textarea
        id={id}
        ref={inputRef}
        className={styles.input}
        rows={1}
        maxLength={2000}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        enterKeyHint="send"
      />
      <button type="submit" className={styles.send} disabled={!ready} aria-label="Send">
        <ArrowUp size={20} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </form>
  );
}

/** A failed request, said plainly, with a way to try again and, during onboarding, to start over. */
function FailLine({ error, retry, startOver }: { readonly error?: string; readonly retry?: () => void; readonly startOver?: () => void }) {
  return (
    <div className={styles.fail} role="alert">
      <CircleAlert size={18} strokeWidth={2.2} aria-hidden="true" />
      <p>{error ?? "That didn't go through."}</p>
      {retry && (
        <button type="button" className={styles.retry} onClick={retry}>
          Try again
        </button>
      )}
      {startOver && (
        <button type="button" className={styles.skip} onClick={startOver}>
          Start over
        </button>
      )}
    </div>
  );
}

/** The live "What Anchored knows" rail. In a narrow container it folds into a bar above the text box. */
function KnowsCard({
  known,
  fresh,
  done,
  onStartOver,
  disabled,
}: {
  readonly known: readonly KnownFact[];
  readonly fresh: ReadonlySet<string>;
  readonly done: boolean;
  readonly onStartOver: () => void;
  readonly disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const answered = known.filter((fact) => fact.state !== "open").length;
  const progress = known.length > 0 ? `${answered} of ${known.length}` : "";
  return (
    <aside className={styles.knows} aria-label="What Anchored knows" data-open={open || undefined}>
      <div className={styles.knowsHead}>
        <h2>What Anchored knows</h2>
        <span className={styles.count}>{progress}</span>
      </div>
      <button type="button" className={styles.knowsToggle} aria-expanded={open} aria-controls={listId} onClick={() => setOpen((value) => !value)}>
        <span>What Anchored knows</span>
        <span className={styles.count}>{progress}</span>
        <ChevronDown size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <ol className={styles.meter} aria-hidden="true">
        {known.map((fact) => (
          <li key={fact.field} data-state={fact.state} />
        ))}
      </ol>
      <dl className={styles.facts} id={listId}>
        {known.map((fact) => (
          <div key={`${fact.field}:${fact.value ?? fact.state}`} className={styles.fact} data-state={fact.state} data-fresh={fresh.has(fact.field) || undefined}>
            <dt>{fact.label}</dt>
            <dd>
              {fact.state === "known" ? fact.value : fact.state === "skipped" ? "Skipped" : <span className={styles.placeholder}><span className={styles.srOnly}>Not answered yet</span></span>}
            </dd>
          </div>
        ))}
      </dl>
      {done ? (
        <p className={styles.stamp}>Plan built</p>
      ) : (
        <div className={styles.knowsFoot}>
          <button type="button" className={styles.startOver} onClick={onStartOver} disabled={disabled}>
            <RotateCcw size={14} strokeWidth={2.4} aria-hidden="true" />
            Start over
          </button>
        </div>
      )}
    </aside>
  );
}
