export type TextPart = { text: string; href?: string };

/** Splits text into plain parts and web-address parts; sentence punctuation after a link stays outside it. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  for (const piece of text.split(/((?:https?:\/\/|www\.)[^\s)<>]+)/g)) {
    if (!piece) continue;
    if (!/^(?:https?:\/\/|www\.)/.test(piece)) {
      parts.push({ text: piece });
      continue;
    }
    const trailing = piece.match(/[.,;:!?'"]+$/)?.[0] ?? '';
    const link = trailing ? piece.slice(0, -trailing.length) : piece;
    parts.push({ text: link, href: link.startsWith('www.') ? `https://${link}` : link });
    if (trailing) parts.push({ text: trailing });
  }
  return parts;
}
