import {
  Calculator,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Handshake,
  Megaphone,
  PackageX,
  PhoneCall,
  ReceiptText,
  Repeat,
  ScrollText,
  ShoppingBasket,
  Star,
  UserPlus,
  UtensilsCrossed,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// One picture per workflow, so a workflow looks the same on the Workflows page,
// in a tool's "Covers" on the Tools page and anywhere else it is named.
// `WORKFLOW_ICONS` is exhaustive over `WorkflowId`; `workflowIcon` reads it.

/** The icon for each workflow, picked for what the owner sees, not how the agent works. */
export const WORKFLOW_ICONS: Readonly<Record<WorkflowId, LucideIcon>> = {
  calls: PhoneCall,
  books: Calculator,
  leads: UserPlus,
  social: Megaphone,
  quotes: ClipboardList,
  invoices: ReceiptText,
  disputes: PackageX,
  noshows: CalendarClock,
  scheduling: CalendarDays,
  reviews: Star,
  catering: UtensilsCrossed,
  snap: ShoppingBasket,
  licenses: ScrollText,
  memberships: Repeat,
  referrals: Handshake,
};

/** Return the icon for `id`; a workflow id saved before a rename falls back to a generic one. */
export function workflowIcon(id: WorkflowId): LucideIcon {
  // Saved choices are read back from the store, so an id can outlive its catalog entry.
  return WORKFLOW_ICONS[id] ?? Workflow;
}
