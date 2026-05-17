const BLOCK_START = "<!-- nymor:start -->";
const BLOCK_END = "<!-- nymor:end -->";

export function renderManagedBlock(content: string): string {
  const body = content.trimEnd();
  return `${BLOCK_START}\n${body}\n${BLOCK_END}`;
}

export function upsertManagedBlock(existing: string | null, content: string): string {
  const block = renderManagedBlock(content);
  if (!existing) {
    return `${block}\n`;
  }

  const pattern = new RegExp(`${escapeRegExp(BLOCK_START)}[\\s\\S]*?${escapeRegExp(BLOCK_END)}`);
  if (pattern.test(existing)) {
    return existing.replace(pattern, block);
  }

  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  return `${existing}${separator}${block}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}
