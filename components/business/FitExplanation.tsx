"use client";

import { Popover } from "radix-ui";
import { FitRing } from "./FitRing";
import { CheckGrid } from "./CheckGrid";
import type { Rating } from "@/lib/domain/types";
import styles from "@/components/ui/inspection.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// A shadcn Popover composition makes the existing computed score inspectable
// by click, touch or keyboard. The same seven checks remain the source of
// the explanation; no model invents an extra recommendation.

/** Explain a tool's fit score with its recorded checks and source. */
export function FitExplanation({
  name,
  rating,
  checkedOn,
  sourceUrl,
}: {
  readonly name: string;
  readonly rating: Rating;
  readonly checkedOn: string;
  readonly sourceUrl: string | null;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.score}
          aria-label={`Why ${name} scores ${rating.total} out of 100`}
        >
          <FitRing total={rating.total} />
          <small>Why this fit?</small>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.popover}
          sideOffset={8}
          collisionPadding={16}
          aria-label={`Fit checks for ${name}`}
        >
          <h4>Why {name} fits</h4>
          <p>
            {rating.total} out of 100, based on seven checks for your business.
          </p>
          <CheckGrid rating={rating} />
          <p>
            Checked {checkedOn}.{" "}
            {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                Read the source
              </a>
            )}
          </p>
          <Popover.Close className="btn btn-secondary btn-sm">
            Close explanation
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
