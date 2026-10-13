/** Browsers use different messages when an old tab requests a removed chunk. */
export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed/i.test(error.message);
}
