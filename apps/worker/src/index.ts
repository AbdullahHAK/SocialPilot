export function getStartupMessage(): string {
  return "SocialPilot worker starting up";
}

function main() {
  console.log(getStartupMessage());
  // Queue consumers (content generation, publishing, token refresh) are
  // registered here in later phases once the job pipeline exists.
}

if (process.env.VITEST === undefined) {
  main();
}
