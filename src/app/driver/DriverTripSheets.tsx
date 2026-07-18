import type { DriverTripSheetPage } from "@/lib/admin/driver-trip-sheets";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <strong>{label}:</strong> {value}
    </p>
  );
}

export function DriverTripSheets({ pages }: { pages: DriverTripSheetPage[] }) {
  if (pages.length === 0) return null;

  return (
    <section
      className="driver-print-only driver-trip-sheets"
      aria-label="Printable Driver Trip Sheets"
    >
      {pages.map((page) => (
        <article
          key={page.pageId}
          id={page.pageId}
          className="driver-trip-sheet-page"
          data-truck={page.truck}
          data-trailer-load={page.trailerLoad}
          data-work-type={page.workType}
        >
          <header className="driver-trip-page-header">
            <div>
              <p className="driver-trip-kicker">Jumping Jax Driver Trip Sheet</p>
              <h1>{page.truckAndLoadLabel}</h1>
              <p>
                {page.workType === "delivery" ? "Delivery / Setup" : "Pickup"} ·{" "}
                {page.workDate || "Date TBD"}
              </p>
            </div>
            <div className="driver-trip-load-totals">
              <p className="driver-trip-kicker">Load totals</p>
              <ul>
                {page.loadTotalsLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </header>

          <div
            className={`driver-trip-grid driver-trip-grid-${page.sections.length}`}
          >
            {page.sections.map((section) => (
              <section
                key={section.sectionId}
                className="driver-trip-section-card"
                data-task-id={section.taskId}
              >
                <div className="driver-trip-section-head">
                  <div>
                    <p className="driver-trip-work-type">{section.workTypeLabel}</p>
                    <h2>{section.rentalName}</h2>
                    <p>
                      Stop {section.stopNumber} · {section.bookingReference}
                    </p>
                  </div>
                  {section.imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={section.imageSrc}
                      alt=""
                      className="driver-trip-thumb"
                    />
                  ) : null}
                </div>

                <div className="driver-trip-facts">
                  <Fact label="Customer" value={section.customerName} />
                  <Fact label="Address" value={section.eventAddress} />
                  <Fact label="Time" value={section.requestedTime} />
                  <Fact label="Dimensions" value={section.dimensionsLabel} />
                  <Fact label="Blowers" value={section.blowersLabel} />
                  <Fact label="Cords" value={section.cordsLabel} />
                  <Fact label="Tarps" value={section.tarpsLabel} />
                  <Fact label="Supplies" value={section.suppliesLabel} />
                  {section.setupLocation ? (
                    <Fact label="Placement" value={section.setupLocation} />
                  ) : null}
                  {section.setupSurface ? (
                    <Fact label="Surface" value={section.setupSurface} />
                  ) : null}
                  {section.setupAccess ? (
                    <Fact label="Access" value={section.setupAccess} />
                  ) : null}
                  {section.setupNotes ? (
                    <Fact label="Setup notes" value={section.setupNotes} />
                  ) : null}
                  {section.routeNotes ? (
                    <Fact label="Route notes" value={section.routeNotes} />
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
