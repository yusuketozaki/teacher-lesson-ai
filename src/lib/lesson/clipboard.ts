import type { CopyOutcome } from "./types.ts";

export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

/**
 * Copy text to the clipboard. Defaults to navigator.clipboard.
 * Never throws; a missing or rejecting clipboard returns "failed".
 */
export async function copyText(
  text: string,
  clipboard: ClipboardLike | undefined = globalThis.navigator?.clipboard,
): Promise<CopyOutcome> {
  if (!clipboard || typeof clipboard.writeText !== "function") return "failed";
  try {
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
