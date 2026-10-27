export function quoteShell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
