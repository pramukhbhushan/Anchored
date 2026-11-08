import type { ShellLocation } from "@/components/shell/location";
import type { BusinessSummary } from "@/components/shell/shell-data";

// =============================================================================
// Module Overview
// =============================================================================
// The businesses the shell tests open: two the owner made and the example,
// each with the approvals count the sidebar shows, plus the places a viewer
// can be. Test data only; nothing in the app imports this.

export const GREENFIELD: BusinessSummary = {
  id: "greenfield",
  name: "Greenfield Lawn",
  trade: "Landscaping",
  kind: "custom",
  pending: 2,
};

export const ROSA: BusinessSummary = { id: "rosa", name: "Rosa's Taqueria", trade: "Restaurant", kind: "case", pending: 3 };

export const APEX: BusinessSummary = { id: "apex", name: "Apex Heating", trade: "HVAC", kind: "custom", pending: null };

export const BUSINESSES: readonly BusinessSummary[] = [ROSA, APEX, GREENFIELD];

export const AT_HOME: ShellLocation = { page: "home" };

export const AT_NEW: ShellLocation = { page: "new" };

/** The viewer on one business's `section`, or its overview when `section` is `null`. */
export function atBusiness(businessId: string, section: Extract<ShellLocation, { page: "business" }>["section"]): ShellLocation {
  return { page: "business", businessId, section };
}
