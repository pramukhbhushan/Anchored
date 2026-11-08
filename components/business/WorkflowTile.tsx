import styles from "@/components/business/visuals.module.css";
import { workflowIcon } from "@/components/business/workflow-icons";
import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// `WorkflowTile`, a workflow's icon in a small tinted square. It is decoration
// beside the workflow's name, which always sits next to it, so screen readers
// skip it. Plain markup, safe in server and client components.

/** Render the icon tile for workflow `id`; `small` sizes it for a chip. */
export function WorkflowTile({ id, small = false }: { readonly id: WorkflowId; readonly small?: boolean }) {
  const Icon = workflowIcon(id);
  return (
    <span className={small ? `${styles.tile} ${styles.tileSm}` : styles.tile} aria-hidden="true">
      <Icon size={small ? 14 : 18} strokeWidth={2} />
    </span>
  );
}
