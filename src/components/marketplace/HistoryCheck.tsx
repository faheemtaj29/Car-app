import type { HistoryReport } from "@/backend/services/history.service";
import { formatPKR } from "@/lib/dealership";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "History check" card on a listing: past listings, price trail, odometer warning. */
export function HistoryCheck({ report }: { report: HistoryReport }) {
  if (!report.identified) {
    return (
      <div className="hc">
        <p className="mk-muted">
          The seller has not provided a registration or chassis number, so this car cannot be matched against earlier listings.
          Ask for the registration book before you pay.
        </p>
      </div>
    );
  }
  const others = report.timesListed - 1;
  return (
    <div className="hc">
      <div className="hc-badges">
        {report.mileageWarning ? (
          <span className="hc-badge bad">⚠ Mileage may be tampered</span>
        ) : (
          <span className="hc-badge good">✓ No odometer rollback found</span>
        )}
        <span className={`hc-badge ${others ? "info" : "good"}`}>
          {others ? `Listed ${report.timesListed} times on this site` : "First time listed here"}
        </span>
        {report.sellers > 1 ? <span className="hc-badge info">{report.sellers} different sellers</span> : null}
      </div>

      {report.mileageWarning ? (
        <div className="hc-warn">
          On {day(report.mileageWarning.earlierAt)} this car was listed with <b>{report.mileageWarning.earlierKm.toLocaleString()} km</b>.
          On {day(report.mileageWarning.laterAt)} it showed <b>{report.mileageWarning.laterKm.toLocaleString()} km</b>, which is lower.
          Have the odometer and service records checked before buying.
        </div>
      ) : null}

      {report.events.length > 1 ? (
        <ol className="hc-timeline">
          {report.events.map((e, i) => (
            <li key={i} className={e.thisListing ? "this" : undefined}>
              <span className="hc-date">{day(e.at)}</span>
              <span>{e.source === "dealer" ? "Dealer" : "Private seller"}{e.city ? ` · ${e.city}` : ""}</span>
              <span>{e.mileage.toLocaleString()} km</span>
              <b>{formatPKR(e.price)}</b>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="mk-muted small">Based on listings on this website only, matched by registration and chassis number.</p>
    </div>
  );
}
