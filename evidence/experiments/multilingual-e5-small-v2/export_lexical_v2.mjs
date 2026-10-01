import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, search } from "../../baseline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, "expanded-v2.json"), "utf8"));
const index = buildIndex(fixture.corpus.records);
const topK = fixture.policy.lexical_top_k;
const minimumScore = fixture.policy.lexical_minimum_score;

function run(cases) {
  return cases.map(tc => ({
    ...tc,
    result: search(index, tc.query, { topK, minimumScore })
  }));
}

process.stdout.write(JSON.stringify({
  benchmark_version: fixture.benchmark_version,
  corpus_version: fixture.corpus.corpus_version,
  calibration: run(fixture.calibration.cases),
  evaluation: run(fixture.evaluation.cases)
}, null, 2));
