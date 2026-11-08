import { Check } from "lucide-react";
import Link from "next/link";
import { ChooseButton } from "@/components/business/ChooseButton";
import type { ChangeOption } from "@/components/workflows/flow";
import styles from "@/components/workflows/graph.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// "Change who handles this" under a workflow on the graph: a native
// `<details>` that offers the other handlers as what would happen, each a
// button that saves through the choices route, plus the tool comparison.

/** Render the quiet disclosure with `options` for the workflow called `name`. */
export function ChangeHandler({
  businessId,
  name,
  options,
  compareHref,
}: {
  readonly businessId: string;
  readonly name: string;
  readonly options: readonly ChangeOption[];
  readonly compareHref: string;
}) {
  return (
    <details className={styles.change}>
      <summary className={styles.changeSummary}>
        Change who handles this<span className="sr"> for {name}</span>
      </summary>
      <div className={styles.changeBody}>
        <ul className={styles.options} aria-label={`Who could handle ${name}`}>
          {options.map((option) => (
            <li key={option.kind} data-kind={option.kind}>
              {option.current ? (
                <div className={styles.option} data-current="">
                  <OptionText option={option} />
                  <span className={styles.now}>
                    <Check aria-hidden="true" size={16} />
                    Handles it now
                  </span>
                </div>
              ) : (
                <ChooseButton businessId={businessId} request={option.request} className={styles.option} runner={option.runner}>
                  <OptionText option={option} />
                </ChooseButton>
              )}
            </li>
          ))}
        </ul>
        <Link className={styles.compare} href={compareHref} aria-label={`Compare tools for ${name}`}>
          Compare tools for this
        </Link>
      </div>
    </details>
  );
}

/** Render an option's outcome, what it means, and whether Anchored picked it. */
function OptionText({ option }: { readonly option: ChangeOption }) {
  return (
    <>
      <span className={styles.optionTitle}>
        {option.title}
        {option.ours && <span className={styles.ours}>Anchored&apos;s pick</span>}
      </span>
      <span className={styles.optionDetail}>{option.detail}</span>
    </>
  );
}
