/**
 * CLI stdout formatter for `bedlam run --watch`.
 * Strips [openrouter] meta lines; passes agent output through.
 */
export function formatOpenRouterEvent(line: string): string | null {
  if (!line.trim()) return null;
  if (line.startsWith("[openrouter] ")) return null; // suppress diagnostics in watch mode
  return line;
}
