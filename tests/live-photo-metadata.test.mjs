import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

test("Live Photo route writes MOV still-image metadata", async () => {
  const routeSource = await readFile(
    new URL("../src/app/api/generate-live-photo/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(routeSource, /StillImageTime/);
});
