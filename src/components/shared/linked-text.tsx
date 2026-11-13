import { splitLinks } from '@/lib/text/links';

/** Plain text with any web addresses turned into links that open in a new tab. */
export function LinkedText({ text, className = 'break-all font-semibold underline' }: { text: string; className?: string }) {
  return (
    <>
      {splitLinks(text).map((part, index) =>
        part.href ? (
          <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className={className}>
            {part.text}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
