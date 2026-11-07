import { MapPin, Store, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { asSentence } from "@/components/agent-labels";
import { businessHref } from "@/components/routes";
import { placeOf } from "@/components/view-helpers";
import type { BusinessProfile } from "@/lib/domain/types";
import { NOT_GIVEN } from "@/lib/domain/workflows";

// =============================================================================
// Module Overview
// =============================================================================
// The concise business profile: who the business is on one line, then its
// customers, channels, tools, languages, voice, rules and niche agents as short
// labelled rows. `ProfileCard` is the profile page; `ProfileSummary` is the
// overview's short card.

/** Drop onboarding's "Not given" placeholder from a list of answers. */
function given(values: readonly string[]): string[] {
  return values.filter((value) => value.trim() !== "" && value !== NOT_GIVEN);
}

/** Render one labelled row of the profile. */
function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="prof-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Render values as a plain comma list, or "Not given" when there are none. */
function List({ values }: { readonly values: readonly string[] }) {
  if (values.length === 0) return <span className="muted">Not given</span>;
  return <>{values.join(", ")}</>;
}

/** Render the business's kind, town and size on one line, each with an icon. */
function IdentityLine({ business }: { readonly business: BusinessProfile }) {
  const place = placeOf(business);
  const size = business.size.trim() === NOT_GIVEN ? "" : business.size.trim();
  return (
    <p className="prof-line">
      <span>
        <Store aria-hidden="true" size={15} />
        {business.trade}
      </span>
      {place !== null && (
        <span>
          <MapPin aria-hidden="true" size={15} />
          {place}
        </span>
      )}
      {size !== "" && (
        <span>
          <Users aria-hidden="true" size={15} />
          {size}
        </span>
      )}
    </p>
  );
}

/** Return the customers line, or `""` when onboarding didn't give one. */
function customersOf(business: BusinessProfile): string {
  const customers = business.customers.trim();
  return customers === NOT_GIVEN ? "" : customers;
}

/** Render the overview's short profile card: identity, customers, channels and tools, linking to the full profile. */
export function ProfileSummary({ business }: { readonly business: BusinessProfile }) {
  const customers = customersOf(business);
  return (
    <section className="panel prof prof-compact" aria-labelledby="profile-card-title">
      <header className="panel-head">
        <h2 className="panel-title" id="profile-card-title">
          Profile
        </h2>
        <Link className="btn btn-quiet btn-sm" href={businessHref(business.id, "profile")}>
          Open profile
        </Link>
      </header>
      <IdentityLine business={business} />
      <dl className="prof-rows">
        {customers !== "" && <Row label="Customers">{customers}</Row>}
        <Row label="Channels">
          <List values={given(business.reach)} />
        </Row>
        <Row label="Tools">
          <List values={given(business.tools)} />
        </Row>
      </dl>
    </section>
  );
}

/** Render the full profile; `rules` are the lines every agent follows, `footnote` says who wrote it. */
export function ProfileCard({
  business,
  rules,
  footnote,
}: {
  readonly business: BusinessProfile;
  readonly rules: readonly string[];
  readonly footnote?: ReactNode;
}) {
  const languages = given(business.languages);
  const customers = customersOf(business);
  const voice = business.voice.trim();

  return (
    <section className="panel prof" aria-labelledby="profile-title">
      <header className="prof-head">
        <h2 id="profile-title">{business.name}</h2>
        <IdentityLine business={business} />
      </header>
      <div className="prof-cols">
        <dl className="prof-rows">
          <Row label="Customers">{customers === "" ? <span className="muted">Not given</span> : customers}</Row>
          <Row label="Channels">
            <List values={given(business.reach)} />
          </Row>
          <Row label="Tools">
            <List values={given(business.tools)} />
          </Row>
          <Row label="Languages">{languages.length > 0 ? languages.join(", ") : <span className="muted">English</span>}</Row>
        </dl>
        <dl className="prof-rows">
          <Row label="Voice">
            {voice === "" ? (
              <span className="muted">Not given</span>
            ) : (
              <span className="prof-voice" title={voice}>
                &quot;{voice}&quot;
              </span>
            )}
          </Row>
          <Row label="Agent rules">
            <ul className="prof-rules">
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </Row>
          <Row label="Niche agents">
            {business.nicheAgents.length === 0 ? (
              <span className="muted">None. The five core agents cover this business.</span>
            ) : (
              <ul className="prof-agents">
                {business.nicheAgents.map((agent) => (
                  <li key={agent.id}>
                    <b>{agent.name} agent</b>
                    <span>{asSentence(agent.spawnedBecause)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Row>
        </dl>
      </div>
      {footnote !== undefined && <p className="prof-foot">{footnote}</p>}
    </section>
  );
}
