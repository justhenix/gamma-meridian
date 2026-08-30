import assert from "node:assert/strict";
import test from "node:test";

test("client navigation keeps consultations separate from the assistant entry point", async () => {
  const navigationModule = await import("../../src/lib/navigation/client-navigation").catch(() => null);

  assert.ok(navigationModule, "client navigation policy should exist");
  assert.deepEqual(navigationModule.getClientNavigation(false), {
    consultationsHref: "/consultations",
    primaryHref: "/assistant",
    primaryAction: "assistant",
  });
  assert.deepEqual(navigationModule.getClientNavigation(true), {
    consultationsHref: "/consultations",
    primaryHref: "/assistant",
    primaryAction: "new-consultation",
  });
});
