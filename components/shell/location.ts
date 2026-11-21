import { useSelectedLayoutSegments } from "next/navigation";
import { sectionOf, type Section } from "@/components/routes";

// =============================================================================
// Module Overview
// =============================================================================
// Where the viewer is inside `/app`, read from the URL segments below the
// shell layout: the open business, its section and agent, or the list or the
// new-business chat. The sidebar, the switcher and the top bar all read it.

/** The viewer's place in the app. */
export type ShellLocation =
  | { readonly page: "home" }
  | { readonly page: "new" }
  | {
      readonly page: "business";
      readonly businessId: string;
      readonly section: Section | null;
      /** The open agent's id, on `/workflows/<agent>`. */
      readonly agent?: string;
    };

/** Return `raw` URL-decoded, or as is when it isn't valid percent-encoding. */
function decoded(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Return the viewer's place in the app. Call only from components the `/app` layout renders. */
export function useShellLocation(): ShellLocation {
  // Segments below `app/app/layout.tsx`: [] for /app, ["new"], or ["b", "<id>", "<section>"?, "<agent or workflow>"?, "<automation>"?].
  const [first, id, section, segment, automation] = useSelectedLayoutSegments();
  if (first === "new") return { page: "new" };
  if (first === "b" && id !== undefined) {
    const where = { page: "business", businessId: id, section: sectionOf(section) } as const;
    // One segment under Workflows is an agent; two are a workflow and one of its automations.
    if (section !== "workflows" || segment === undefined || automation !== undefined) return where;
    return { ...where, agent: decoded(segment) };
  }
  return { page: "home" };
}
