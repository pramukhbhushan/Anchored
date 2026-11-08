"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createBrowserSupabase } from "@/lib/auth/browser";
import { isAuthEnabled } from "@/lib/auth/config";

// =============================================================================
// Module Overview
// =============================================================================
// Keeps Approvals current in production. Supabase Realtime watches only this
// business's card rows under the signed-in owner's RLS policy, then refreshes
// the server-rendered feed after an insert, update or delete.

/** Subscribe the open Approvals page to card changes for one business. */
export function CardFeedRealtime({ businessId }: { readonly businessId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthEnabled()) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`cards:${businessId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards", filter: `business_id=eq.${businessId}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, router]);

  return null;
}
