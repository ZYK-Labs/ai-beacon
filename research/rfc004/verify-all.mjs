import { run as runEventRef } from "./eventref/verify.mjs";
import { run as runContinuity } from "./continuity/verify.mjs";
import { run as runAuthority } from "./authority/verify.mjs";
import { run as runFunnel } from "./distribution/verify.mjs";
import { run as runSkills } from "./skills/verify.mjs";

const results = [];
for (const [name, fn] of [
  ["T01 EventRef", runEventRef],
  ["T02 continuity", runContinuity],
  ["T03 authority battery", runAuthority],
  ["T05 evidence funnel", runFunnel],
  ["T06 skill contract", runSkills]
]) {
  await fn();
  results.push(name);
}
console.log("RFC-004 AI-BEACON synthetic verification PASS:", results.join(", "));
