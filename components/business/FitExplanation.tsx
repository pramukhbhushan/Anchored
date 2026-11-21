"use client";

import { Popover } from "radix-ui";
import { FitRing } from "./FitRing";
import { CheckGrid } from "./CheckGrid";
import { buttonClass } from "@/components/ui/Button";
import type { Rating } from "@/lib/domain/types";
import styles from "@/components/ui/inspection.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// A tool's fit ring as a button that opens a popover explaining the score: the
// seven checks behind it, when they were checked and the source. It works by
// click, touch or keyboard. The text comes from the rating alone, never from
// a model.

/** Render the fit ring that opens the explanation of `rating` for the tool `name`. */
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
          <Popover.Close className={buttonClass("secondary", "sm")}>
            Close explanation
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
