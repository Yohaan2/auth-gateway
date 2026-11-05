// Chequeo: node --experimental-strip-types client/src/auth/subtle-polyfill.check.mjs
import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { sha256 } from "./subtle-polyfill.ts";

for (const len of [0, 1, 55, 56, 63, 64, 65, 128, 1000]) {
  const data = randomBytes(len);
  const expected = createHash("sha256").update(data).digest("hex");
  assert.equal(Buffer.from(sha256(data)).toString("hex"), expected, `len=${len}`);
}
console.log("sha256 polyfill OK");
