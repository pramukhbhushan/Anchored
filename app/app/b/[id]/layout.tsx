import type { ReactNode } from "react";
import { getBusinessOrNotFound } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// Resolves the business in the URL before any business page streams. This
// layout sits outside every `loading.tsx` boundary, so an unknown id reaches
// `notFound()` while the status can still change, and the response is a 404.

/** Render a business page, or the 404 page when the id matches nothing the viewer can open. */
export default async function BusinessLayout({ children, params }: { readonly children: ReactNode; readonly params: Promise<{ id: string }> }) {
  await getBusinessOrNotFound((await params).id);
  return children;
}
