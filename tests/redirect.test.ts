import { test } from "node:test";
import assert from "node:assert/strict";
import { redirectTo } from "../src/lib/redirect.ts";

test("redirect is relative, so it never leaks the server's internal host", () => {
  const res = redirectTo("/login?error=link");
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), "/login?error=link");
});
