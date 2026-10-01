import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, search } from "../../baseline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.resolve(here, "../../frozen-v1.json"), "utf8"));
const index = buildIndex(fixture.corpus.records);
const { top_k: topK, minimum_score: minimumScore } = fixture.benchmark.policy;

const cases = fixture.benchmark.cases.map(tc => ({
  id: tc.id,
  kind: tc.kind,
  language: tc.language,
  query: tc.query,
  relevant: tc.relevant,
  result: search(index, tc.query, { topK, minimumScore })
}));

process.stdout.write(JSON.stringify({
  benchmark_version: fixture.benchmark.benchmark_version,
  corpus_version: fixture.corpus.corpus_version,
  policy: fixture.benchmark.policy,
  cases
}, null, 2));
