import { ArrowLeftRight, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { ChatMessage } from "@/lib/api/contract";
import { DEMO_TIME_ZONE } from "@/lib/domain/executor";
import { CHANGE_AREA_LABEL, type ProfileChange } from "@/lib/domain/intake";

// =============================================================================
// Module Overview
// =============================================================================
// "Recent changes" on the profile page: what the business chat changed, newest
// first, read from the stored chat replies. Each change is named with
// `CHANGE_AREA_LABEL`, the same words the chat shows under each reply.

const SHOWN = 8;

const OP: Readonly<Record<ProfileChange["op"], { readonly icon: ReactNode; readonly word: string }>> = {
  added: { icon: <Plus size={14} aria-hidden="true" />, word: "Added" },
  removed: { icon: <Minus size={14} aria-hidden="true" />, word: "Removed" },
  changed: { icon: <ArrowLeftRight size={14} aria-hidden="true" />, word: "Changed" },
};

/** One change with the time of the reply that made it. */
interface DatedChange {
  readonly at: string;
  readonly change: ProfileChange;
}

/** Return the latest `SHOWN` changes across `messages`, newest first. */
function latestChanges(messages: readonly ChatMessage[]): DatedChange[] {
  // Messages arrive oldest first, so reversing puts the newest reply's changes on top.
  return messages
    .flatMap((message) => (message.changes ?? []).map((change) => ({ at: message.at, change })))
    .reverse()
    .slice(0, SHOWN);
}

/** Return a reply's time as "Nov 7, 3:12 PM". */
function whenText(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DEMO_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Render the latest changes the chat made, or what to do to make one. */
export function RecentChanges({ messages, isSample }: { readonly messages: readonly ChatMessage[]; readonly isSample: boolean }) {
  const changes = latestChanges(messages);
  if (changes.length === 0) {
    return (
      <p className="muted">
        {isSample
          ? "Sample businesses don't change. Start your own business to see your edits here."
          : "Nothing changed yet. Tell Anchored about a new service, tool or channel in the chat, and each change lands here."}
      </p>
    );
  }
  return (
    <ul className="changes-list">
      {changes.map(({ at, change }) => (
        <li key={`${at}:${change.op}:${change.area}:${change.label}`}>
          {OP[change.op].icon}
          <span>
            <span className="sr">{OP[change.op].word}: </span>
            <b>{CHANGE_AREA_LABEL[change.area]}</b> {change.to === undefined ? change.label : `${change.label}: ${change.to}`}
          </span>
          <time dateTime={at}>{whenText(at)}</time>
        </li>
      ))}
    </ul>
  );
}
