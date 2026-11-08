import Link from "next/link";
import { businessHref } from "@/components/routes";
import { conflictLine, detailText, gapsFor, SOURCE_NAME } from "@/lib/domain/details";
import { FIELD_KEYS, FIELDS, isFilled } from "@/lib/domain/fields";
import type { BusinessProfile, CoreAgentId, ProfileChangeSource } from "@/lib/domain/types";
import { OWNER_TIME_ZONE } from "@/lib/domain/executor";
import type { ProfileVersion } from "@/lib/store/types";

// =============================================================================
// Module Overview
// =============================================================================
// The details agents work from beyond the onboarding answers, on the Profile
// page: each one with where it came from, any source that disagrees, then the
// must-have facts the business's agents still lack, and the profile's saved
// versions behind a closed disclosure. Server-rendered; it needs no client code.

const SAVED_AT = new Intl.DateTimeFormat("en-US", { timeZone: OWNER_TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const CHANGED_BY: Readonly<Record<ProfileChangeSource, string>> = {
  onboarding: "Onboarding",
  owner: "You",
  chat: "Chat",
  card_edit: "An edit on a card",
};

/** Render the details, what's still needed for `agents`, and the history. */
export function ProfileDetails({
  business,
  agents,
  versions,
  canChat,
}: {
  readonly business: BusinessProfile;
  readonly agents: readonly CoreAgentId[];
  readonly versions: readonly ProfileVersion[];
  readonly canChat: boolean;
}) {
  const state = { details: business.details ?? {}, evidence: business.evidence ?? {} };
  const known = FIELD_KEYS.filter((key) => key !== "examples" && isFilled(state.details, key));
  const missing = gapsFor(state, agents);

  return (
    <section className="panel prof" aria-labelledby="details-title">
      <header className="panel-head">
        <h2 className="panel-title" id="details-title">
          What agents work from
        </h2>
      </header>
      <dl className="prof-rows prof-details">
        {known.length === 0 && (
          <div className="prof-row">
            <dt>Details</dt>
            <dd className="muted">None yet. Agents ask you or the customer before they use a fact they don&apos;t have.</dd>
          </div>
        )}
        {known.map((key) => {
          const evidence = state.evidence[key];
          const conflict = conflictLine(key, state);
          return (
            <div className="prof-row" key={key}>
              <dt>{FIELDS[key].label}</dt>
              <dd>
                {detailText(key, state.details[key])}
                {evidence && (
                  <details className="prof-source">
                    <summary>{SOURCE_NAME[evidence.sourceType]}</summary>
                    <q>{evidence.quote}</q>
                  </details>
                )}
                {conflict && <p className="prof-conflict">{conflict}</p>}
              </dd>
            </div>
          );
        })}
        {missing.length > 0 && (
          <div className="prof-row">
            <dt>Still needed</dt>
            <dd>
              {missing.map((key) => FIELDS[key].label).join(", ")}.{" "}
              {canChat ? (
                <>
                  Tell Anchored in <Link href={businessHref(business.id, "chat")}>Chat</Link>, such as &quot;our minimum is $75&quot;.
                </>
              ) : (
                "Your agents ask before they use a fact they don't have."
              )}
            </dd>
          </div>
        )}
      </dl>
      {versions.length > 0 && (
        <details className="prof-history">
          <summary>History, {versions.length === 1 ? "1 version" : `${versions.length} versions`}</summary>
          <ol>
            {versions.map((version) => (
              <li key={version.version}>
                Version {version.version}: {CHANGED_BY[version.changedBy]}, {SAVED_AT.format(new Date(version.savedAt))}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
