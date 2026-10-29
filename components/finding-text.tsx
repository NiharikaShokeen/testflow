"use client";
import { useRef } from "react";
export type Emphasis = { start: number; end: number };
export function FindingText({
  label,
  value,
  onChange,
  spans = [],
  onFormat,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  spans?: Emphasis[];
  onFormat: (s: Emphasis[]) => void;
  placeholder?: string;
  rows?: number;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const toggle = () => {
    const el = input.current;
    if (!el || el.selectionStart === el.selectionEnd) return;
    const start = el.selectionStart,
      end = el.selectionEnd;
    const exists = spans.some((s) => s.start <= start && s.end >= end);
    onFormat(
      exists
        ? spans.filter((s) => s.end <= start || s.start >= end)
        : [...spans, { start, end }],
    );
    el.focus();
    el.setSelectionRange(start, end);
  };
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    const start = Math.max(cursor, s.start),
      end = Math.min(value.length, s.end);
    if (start > cursor) pieces.push(value.slice(cursor, start));
    if (end > start)
      pieces.push(<strong key={start}>{value.slice(start, end)}</strong>);
    cursor = Math.max(cursor, end);
  }
  pieces.push(value.slice(cursor));
  return (
    <div className="findingtext">
      <div className="findingtextbar">
        <label htmlFor={"finding-" + label}>{label}</label>
        <button
          type="button"
          title="Bold selected text in Word export"
          aria-label={"Bold selection in " + label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggle}
        >
          <b>B</b>
          <span>Bold selection</span>
        </button>
      </div>
      <textarea
        id={"finding-" + label}
        ref={input}
        required
        maxLength={10000}
        rows={rows}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (spans.length) onFormat([]);
        }}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "b") {
            e.preventDefault();
            toggle();
          }
        }}
      />
      {spans.length > 0 && (
        <div className="emphasispreview">
          <small>Word preview</small>
          <div>{pieces}</div>
        </div>
      )}
    </div>
  );
}
