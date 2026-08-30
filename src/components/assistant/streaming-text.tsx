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
      // Chunk tokens for natural pacing
      const step = Math.floor(Math.random() * 6) + 4;
      current += step;
      if (current >= content.length) {
        setStreamProgress(content.length);
        clearInterval(interval);
        onStreamComplete?.();
      } else {
        setStreamProgress(current);
      }
    }, 24);

    return () => clearInterval(interval);
  }, [content, isStreaming, onStreamComplete]);

  const displayedLength = isStreaming ? streamProgress : content.length;

  const rawText = content.slice(0, displayedLength);

  // Render text with inline citations replaced by interactive chips
  const renderFormattedText = (text: string) => {
    // Look for bracketed citations like [PMK 172/2023 · Pasal 4]
    const parts = text.split(/(\[[^\]]+\])/g);

    return parts.map((part, index) => {
      if (part.startsWith("[") && part.endsWith("]")) {
        const citationCode = part.slice(1, -1).trim();
        return (
          <span key={index} className="text-foreground/90 font-medium">
            {citationCode}
          </span>
        );
      }

      // Format bold markup **text** and linebreaks cleanly
      const lines = part.split("\n");
      return (
        <React.Fragment key={index}>
          {lines.map((line, lineIdx) => {
            const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
            return (
              <React.Fragment key={lineIdx}>
                {lineIdx > 0 && <br />}
                {boldParts.map((bPart, bIdx) => {
                  if (bPart.startsWith("**") && bPart.endsWith("**")) {
                    return (
                      <strong key={bIdx} className="font-semibold text-foreground">
                        {bPart.slice(2, -2)}
                      </strong>
                    );
                  }
                  if (bPart.startsWith("*") && bPart.endsWith("*")) {
                    return (
                      <em key={bIdx} className="italic text-foreground">
                        {bPart.slice(1, -1)}
                      </em>
                    );
                  }
                  return <span key={bIdx}>{bPart}</span>;
                })}
              </React.Fragment>
            );
          })}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="text-sm leading-relaxed space-y-2 text-foreground/90 font-normal">
      {renderFormattedText(rawText)}
      {isStreaming && displayedLength < content.length && (
        <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-primary/80 dark:bg-amber-400 animate-pulse" />
      )}
    </div>
  );
}
