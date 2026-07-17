import assert from "node:assert/strict";
import { mock } from "node:test";

import {
  adminMessageForGoogleRoutesError,
  extractGoogleRoutesError,
  loadRouteMatrix,
  routeLegKey,
} from "./routes";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } finally {
    mock.restoreAll();
  }
}

await test("extractGoogleRoutesError reads object-shaped errors", () => {
  const error = extractGoogleRoutesError({
    error: {
      code: 403,
      status: "PERMISSION_DENIED",
      message: "Routes API has not been used in project 123 before or it is disabled.",
    },
  });
  assert.deepEqual(error, {
    code: 403,
    status: "PERMISSION_DENIED",
    message: "Routes API has not been used in project 123 before or it is disabled.",
  });
  assert.match(
    adminMessageForGoogleRoutesError(error),
    /PERMISSION_DENIED/,
  );
  assert.match(
    adminMessageForGoogleRoutesError(error),
    /Routes API has not been used/,
  );
});

await test("extractGoogleRoutesError reads array-shaped errors", () => {
  const error = extractGoogleRoutesError([
    {
      error: {
        code: 400,
        status: "INVALID_ARGUMENT",
        message: "API key not valid. Please pass a valid API key.",
      },
    },
  ]);
  assert.deepEqual(error, {
    code: 400,
    status: "INVALID_ARGUMENT",
    message: "API key not valid. Please pass a valid API key.",
  });
  assert.equal(
    adminMessageForGoogleRoutesError(error),
    "Google Routes API error: INVALID_ARGUMENT — code 400 — API key not valid. Please pass a valid API key.",
  );
});

await test("loadRouteMatrix keeps successful array matrix behavior", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key-not-secret-for-unit-test";
  const shop = "559 Beaudrot Rd, Greenwood, SC";
  const stop = "637 Grier Street, Greenwood, 29646";

  mock.method(globalThis, "fetch", async () => {
    return new Response(
      JSON.stringify([
        {
          originIndex: 0,
          destinationIndex: 1,
          duration: "660s",
          distanceMeters: 10300,
          status: {},
          condition: "ROUTE_EXISTS",
        },
        {
          originIndex: 1,
          destinationIndex: 0,
          duration: "700s",
          distanceMeters: 11000,
          status: {},
          condition: "ROUTE_EXISTS",
        },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });

  const matrix = await loadRouteMatrix([shop, stop]);
  assert.equal(matrix.size, 2);
  assert.deepEqual(matrix.get(routeLegKey(shop, stop)), {
    durationMinutes: 11,
    distanceMiles: 6.4,
  });
});

await test("loadRouteMatrix surfaces array-shaped Google errors", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key-not-secret-for-unit-test";

  mock.method(globalThis, "fetch", async () => {
    return new Response(
      JSON.stringify([
        {
          error: {
            code: 403,
            status: "PERMISSION_DENIED",
            message: "Routes API is disabled.",
          },
        },
      ]),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  });

  await assert.rejects(
    () =>
      loadRouteMatrix([
        "559 Beaudrot Rd, Greenwood, SC",
        "637 Grier Street, Greenwood, 29646",
      ]),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /PERMISSION_DENIED/);
      assert.match(error.message, /Routes API is disabled/);
      assert.doesNotMatch(error.message, /test-key/);
      return true;
    },
  );
});

await test("loadRouteMatrix surfaces object-shaped Google errors", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key-not-secret-for-unit-test";

  mock.method(globalThis, "fetch", async () => {
    return new Response(
      JSON.stringify({
        error: {
          code: 400,
          status: "INVALID_ARGUMENT",
          message: "Request had invalid arguments.",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  });

  await assert.rejects(
    () =>
      loadRouteMatrix([
        "559 Beaudrot Rd, Greenwood, SC",
        "637 Grier Street, Greenwood, 29646",
      ]),
    /INVALID_ARGUMENT — code 400 — Request had invalid arguments/,
  );
});

console.log("all google routes error parsing tests passed");
