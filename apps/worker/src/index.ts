import { runConceptCleanupCycle } from "./concept-cleanup";
import { runGenerationCycle } from "./generator";
import { runJobImageCleanupCycle } from "./job-image-cleanup";
import { runMaterializeCycle } from "./materializer";
import { runPublishCycle } from "./publisher";

export function getStartupMessage(): string {
  return "SocialPilot worker starting up";
}

const MATERIALIZE_POLL_INTERVAL_MS = 5 * 60_000;
const GENERATE_POLL_INTERVAL_MS = 60_000;
const PUBLISH_POLL_INTERVAL_MS = 60_000;
// A 10-hour expiry doesn't need anything close to minute-level precision.
const CONCEPT_CLEANUP_POLL_INTERVAL_MS = 30 * 60_000;
// Same reasoning for the 24-hour post/Story image expiry.
const JOB_IMAGE_CLEANUP_POLL_INTERVAL_MS = 30 * 60_000;

/** Recursive setTimeout (await, then schedule the next tick) rather than
 * setInterval - setInterval doesn't wait for the previous call to finish,
 * and the generate/publish cycles now include slow external calls
 * (OpenAI, the Graph API); a cycle running long could otherwise let two
 * ticks of the same loop overlap in this one process. The CAS-based
 * claiming in generator.ts/publisher.ts would still keep that safe, but
 * there's no reason to rely on it when avoiding the overlap outright is
 * this simple. */
function loop(name: string, intervalMs: number, run: () => Promise<void>): void {
  const tick = () => {
    run()
      .catch((error) => {
        console.error(`${name} cycle failed`, error);
      })
      .finally(() => {
        setTimeout(tick, intervalMs);
      });
  };
  tick();
}

function main() {
  console.log(getStartupMessage());

  loop("materialize", MATERIALIZE_POLL_INTERVAL_MS, () => runMaterializeCycle());
  loop("generate", GENERATE_POLL_INTERVAL_MS, () => runGenerationCycle());
  loop("publish", PUBLISH_POLL_INTERVAL_MS, () => runPublishCycle());
  loop("concept-cleanup", CONCEPT_CLEANUP_POLL_INTERVAL_MS, () => runConceptCleanupCycle());
  loop("job-image-cleanup", JOB_IMAGE_CLEANUP_POLL_INTERVAL_MS, () => runJobImageCleanupCycle());
}

if (process.env.VITEST === undefined) {
  main();
}
