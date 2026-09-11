export function getStartupMessage(): string {
  return "SocialPilot worker starting up";
}

function main() {
  console.log(getStartupMessage());
  // Queue consumers (content generation, publishing, token refresh) are
  // registered here in later phases once the job pipeline exists; they'll
  // keep the process alive via their own Redis connections. Until then,
  // hold the event loop open so this stays a long-running service instead
  // of exiting immediately after boot.
  setInterval(() => {}, 1 << 30);
}

if (process.env.VITEST === undefined) {
  main();
}
