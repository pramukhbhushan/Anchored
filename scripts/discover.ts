import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import { discoveryListingSchema } from "@/lib/domain/discovered";
import { withArticle } from "@/lib/domain/discovery";
import type { DiscoveryListing, WorkflowId } from "@/lib/domain/types";
import { BASE_WORKFLOWS, WORKFLOWS, WORKFLOW_IDS } from "@/lib/domain/workflows";
import { discoverTools } from "@/lib/server/discover";

// =============================================================================
// Module Overview
// =============================================================================
// `npm run discover`: runs the discovery agent for one or more workflows and
// appends what it finds to `lib/domain/discovered.json`. It reads `.env.local`;
// `--env-file` in front of the script points it at another file. The listings appear on
// the Tools page as "waiting for a person to check", with no score. A person
// reviews the file's diff before it merges, which is the check the queue
// promises. `--dry-run` prints the listings without writing them.

const FILE = new URL("../lib/domain/discovered.json", import.meta.url);

const USAGE = `Usage: npm run discover -- --workflow <id|base> [--business "<kind of business>"] [--dry-run]

  --workflow   One workflow id, or "base" for the five every business gets.
               Ids: ${WORKFLOW_IDS.join(", ")}
  --business   The kind of business to search for. Default: "small business".
  --dry-run    Print what the agent found without changing discovered.json.`;

/** The workflows `--workflow` names, or `null` when it names none. */
function workflowsFor(value: string | undefined): readonly WorkflowId[] | null {
  if (value === "base") return BASE_WORKFLOWS;
  const match = WORKFLOW_IDS.find((id) => id === value);
  return match ? [match] : null;
}

/** Read the listings already in the file. */
function readListings(): DiscoveryListing[] {
  return z.array(discoveryListingSchema).parse(JSON.parse(readFileSync(FILE, "utf8")));
}

/** Run the agent for each workflow, print each result, and save the new listings unless this is a dry run. */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      workflow: { type: "string" },
      business: { type: "string", default: "small business" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  const workflows = workflowsFor(values.workflow);
  if (values.help || workflows === null) {
    console.log(USAGE);
    process.exitCode = values.help ? 0 : 1;
    return;
  }

  const saved = readListings();
  const added: DiscoveryListing[] = [];
  for (const workflow of workflows) {
    console.log(`\nLooking for ${WORKFLOWS[workflow].name.toLowerCase()} tools for ${withArticle(values.business)}...`);
    const run = await discoverTools({ workflow, business: values.business, alsoKnown: added.map((listing) => listing.name) });
    const read = run.method === "search" ? `Searched the web and read ${run.pagesRead} pages.` : `Loaded ${run.pagesRead} vendor sites that name their tool.`;
    console.log(`${read} Found ${run.listings.length} new ${run.listings.length === 1 ? "tool" : "tools"}.`);
    for (const listing of run.listings) console.log(`  + ${listing.name}: ${listing.price} (${listing.source})`);
    for (const skip of run.skipped) console.log(`  - ${skip.name}: ${skip.reason}`);
    added.push(...run.listings);
  }

  if (added.length === 0) {
    console.log("\nNothing new to add.");
    return;
  }
  if (values["dry-run"]) {
    console.log(`\nDry run: ${added.length} listings not saved.`);
    return;
  }
  writeFileSync(FILE, `${JSON.stringify([...saved, ...added], null, 2)}\n`);
  console.log(`\nAdded ${added.length} ${added.length === 1 ? "listing" : "listings"} to lib/domain/discovered.json. Check each one, then open a PR with the change.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
  process.exitCode = 1;
});
