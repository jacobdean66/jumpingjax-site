import assert from "node:assert/strict";
import test from "node:test";
import { printableEmailHtml } from "./printable-email";

test("printing preserves invoice details while removing active content and tracking", () => {
  const input = '<h1>Invoice 605</h1><table><tr><td onclick="alert(1)">Waterslide</td><td>$123.00</td></tr></table><script>alert(1)</script><style>body{display:none}</style><img src="https://tracker.example/pixel"><iframe src="https://evil.example"></iframe><a href="https://evil.example">Pay here</a>';
  const result = printableEmailHtml(input);
  assert.match(result, /Invoice 605/);
  assert.match(result, /<table>/);
  assert.match(result, /Waterslide/);
  assert.match(result, /\$123\.00/);
  assert.doesNotMatch(result, /<script|<style|<img|<iframe|onclick|https:\/\//i);
});

test("printing preserves embedded images but never fetches remote images", () => {
  const result = printableEmailHtml('<img alt="inline" src="data:image/png;base64,aGVsbG8="><img src="https://tracker.example/x"><img src="data:image/svg+xml;base64,PHN2Zz4=">');
  assert.match(result, /data:image\/png;base64,aGVsbG8=/);
  assert.doesNotMatch(result, /tracker\.example|image\/svg\+xml/);
});
