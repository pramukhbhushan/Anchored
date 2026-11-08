"use client";

import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AgentCard } from "@/components/business/AgentCard";
import type { HandOffBusiness } from "@/components/business/handoff";
import { businessHref, cardAnchor } from "@/components/routes";
import { Sheet } from "@/components/ui/Sheet";
import type { CardRecord } from "@/lib/api/contract";
import styles from "./draft-review.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The morning brief opens the existing approval card without losing the
// owner's place. Decisions still use AgentCard's exact-text approval and
// server checks. A full-page link keeps the outbox one step away.

/** Open one brief draft in an accessible inspection sheet. */
export function DraftReview({
  card,
  business,
  source,
  canRewrite,
}: {
  readonly card: CardRecord;
  readonly business: HandOffBusiness;
  readonly source: string;
  readonly canRewrite: boolean;
}) {
  return (
    <Sheet
      title="Review this draft"
      description="Read the exact words below. Approving records your OK. Delivery details appear in Approvals."
      trigger={
        <button className={styles.row} type="button">
          <span>{card.title}</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      }
    >
      <p className={styles.label}>
        {card.to ? `For ${card.to}` : "Prepared for your business"}
      </p>
      <AgentCard
        card={card}
        business={business}
        source={source}
        canRewrite={canRewrite}
      />
      <Link
        className={styles.link}
        href={`${businessHref(card.businessId, "approvals")}#${cardAnchor(card.key)}`}
      >
        Open Approvals and outbox <ExternalLink size={14} aria-hidden="true" />
      </Link>
    </Sheet>
  );
}
