import { redirect } from "next/navigation";
import { businessHref, sectionOf, type Section } from "@/components/routes";

// =============================================================================
// Module Overview
// =============================================================================
// Old business links, `/b/<id>/<step>`, from before the app moved under `/app`.
// Each redirects to its new home, keeping the query string, so shared links
// and bookmarks still land. `agents` became Approvals and `compare` became Tools.

// Steps that were renamed; every other old step kept its name.
const RENAMED: Readonly<Record<string, Section>> = { agents: "approvals", compare: "tools" };

/** Rebuild a query string from Next's parsed `searchParams`, repeating keys that had several values. */
function queryOf(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  const text = query.toString();
  return text === "" ? "" : `?${text}`;
}

/** Return `segment` percent-decoded, or as is when it isn't valid encoding. */
function decodeSegment(segment: string): string {
  // `businessHref` encodes the id again, so an id must reach it decoded or it would be encoded twice.
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Redirect `/b/<id>/<step>` to `/app/b/<id>/<section>`. */
export default async function OldBusinessRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<{ path: string[] }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ path }, query] = await Promise.all([params, searchParams]);
  const [rawId = "", step] = path;
  const id = decodeSegment(rawId);
  const section = step === undefined ? null : (RENAMED[step] ?? sectionOf(step));
  redirect(`${businessHref(id, section)}${queryOf(query)}`);
}
