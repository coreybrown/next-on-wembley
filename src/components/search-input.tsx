"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { searchShows } from "@/app/actions/search";
import type { TmdbSearchResult } from "@/lib/tmdb";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

type Props = {
  onSelect: (result: TmdbSearchResult) => void;
  disabled?: boolean;
  placeholder?: string;
};

type Status = "idle" | "loading" | "results" | "empty" | "error";

export function SearchInput({
  onSelect,
  disabled,
  placeholder = "Search TMDb for a TV show…",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [highlighted, setHighlighted] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const inputId = useId();
  const listboxId = useId();
  const requestSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      requestSeqRef.current++;
    },
    [],
  );

  // Keep the highlighted option scrolled into view during keyboard nav.
  // block:"nearest" no-ops when the option is already on screen.
  useEffect(() => {
    if (!isOpen || status !== "results") return;
    const el = document.getElementById(`${listboxId}-opt-${highlighted}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted, isOpen, status, listboxId]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus("idle");
      setIsOpen(false);
      return;
    }
    setStatus("loading");
    setIsOpen(true);
    const seq = ++requestSeqRef.current;
    debounceRef.current = setTimeout(async () => {
      const res = await searchShows(trimmed);
      if (seq !== requestSeqRef.current) return;
      if (!res.ok) {
        setResults([]);
        setStatus("error");
        return;
      }
      if (res.results.length === 0) {
        setResults([]);
        setStatus("empty");
        return;
      }
      setResults(res.results);
      setStatus("results");
      setHighlighted(0);
    }, DEBOUNCE_MS);
  };

  const select = (result: TmdbSearchResult) => {
    onSelect(result);
    setQuery("");
    setResults([]);
    setStatus("idle");
    setIsOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || status !== "results") {
      if (e.key === "Escape") setIsOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[highlighted];
      if (r) select(r);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const optionId = (i: number) => `${listboxId}-opt-${i}`;
  const activeId =
    isOpen && status === "results" ? optionId(highlighted) : undefined;

  return (
    <div className="relative w-full">
      <label
        htmlFor={inputId}
        className="block font-mono text-mono uppercase text-ink-muted mb-2"
      >
        Add a show
      </label>
      <div className="relative">
        <MagnifyingGlass
          aria-hidden
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (status === "results" || status === "empty" || status === "error")
              setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 120);
          }}
          className="
            w-full rounded-sm border border-border bg-surface-elevated
            py-3 pl-10 pr-3 font-body text-base text-ink
            transition-colors
            focus:outline-2 focus:outline-accent focus:outline-offset-2
            disabled:opacity-50
          "
        />
      </div>

      {isOpen && (
        <div
          className="
            absolute left-0 right-0 top-full z-10 mt-1
            rounded-md border border-border bg-surface-elevated
            shadow-lg
          "
        >
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Search results"
            className="max-h-96 overflow-auto py-1"
          >
            {status === "loading" && (
              <li
                role="status"
                aria-live="polite"
                className="px-3 py-2 font-mono text-mono uppercase text-ink-muted"
              >
                Searching…
              </li>
            )}
            {status === "empty" && (
              <li
                role="status"
                aria-live="polite"
                className="px-3 py-2 font-body text-sm text-ink-secondary"
              >
                No shows match &ldquo;{query.trim()}&rdquo;.
              </li>
            )}
            {status === "error" && (
              <li
                role="alert"
                className="px-3 py-2 font-mono text-mono text-danger"
              >
                Search unavailable — try again
              </li>
            )}
            {status === "results" &&
              results.map((r, i) => (
                <li
                  key={r.tmdbId}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === highlighted}
                  onMouseEnter={() => setHighlighted(i)}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep input focused, prevent blur
                    select(r);
                  }}
                  className={`
                    flex cursor-pointer items-center gap-3 px-3 py-2
                    ${
                      i === highlighted
                        ? "bg-accent text-accent-fg"
                        : "text-ink"
                    }
                  `}
                >
                  {r.posterUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.posterUrl}
                      alt=""
                      width={36}
                      height={54}
                      className="h-[54px] w-9 flex-shrink-0 rounded-sm bg-surface-overlay object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="h-[54px] w-9 flex-shrink-0 rounded-sm bg-surface-overlay"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-base truncate">{r.title}</p>
                    {r.year && (
                      <p
                        className={`font-mono text-mono ${
                          i === highlighted
                            ? "text-accent-fg/80"
                            : "text-ink-muted"
                        }`}
                      >
                        {r.year}
                      </p>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
