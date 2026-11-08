import { useSelectedLayoutSegments } from "next/navigation";
import { sectionOf, type Section } from "@/components/routes";

// =============================================================================
// Module Overview
// =============================================================================
// Where the viewer is inside `/app`, read from the URL segments below the
// shell layout: the open business and section, the agent workspace open under
// Workflows, or the list or the new-business chat. The sidebar, the switcher
// and the top bar all read it.

/** The viewer's place in the app. */
export type ShellLocation =
  | { readonly page: "home" }
  | { readonly page: "new" }
  | {
      readonly page: "business";
      readonly businessId: string;
      readonly section: Section | null;
      /** The agent workspace open at `/workflows/<agent>`. */
      readonly agent?: string;
    };

/** Decode a route token without letting a malformed URL take down the shell. */
function routeToken(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Return the viewer's place in the app. Call only from components the `/app` layout renders. */
export function useShellLocation(): ShellLocation {
  // Segments below `app/app/layout.tsx`: [] for /app, ["new"], or ["b", "<id>", "<section>"?, "<agent>"?].
  const [first, id, section, segment] = useSelectedLayoutSegments();
  if (first === "new") return { page: "new" };
  if (first === "b" && id !== undefined) {
    const where = { page: "business", businessId: id, section: sectionOf(section) } as const;
    return section === "workflows" && segment !== undefined ? { ...where, agent: routeToken(segment) } : where;
  }
  return { page: "home" };
}
