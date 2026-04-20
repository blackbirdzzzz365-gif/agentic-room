"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TokenTextProps {
  text: string;
  speed?: number;
  className?: string;
  onDone?: () => void;
}

export default function TokenText({
  text,
  speed = 20,
  className,
  onDone,
}: TokenTextProps) {
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    // Reset when text changes
    setRevealedCount(0);
  }, [text]);

  useEffect(() => {
    if (revealedCount >= text.length) {
      if (revealedCount === text.length && text.length > 0) {
        onDone?.();
      }
      return;
    }

    const timer = setTimeout(() => {
      setRevealedCount((prev) => prev + 1);
    }, speed);

    return () => clearTimeout(timer);
  }, [revealedCount, text.length, speed, onDone]);

  return (
    <span className={cn("token-text", className)} aria-label={text}>
      {Array.from(text).map((char, i) => (
        <span
          key={i}
          className="token-char"
          aria-hidden="true"
          style={{
            opacity: i < revealedCount ? 1 : 0,
            animationDelay: `${i * speed}ms`,
          }}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

// ─── TokenParagraph ───────────────────────────────────────────────────────────

interface TokenParagraphProps {
  lines: string[];
  speed?: number;
  className?: string;
  lineClassName?: string;
  onDone?: () => void;
}

export function TokenParagraph({
  lines,
  speed = 20,
  className,
  lineClassName,
  onDone,
}: TokenParagraphProps) {
  const [currentLine, setCurrentLine] = useState(0);

  const handleLineDone = (lineIndex: number) => {
    const nextLine = lineIndex + 1;
    if (nextLine < lines.length) {
      setCurrentLine(nextLine);
    } else {
      onDone?.();
    }
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {lines.map((line, index) => (
        <p key={index} className={lineClassName}>
          {index <= currentLine ? (
            <TokenText
              text={line}
              speed={speed}
              onDone={index === currentLine ? () => handleLineDone(index) : undefined}
            />
          ) : null}
        </p>
      ))}
    </div>
  );
}
