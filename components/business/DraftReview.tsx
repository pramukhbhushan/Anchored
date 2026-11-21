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
// One draft row in the overview's morning brief. It opens the same `AgentCard`
// the Approvals page shows, in a sheet, so the owner can decide it without
// leaving the overview. A link opens the card on the Approvals page, beside the
// outbox.

/** Render a brief row that opens `card` in a sheet for review. */
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
