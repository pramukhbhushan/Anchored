# Anchored UI integration plan

November 8, 2026. UI work is isolated in `/private/tmp/anchored-shadcn`, based on `eric-design-testing` at c7e0993 with a snapshot of the in-progress server changes for validation only.

## File ownership

This work owns the overview page, WorkflowMap, MonthlyBill, CompareBoard, CommandPalette, ChatWindow, their new UI helpers, focused tests, package.json and package-lock.json. It does not edit Approvals, API routes, domain rules, store methods, migrations, dispatch or the stage 1 to 4 handoff files. Existing resize behavior is reused.

## Build order

1. Add shadcn-style Sheet and Popover compositions over Radix primitives, adapted to existing CSS tokens rather than introducing a global reset. Retain the MIT license. Keep full-width pages, accessible focus handling, reduced motion and phone layouts.
2. Open morning-brief drafts in the review sheet, reusing AgentCard and its existing server decision path. Keep the full Approvals page available.
3. Replace the workflow map's custom modal with the accessible sheet. Show a clear, static process with the owner's approval step highlighted, never imply an example has actually sent.
4. Add a Recharts cost bar and selectable paid pieces that highlight the corresponding bill groups. Preserve the text equivalent, already-paid tools and quoted-price exclusions.
5. Add click-to-inspect fit explanations, polish the existing command palette with cmdk, and expose actual onboarding fact completion using Radix Progress.
6. Run focused owner-behavior tests and the complete project checks under Node 26. Verify desktop and phone layouts in a dedicated local server. Compare owned-file hashes before copying to the user's branch so concurrent edits are never overwritten.

## Integration

Copy only owned UI files and dependency manifests after checking their baseline hashes. No automatic commit, push, deployment or changes to the other process's files. Record remaining validation limits here.

## Sources

- https://github.com/shadcn-ui/ui
- https://ui.shadcn.com/docs/components/sheet
- https://ui.shadcn.com/docs/components/popover
- https://ui.shadcn.com/docs/components/chart
- https://ui.shadcn.com/docs/components/command
- https://ui.shadcn.com/docs/components/progress

## Completed

All six UI enhancements are integrated as uncommitted changes on `eric-design-testing`. Added packages: `radix-ui`, `cmdk`, and `recharts`. The shared working folder has the dependencies installed. The UI uses shadcn component compositions adapted to Anchored's CSS modules, with no global CSS reset. Existing resizing remains in place.

The review sheet reuses AgentCard, the workflow inspector labels planned behavior rather than claiming delivery, the bill uses real calculated costs, tool scores expose recorded evidence, comparison tabs separate costs, command search retains its existing destinations, and onboarding progress counts reviewed facts.

Browser checks passed at 1440, 768 and 390 pixels for draft review, fit explanations and the bill. No sideways scrolling or page errors occurred. Separate browser checks passed workflow focus containment, command navigation, comparison tabs and the actual onboarding progress count. Comparison backdrop handling was corrected so selecting a shorter tab cannot accidentally dismiss the centered dialog.

Validation uses Node 26. The complete checks pass with 1,567 tests and a production build against a fresh snapshot of the concurrent work. `git diff --check` is clean. Live provider sends were not exercised. Dependency audit reports the existing Next.js and PostCSS findings, with no findings attributed to the added UI packages. The fetched upstream MIT license is retained alongside this plan.

Only the 22 owned files were copied into the shared branch after verifying their original hashes. No stage 1 to 4 server file was overwritten. No commit, push, migration or deployment was performed. The isolated preview runs at http://127.0.0.1:3117/app/b/restaurant.
