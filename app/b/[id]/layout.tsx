import type { ReactNode } from "react";
import { BusinessSwitcher } from "@/components/BusinessSwitcher";
import { ResetDemoButton } from "@/components/ResetDemoButton";
import { StepTabs } from "@/components/StepTabs";
import { getBusinessOrNotFound, listBusinesses } from "@/lib/server/data";

// =============================================================================
// Module Overview
// =============================================================================
// The app chrome around every business page: the business name and trade, the
// business switcher, a "Reset demo" button and the five step tabs. Each page
// renders inside the `.view` wrapper below them.

/** Render the app bar and step tabs for the business in the URL. */
export default async function BusinessLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [business, businesses] = await Promise.all([getBusinessOrNotFound(id), listBusinesses()]);
  const where = business.place && business.place !== "Not given" ? ` in ${business.place}` : "";
  const options = businesses.map((b) => ({
    id: b.id,
    label: `${b.name}${b.kind === "custom" ? " (yours)" : " (case study)"}`,
  }));

  return (
    <>
      <div className="wrap">
        <div className="appbar">
          <div>
            <h2 style={{ fontSize: 26 }}>{business.name}</h2>
            <p className="muted small">
              {business.trade}
              {where} ({business.kind === "custom" ? "your business" : "case study"})
            </p>
          </div>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <BusinessSwitcher current={business.id} options={options} />
            <ResetDemoButton />
          </div>
        </div>
        <StepTabs businessId={business.id} />
      </div>
      <div className="wrap view">{children}</div>
    </>
  );
}
