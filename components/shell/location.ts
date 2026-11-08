import { useSelectedLayoutSegments } from "next/navigation";
import { sectionOf, type Section } from "@/components/routes";

// =============================================================================
// Module Overview
// =============================================================================
// Where the viewer is inside `/app`, read from the URL segments below the
// shell layout: the open business and section, or the list or the new-business
// chat. The sidebar, the switcher and the top bar all read it.

/** The viewer's place in the app. */
export type ShellLocation =
  | { readonly page: "home" }
  | { readonly page: "new" }
  | { readonly page: "business"; readonly businessId: string; readonly section: Section | null };

/** Return the viewer's place in the app. Call only from components the `/app` layout renders. */
export function useShellLocation(): ShellLocation {
  // Segments below `app/app/layout.tsx`: [] for /app, ["new"], or ["b", "<id>", "<section>"?].
  const [first, id, section] = useSelectedLayoutSegments();
  if (first === "new") return { page: "new" };
  if (first === "b" && id !== undefined) return { page: "business", businessId: id, section: sectionOf(section) };
  return { page: "home" };
}
