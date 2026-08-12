"use client";

import { useState, useTransition } from "react";

type JsonRecord = Record<string, unknown>;

const SAMPLE_BOOKING = {
  rentalItems: [{ rentalItem: "combo-bounce" }],
  customerName: "Demo Parent",
  customerEmail: "demo.parent@example.com",
  customerPhone: "555-0100",
  eventDateYmd: "2026-10-15",
  eventStartTime: "14:00",
  requestedDeliveryWindow: "12:00-13:00",
  eventAddress: "123 Demo Street, Greenwood SC",
  setupSurface: "grass",
  setupAccess: "side gate",
  paymentMethod: "Card",
};

export function AiReceptionistDemoClient() {
  const [pending, startTransition] = useTransition();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("What rentals do you deliver?");
  const [confidence, setConfidence] = useState(0.95);
  const [intent, setIntent] = useState<string>("");
  const [eventDate, setEventDate] = useState(SAMPLE_BOOKING.eventDateYmd);
  const [rentalItem, setRentalItem] = useState("combo-bounce");
  const [birthdayDate, setBirthdayDate] = useState("2026-08-11");
  const [lastCall, setLastCall] = useState<JsonRecord | null>(null);
  const [lastBirthday, setLastBirthday] = useState<JsonRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      setError(null);
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      }
    });
  }

  async function ensureSession(): Promise<string> {
    if (sessionId) return sessionId;
    const res = await fetch("/api/ai-receptionist/simulate/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: true, callerE164: "+15555550100" }),
    });
    const json = (await res.json()) as JsonRecord;
    if (!res.ok || json.ok !== true) {
      throw new Error(String(json.error ?? `HTTP ${res.status}`));
    }
    const session = json.session as JsonRecord | undefined;
    const id = typeof session?.id === "string" ? session.id : null;
    if (!id) throw new Error("Failed to start session");
    setSessionId(id);
    setLastCall(json);
    return id;
  }

  async function startSession() {
    await ensureSession();
  }

  async function sendTurn(overrides?: {
    text?: string;
    intent?: string;
    confidence?: number;
    includeBooking?: boolean;
    includeAvailability?: boolean;
    includePayment?: boolean;
  }) {
    const id = await ensureSession();

    const body: JsonRecord = {
      sessionId: id,
      text: overrides?.text ?? question,
      confidence: overrides?.confidence ?? confidence,
    };
    if (overrides?.intent || intent) {
      body.intent = overrides?.intent || intent;
    }
    if (overrides?.includeAvailability) {
      body.availability = { rentalItem };
    }
    if (overrides?.includeBooking) {
      body.booking = {
        ...SAMPLE_BOOKING,
        rentalItems: [{ rentalItem }],
        eventDateYmd: eventDate,
      };
      body.intent = "create_booking";
    }
    if (overrides?.includePayment) {
      body.intent = "send_payment_link";
    }

    const res = await fetch("/api/ai-receptionist/simulate/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as JsonRecord;
    if (!res.ok || json.ok !== true) {
      throw new Error(String(json.error ?? `HTTP ${res.status}`));
    }
    setLastCall(json);
  }

  async function runBirthday() {
    const childDob = "2018-09-22"; // six weeks after 2026-08-11
    const res = await fetch("/api/ai-receptionist/simulate/birthday-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        todayYmd: birthdayDate,
        candidates: [
          {
            participantId: "demo-child-1",
            submissionId: "demo-sub-1",
            childFirstName: "Jamie",
            childLastName: "Kid",
            childDobYmd: childDob,
            signerEmail: "parent@example.com",
            signerPhone: "555-0100",
            signerFirstName: "Pat",
            signerLastName: "Parent",
            waiverExpiresOn: "2028-01-01",
          },
          {
            participantId: "demo-child-2",
            submissionId: "demo-sub-1",
            childFirstName: "Riley",
            childLastName: "Kid",
            childDobYmd: "2016-09-22",
            signerEmail: "parent@example.com",
            signerPhone: "555-0100",
            signerFirstName: "Pat",
            signerLastName: "Parent",
            waiverExpiresOn: "2028-01-01",
          },
        ],
        contacts: [
          {
            id: "c1",
            emailNormalized: "parent@example.com",
            phoneE164: "+15555550100",
            smsMarketingOptIn: true,
            emailMarketingOptIn: true,
            smsOptedOutAt: null,
            emailOptedOutAt: null,
          },
        ],
        contactIdBySignerKey: { "parent@example.com": "c1" },
        exclusions: [],
        priorDeliveries: [],
      }),
    });
    const json = (await res.json()) as JsonRecord;
    if (!res.ok || json.ok !== true) {
      throw new Error(String(json.error ?? `HTTP ${res.status}`));
    }
    setLastBirthday(json);
  }

  const turn = lastCall?.turn as JsonRecord | undefined;
  const audit = Array.isArray(lastCall?.audit) ? (lastCall?.audit as JsonRecord[]) : [];

  return (
    <div className="mt-6 space-y-6">
      <div className="sticky top-0 z-20 rounded-xl border-2 border-amber-500 bg-amber-100 px-4 py-3 text-center text-sm font-black tracking-wide text-amber-950 shadow-sm">
        SIMULATION — NO LIVE ACTIONS
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black">Call simulator</h2>
        <p className="mt-2 text-sm text-slate-600">
          Owner-only dry run. Uses simulated phone, voice, SMS, email, and payment
          stubs. Pending bookings use the in-memory simulator on this API (not live
          inventory writes).
        </p>

        <div className="mt-4 grid gap-3">
          <label className="text-sm font-bold text-slate-800">
            Caller question
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-bold text-slate-800">
              Confidence (0–1)
              <input
                type="number"
                step="0.05"
                min={0}
                max={1}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
              />
            </label>
            <label className="text-sm font-bold text-slate-800">
              Intent override (optional)
              <select
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
              >
                <option value="">Auto-detect</option>
                <option value="faq">faq</option>
                <option value="check_availability">check_availability</option>
                <option value="create_booking">create_booking</option>
                <option value="send_payment_link">send_payment_link</option>
                <option value="escalate_human">escalate_human</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-800">
              Rental slug
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
                value={rentalItem}
                onChange={(e) => setRentalItem(e.target.value)}
              />
            </label>
          </div>
          <label className="text-sm font-bold text-slate-800">
            Booking event date
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            onClick={() => run(startSession)}
          >
            Start session
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
            onClick={() => run(() => sendTurn())}
          >
            Send question
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
            onClick={() =>
              run(() =>
                sendTurn({
                  text: "Is this rental available?",
                  intent: "check_availability",
                  includeAvailability: true,
                }),
              )
            }
          >
            Test availability
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
            onClick={() =>
              run(() =>
                sendTurn({
                  text: "Please book this rental",
                  includeBooking: true,
                }),
              )
            }
          >
            Test pending booking
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
            onClick={() =>
              run(() =>
                sendTurn({
                  text: "Send a deposit link",
                  includePayment: true,
                }),
              )
            }
          >
            Test payment stub
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
            onClick={() =>
              run(() =>
                sendTurn({
                  text: "I want to talk to a real person",
                  intent: "escalate_human",
                  confidence: 0.99,
                }),
              )
            }
          >
            Test escalation
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
            onClick={() =>
              run(() =>
                sendTurn({
                  text: "uhh maybe",
                  confidence: 0.2,
                }),
              )
            }
          >
            Test low confidence
          </button>
        </div>

        {sessionId ? (
          <p className="mt-3 text-xs font-semibold text-slate-500">
            Session: {sessionId}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-black">Birthday offer dry-run</h2>
        <p className="mt-2 text-sm text-slate-600">
          Runs eligibility for a chosen America/New_York business date. Sample
          includes two children on one waiver; SMS/email ledgers are redacted.
        </p>
        <label className="mt-4 block text-sm font-bold text-slate-800">
          Simulation date (offer day)
          <input
            type="date"
            className="mt-1 w-full max-w-xs rounded-xl border border-slate-300 px-3 py-2 font-normal"
            value={birthdayDate}
            onChange={(e) => setBirthdayDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={pending}
          className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          onClick={() => run(runBirthday)}
        >
          Run birthday simulation
        </button>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
          {error}
        </p>
      ) : null}

      {turn ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black">Latest call output</h2>
          <p className="mt-2 text-xs font-black uppercase tracking-wide text-amber-700">
            {String(lastCall?.banner ?? "SIMULATION — NO LIVE ACTIONS")}
          </p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="font-bold text-slate-700">Intent</dt>
              <dd>{String(turn.intent ?? "")}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-700">Assistant reply (PII redacted)</dt>
              <dd className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3">
                {String(turn.reply ?? "")}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-slate-700">Disclosure spoken</dt>
              <dd>{turn.spokenDisclosure ? "yes" : "no"}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-700">Escalated</dt>
              <dd>{turn.escalated ? "yes" : "no"}</dd>
            </div>
            {turn.payment ? (
              <div>
                <dt className="font-bold text-amber-800">Simulated payment</dt>
                <dd className="mt-1 rounded-xl border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-950">
                  {JSON.stringify(turn.payment, null, 2)}
                </dd>
              </div>
            ) : null}
            {turn.booking ? (
              <div>
                <dt className="font-bold text-slate-700">Booking result</dt>
                <dd className="mt-1 rounded-xl bg-slate-50 p-3 font-mono text-xs">
                  {JSON.stringify(turn.booking, null, 2)}
                </dd>
              </div>
            ) : null}
          </dl>

          <h3 className="mt-6 text-lg font-black">Audit timeline</h3>
          <ol className="mt-3 space-y-2">
            {audit.map((event) => (
              <li
                key={String(event.id)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              >
                <span className="font-bold">{String(event.eventType)}</span>
                <span className="ml-2 text-slate-500">{String(event.createdAtIso)}</span>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-slate-700">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {lastBirthday ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black">Birthday simulation output</h2>
          <p className="mt-2 text-xs font-black uppercase tracking-wide text-amber-700">
            {String(lastBirthday.banner ?? "SIMULATION — NO LIVE ACTIONS")}
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="font-black">Offer ledger</h3>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-50 p-3 text-[11px]">
                {JSON.stringify(lastBirthday.ledger, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="font-black">Simulated SMS / email (redacted)</h3>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950">
                {JSON.stringify(
                  {
                    smsLedger: lastBirthday.smsLedger,
                    emailLedger: lastBirthday.emailLedger,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
