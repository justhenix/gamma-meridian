"use client";

import * as React from "react";

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
  onStreamComplete?: () => void;
}

export function StreamingText({
  content,
  isStreaming = false,
  onStreamComplete,
}: StreamingTextProps) {
  const [streamProgress, setStreamProgress] = React.useState(0);

  React.useEffect(() => {
    if (!isStreaming) return;

    let current = 0;
    const interval = setInterval(() => {
      // Chunk tokens for natural, responsive pacing
      const step = Math.floor(Math.random() * 8) + 8;
      current += step;
      if (current >= content.length) {
        setStreamProgress(content.length);
        clearInterval(interval);
        onStreamComplete?.();
      } else {
        setStreamProgress(current);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [content, isStreaming, onStreamComplete]);

  const displayedLength = isStreaming ? streamProgress : content.length;

  const rawText = content.slice(0, displayedLength);

  // Format inline bold markup **text**, italic *text*, and bracketed citations
  const renderInlineContent = (text: string) => {
    const parts = text.split(/(\[[^\]]+\]|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("[") && part.endsWith("]")) {
        return (
          <span key={index} className="text-foreground/90 font-medium">
            {part.slice(1, -1).trim()}
          </span>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return (
          <em key={index} className="italic text-foreground">
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Render text with structured paragraphs, headers, and list items
  const renderFormattedText = (text: string) => {
    const rawLines = text.split(/\r?\n/);

    return rawLines.map((line, lineIdx) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return <div key={lineIdx} className="h-2" />;
      }

      // Bullet points: - item, * item, • item
      const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
      if (bulletMatch) {
        return (
          <div key={lineIdx} className="flex items-start gap-2.5 my-1 pl-1">
            <span className="text-amber-500 font-bold shrink-0 mt-0.5 leading-none select-none">•</span>
            <div className="flex-1">{renderInlineContent(bulletMatch[1]!)}</div>
          </div>
        );
      }

      // Numbered lists: 1. item, 2. item
      const numberedMatch = trimmed.match(/^(\d+[.)])\s+(.*)$/);
      if (numberedMatch) {
        return (
          <div key={lineIdx} className="flex items-start gap-2 my-1 pl-1">
            <span className="text-amber-500 font-semibold shrink-0 text-xs mt-0.5 select-none">{numberedMatch[1]}</span>
            <div className="flex-1">{renderInlineContent(numberedMatch[2]!)}</div>
          </div>
        );
      }

      // Standalone bold category headers like **1. Master File:** or **Overview:**
      if (/^\*\*[^*]+\*\*:?$/.test(trimmed)) {
        return (
          <div key={lineIdx} className="font-semibold text-foreground pt-1.5 pb-0.5">
            {renderInlineContent(trimmed)}
          </div>
        );
      }

      return (
        <div key={lineIdx} className="leading-relaxed">
          {renderInlineContent(line)}
        </div>
      );
    });
  };

  return (
    <div className="text-sm leading-relaxed space-y-1 text-foreground/90 font-normal">
      {renderFormattedText(rawText)}
      {isStreaming && displayedLength < content.length && (
        <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-primary/80 dark:bg-amber-400 animate-pulse" />
      )}
    </div>
  );
}
