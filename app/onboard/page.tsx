import { redirect } from "next/navigation";
import { NEW_BUSINESS_HREF } from "@/components/routes";

// =============================================================================
// Module Overview
// =============================================================================
// The old onboarding address. Onboarding moved to chat at `/app/new`, so
// links to `/onboard` redirect there.

/** Redirect `/onboard` to `/app/new`. */
export default function OldOnboardRoute(): never {
  redirect(NEW_BUSINESS_HREF);
}
