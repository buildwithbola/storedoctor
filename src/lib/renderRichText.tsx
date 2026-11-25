import React from "react";

interface RenderRichTextProps {
  content: string;
  compact?: boolean;
  tone?: "default" | "inverted";
}

/**
 * Strips markdown heading hashes and horizontal rule lines from plain text exports.
 */
export function stripHashTags(raw: string): string {
  return raw
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderInlineTokens(
  text: string,
  tone: "default" | "inverted"
): React.ReactNode[] {
  const tokenRegex =
    /(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

  const parts = text.split(tokenRegex);
  const linkClass =
    tone === "inverted"
      ? "font-semibold underline underline-offset-2"
      : "font-semibold text-[var(--sd-emerald-ink)] underline decoration-[var(--sd-emerald)]/40 underline-offset-2 hover:decoration-[var(--sd-emerald)] sd-transition";

  const strongClass =
    tone === "inverted"
      ? "font-semibold"
      : "font-semibold text-[var(--sd-ink)]";

  const codeClass =
    tone === "inverted"
      ? "font-medium"
      : "font-medium text-[var(--sd-ink)]";

  return parts.map((part, idx) => {
    if (!part) return null;

    // Markdown link [label](https://...)
    const mdMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (mdMatch) {
      return (
        <a
          key={idx}
          href={mdMatch[2]}
          target="_blank"
          rel="noreferrer"
          className={linkClass}
        >
          {mdMatch[1]}
        </a>
      );
    }

    // Bare URL https://... (trim trailing punctuation cleanly)
    if (/^https?:\/\//.test(part)) {
      const cleanUrl = part.replace(/[.,;!?]+$/, "");
      const trailing = part.slice(cleanUrl.length);
      return (
        <React.Fragment key={idx}>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            {cleanUrl}
          </a>
          {trailing}
        </React.Fragment>
      );
    }

    // Bold **...**
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className={strongClass}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic *...*
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Inline code `...` -> strip backticks cleanly for non-technical readers
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <span key={idx} className={codeClass}>
          {part.slice(1, -1)}
        </span>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Renders AI summaries and chat replies cleanly without raw markdown hash tags or rules.
 */
export function RenderRichText({
  content,
  compact = false,
  tone = "default",
}: RenderRichTextProps) {
  const lines = content.split("\n");

  const headingClass = compact
    ? tone === "inverted"
      ? "font-display text-[13.5px] font-bold mt-2.5 mb-0.5 first:mt-0"
      : "font-display text-[13.5px] font-bold text-[var(--sd-ink)] mt-2.5 mb-0.5 first:mt-0"
    : tone === "inverted"
      ? "font-display text-[17px] font-bold tracking-[-0.015em] mt-5 mb-1.5 first:mt-0"
      : "font-display text-[17px] font-bold tracking-[-0.015em] text-[var(--sd-ink)] mt-5 mb-1.5 first:mt-0";

  const bodyClass = compact
    ? tone === "inverted"
      ? "text-[13px] leading-relaxed"
      : "text-[13px] leading-relaxed text-[var(--sd-ink)]"
    : tone === "inverted"
      ? "text-[15px] leading-[1.7]"
      : "text-[15px] leading-[1.7] text-[var(--sd-ink-muted)]";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();

        // Skip horizontal rules completely
        if (/^[-*_]{3,}$/.test(trimmed)) {
          return null;
        }

        if (!trimmed) {
          return <div key={idx} className={compact ? "h-1" : "h-2"} />;
        }

        // Any markdown heading (#, ##, ### ... with or without space) -> clean display heading
        if (/^#{1,6}/.test(trimmed)) {
          const cleanHeading = trimmed
            .replace(/^#{1,6}\s*/, "")
            .replace(/^\*\*|\*\*$/g, "")
            .replace(/#/g, "")
            .trim();
          if (!cleanHeading) return null;
          return (
            <h4 key={idx} className={headingClass}>
              {renderInlineTokens(cleanHeading, tone)}
            </h4>
          );
        }

        // Standalone bold heading line (**Heading** or **Heading:**)
        const standaloneBold = trimmed.match(/^\*\*([^*]+)\*\*:?$/);
        if (standaloneBold) {
          return (
            <h4 key={idx} className={headingClass}>
              {standaloneBold[1].replace(/#/g, "")}
            </h4>
          );
        }

        // Bullet list item
        const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className={`flex items-start gap-2.5 ${bodyClass}`}>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  tone === "inverted"
                    ? "bg-current opacity-80"
                    : "bg-[var(--sd-emerald)]"
                } ${compact ? "mt-2" : "mt-2.5"}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                {renderInlineTokens(bulletMatch[1].replace(/^#+\s*/, ""), tone)}
              </div>
            </div>
          );
        }

        // Numbered list item
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) {
          return (
            <div key={idx} className={`flex items-start gap-2 ${bodyClass}`}>
              <span
                className={`font-semibold tabular-nums shrink-0 min-w-[1.25rem] ${
                  tone === "inverted"
                    ? "opacity-90"
                    : "text-[var(--sd-emerald-ink)]"
                }`}
              >
                {numMatch[1]}.
              </span>
              <div className="min-w-0 flex-1">
                {renderInlineTokens(numMatch[2].replace(/^#+\s*/, ""), tone)}
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className={bodyClass}>
            {renderInlineTokens(trimmed.replace(/#/g, ""), tone)}
          </p>
        );
      })}
    </div>
  );
}
