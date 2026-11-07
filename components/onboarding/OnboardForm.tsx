"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { callApi, errorText } from "@/components/api";
import { businessHref } from "@/components/routes";
import { useToast } from "@/components/ui/Toast";
import type { CreateBusinessResponse } from "@/lib/api/contract";
import { hintFor } from "@/lib/domain/engine";
import { LANGUAGE_OPTIONS, REACH_OPTIONS, SIGNALS, TOOL_OPTIONS } from "@/lib/domain/workflows";
import type { OnboardingAnswers, SignalId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The one-page onboarding form, the alternative to chat. It starts empty, with
// a landscaping company's answers as placeholders to show the kind of answer
// that helps. As the owner types the kind of business, `hintFor` suggests boxes
// that businesses like it often tick; a suggestion is a chip the owner taps to
// tick its box, and nothing is ticked from the trade alone.

/** The four checkbox groups, by the form field name each one posts under. */
type Group = "reach" | "tools" | "signals" | "languages";
type Picked = Readonly<Record<Group, ReadonlySet<string>>>;

/** What a fresh form has ticked: nothing but English, which nearly every owner works in. */
const START_PICKED: Picked = {
  reach: new Set(),
  tools: new Set(),
  signals: new Set(),
  languages: new Set(["English"]),
};

/** One pill-shaped checkbox in a `.pick` group. */
interface PickOption {
  readonly value: string;
  readonly label: string;
}

const asOptions = (values: readonly string[]): PickOption[] => values.map((v) => ({ value: v, label: v }));

const OPTIONS: Readonly<Record<Group, readonly PickOption[]>> = {
  reach: asOptions(REACH_OPTIONS),
  tools: asOptions(TOOL_OPTIONS),
  signals: SIGNALS.map((s) => ({ value: s.id, label: s.label })),
  languages: asOptions(LANGUAGE_OPTIONS),
};

/** A hint chip: the box it ticks and the short text it shows. */
interface Suggestion {
  readonly group: Group;
  readonly value: string;
  readonly label: string;
}

const SIGNAL_IDS: ReadonlySet<string> = new Set(SIGNALS.map((s) => s.id));

/** Narrow a checkbox value to a known `SignalId`. */
function isSignalId(value: string): value is SignalId {
  return SIGNAL_IDS.has(value);
}

/** Return the hint chips for `kind`, keeping only suggestions that have a box on this form. */
function suggestionsFor(kind: string): Suggestion[] {
  if (kind.trim() === "") return [];
  const hint = hintFor(kind);
  const has = (group: Group, value: string) => OPTIONS[group].some((o) => o.value === value);
  return [
    ...hint.signals.flatMap((id) => {
      const signal = SIGNALS.find((s) => s.id === id);
      return signal ? [{ group: "signals" as const, value: id, label: signal.short }] : [];
    }),
    ...hint.reach.filter((r) => has("reach", r)).map((r) => ({ group: "reach" as const, value: r, label: r })),
    ...hint.tools.filter((t) => has("tools", t)).map((t) => ({ group: "tools" as const, value: t, label: t })),
  ];
}

/** Return the trimmed text of one form field, or `""` when it is missing. */
function textOf(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Read the text fields from the form and the ticked boxes from `picked`. */
function readAnswers(form: FormData, picked: Picked): OnboardingAnswers {
  return {
    name: textOf(form, "name"),
    kind: textOf(form, "kind"),
    what: textOf(form, "what"),
    week: textOf(form, "week"),
    voice: textOf(form, "voice"),
    reach: [...picked.reach],
    tools: [...picked.tools],
    signals: [...picked.signals].filter(isSignalId),
    languages: [...picked.languages],
  };
}

/** Render one group of pill checkboxes, ticked from `picked`. */
function PickGroup({
  group,
  picked,
  onToggle,
}: {
  readonly group: Group;
  readonly picked: ReadonlySet<string>;
  readonly onToggle: (group: Group, value: string) => void;
}) {
  return (
    <div className="pick">
      {OPTIONS[group].map((option) => (
        <label key={option.value}>
          <input
            type="checkbox"
            name={group}
            value={option.value}
            checked={picked.has(option.value)}
            onChange={() => onToggle(group, option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

/** Render the onboarding form; `aiName` names the server's AI provider, or is `null` when AI is off. */
export function OnboardForm({ aiName }: { readonly aiName: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState("");
  const [picked, setPicked] = useState<Picked>(START_PICKED);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const suggestions = useMemo(() => suggestionsFor(kind), [kind]);

  function toggle(group: Group, value: string) {
    setPicked((current) => {
      const next = new Set(current[group]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...current, [group]: next };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answers = readAnswers(new FormData(event.currentTarget), picked);
    if (answers.name === "" || answers.kind === "") {
      setProgress("Add your business name and what kind of business it is, then try again.");
      return;
    }
    setBusy(true);
    setProgress(aiName ? `${aiName} is reading your answers. This can take up to a minute.` : "Building your plan...");
    try {
      const { id, business } = await callApi<CreateBusinessResponse>("/api/businesses", "POST", {
        from: "answers",
        answers,
      });
      toast(`Plan built for ${business.name}`);
      router.push(businessHref(id));
      // The shell's sidebar and switcher were rendered before this business existed; refresh them to list it.
      router.refresh();
    } catch (error) {
      setProgress(errorText(error));
      setBusy(false);
    }
  }

  return (
    <form className="ob panel" onSubmit={submit}>
      <div className="field">
        <label htmlFor="ob-name">Business name and town</label>
        <input type="text" id="ob-name" name="name" placeholder="Greenfield Lawn & Landscape, Bowie, MD" />
      </div>
      <div className="field">
        <label htmlFor="ob-kind">What kind of business is it?</label>
        <input
          type="text"
          id="ob-kind"
          name="kind"
          placeholder="Landscaping company"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        />
        {suggestions.length > 0 && (
          <div role="group" aria-labelledby="ob-hints" style={{ marginTop: 10 }}>
            <p className="exlabel" id="ob-hints">
              Businesses like yours often... Tap one to tick its box below.
            </p>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {suggestions.map((s) => (
                <button
                  key={`${s.group}:${s.value}`}
                  type="button"
                  className="tab"
                  aria-pressed={picked[s.group].has(s.value)}
                  onClick={() => toggle(s.group, s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor="ob-what">What do you sell, to whom, and for how much?</label>
        <textarea
          id="ob-what"
          name="what"
          placeholder="Weekly mowing at $45 a visit, spring cleanups around $350, and patios from $2,000. Mostly homeowners. Crew of 4 plus me."
        />
      </div>
      <fieldset className="field">
        <legend>How do customers reach you?</legend>
        <PickGroup group="reach" picked={picked.reach} onToggle={toggle} />
      </fieldset>
      <fieldset className="field">
        <legend>What do you use today?</legend>
        <PickGroup group="tools" picked={picked.tools} onToggle={toggle} />
      </fieldset>
      <fieldset className="field">
        <legend>Which of these are true?</legend>
        <PickGroup group="signals" picked={picked.signals} onToggle={toggle} />
      </fieldset>
      <fieldset className="field">
        <legend>Languages you and your staff work in</legend>
        <PickGroup group="languages" picked={picked.languages} onToggle={toggle} />
      </fieldset>
      <div className="field">
        <label htmlFor="ob-week">What do you do every week that you wish someone else did?</label>
        <textarea
          id="ob-week"
          name="week"
          placeholder="Writing up quotes at night, calling people back when I'm on a mower, chasing deposits."
        />
      </div>
      <div className="field">
        <label htmlFor="ob-voice">Paste or type a reply you&apos;ve sent a customer</label>
        <textarea
          id="ob-voice"
          name="voice"
          placeholder="Hey! Thanks for reaching out. I can swing by Thursday afternoon to take a look and give you a price."
        />
      </div>
      <div className="row">
        <button className="btn" type="submit" disabled={busy}>
          Build my plan
        </button>
        <span className="progress" role="status">
          {progress}
        </span>
      </div>
      <p className="tiny muted">
        {aiName
          ? `${aiName} reads your answers and writes your profile in your words.`
          : "No AI provider is set up here, so Anchored maps your answers with its own rules."}
      </p>
    </form>
  );
}
