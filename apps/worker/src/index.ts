import { runPublishCycle } from "./publisher";

export function getStartupMessage(): string {
  return "SocialPilot worker starting up";
}

const PUBLISH_POLL_INTERVAL_MS = 60_000;

function main() {
  console.log(getStartupMessage());

  const poll = () => {
    runPublishCycle().catch((error) => {
      console.error("Publish cycle failed", error);
    });
  };
  poll();
  setInterval(poll, PUBLISH_POLL_INTERVAL_MS);
}

if (process.env.VITEST === undefined) {
  main();
}
