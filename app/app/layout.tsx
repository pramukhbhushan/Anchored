import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/account/AccountMenu";
import { APP_HREF } from "@/components/routes";
import { AppShell } from "@/components/shell/AppShell";
import { SIDEBAR_COOKIE } from "@/components/shell/nav";
import { businessSummaries } from "@/components/shell/shell-data";
import { loginHref } from "@/lib/auth/paths";
import { findViewer } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// The app shell for everything under `/app`: the sidebar with every business
// and its approvals count, the top bar with the switcher and the account menu.
// Pages render inside it.

/** Render the shell around the `/app` page, or send a signed-out visitor to sign in. */
export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const viewer = await findViewer();
  // `middleware.ts` already sends signed-out visitors to sign in; this covers a session that expired mid-request.
  if (viewer === null) redirect(loginHref(APP_HREF));
  const [businesses, jar] = await Promise.all([businessSummaries(), cookies()]);

  return (
    <AppShell
      businesses={businesses}
      initiallyCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      account={<AccountMenu viewer={viewer} />}
    >
      {children}
    </AppShell>
  );
}
