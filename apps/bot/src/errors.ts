/** Extract a log-friendly message from an unknown thrown value. */
export function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
