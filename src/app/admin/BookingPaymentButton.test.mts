import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as payments from "../../lib/payments/booking-payments";
import * as links from "../../lib/payments/swipesimple";

type Element = { type: string; props: Record<string, any> };
function harness(balanceCents: number | null, depositRecorded = true) {
  const state: unknown[] = [];
  let cursor = 0;
  const jsx = (type: string, props: Element["props"]) => ({ type, props });
  const imports: Record<string, unknown> = {
    "react": { useState(initial: unknown) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = value; }]; } },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "lucide-react": { CreditCard: "icon", Mail: "icon", X: "icon" },
    "@/lib/payments/booking-payments": payments,
    "@/lib/payments/swipesimple": links,
  };
  const compiled = ts.transpileModule(readFileSync(new URL("./BookingPaymentButton.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: { BookingPaymentButton?: (props: unknown) => Element } = {};
  runInNewContext(compiled, { exports, require(name: string) { assert.ok(name in imports); return imports[name]; }, crypto: { randomUUID: () => "11111111-1111-4111-8111-222222222222" } });
  return () => {
    cursor = 0;
    const root = exports.BookingPaymentButton!({ bookingId: "party", kind: "facility", customerEmail: null, balanceCents, depositRecorded });
    const elements: Element[] = [];
    function walk(node: any) { if (Array.isArray(node)) node.forEach(walk); else if (node?.props) { elements.push(node); walk(node.props.children); } }
    walk(root);
    return elements;
  };
}

test("staff can switch away from an already recorded deposit and enter the remaining balance", () => {
  const render = harness(9980);
  render().find(e => e.type === "button" && e.props.children?.includes?.("Payment"))!.props.onClick();
  let elements = render();
  assert.equal(elements.find(e => e.props["aria-label"] === "Payment amount")!.props.value, "99.80");
  const purpose = () => elements.find(e => e.type === "select" && e.props.value === "balance");
  purpose()!.props.onChange({ target: { value: "deposit" } });
  elements = render();
  const selector = elements.find(e => e.type === "select" && e.props.value === "deposit");
  assert.ok(selector, "purpose selector remains available when deposit is blocked");
  assert.equal(elements.find(e => e.props.type === "submit")!.props.disabled, true);
  selector.props.onChange({ target: { value: "balance" } });
  elements = render();
  assert.equal(elements.find(e => e.props["aria-label"] === "Payment amount")!.props.value, "99.80");
  assert.equal(elements.find(e => e.props.type === "submit")!.props.disabled, false);
  assert.equal(elements.find(e => e.type === "a")!.props.href, links.SWIPESIMPLE_GENERAL_PAYMENT_URL);
});

test("Mark as paid opens a balance payment for the exact outstanding amount, with or without a deposit", () => {
  for (const deposit of [true, false]) {
    const render = harness(deposit ? 9980 : 14980, deposit);
    render().find(e => e.props.children === "Mark as paid")!.props.onClick();
    const elements = render();
    assert.ok(elements.find(e => e.type === "select" && e.props.value === "balance"));
    assert.equal(elements.find(e => e.props["aria-label"] === "Payment amount")!.props.value, deposit ? "99.80" : "149.80");
  }
  for (const balance of [0, null]) {
    assert.equal(harness(balance)().some(e => e.props.children === "Mark as paid"), false);
  }
});
