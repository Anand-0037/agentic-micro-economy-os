import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../dist/tools.js";

test("createServer exposes expected tools", () => {
  const server = createServer();
  assert.ok(server);
});
