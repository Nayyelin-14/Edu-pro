"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface NimModelOption {
  id: string;
  displayName: string;
  recommended: boolean;
}

/**
 * Accessible custom dropdown for picking an AI model. Recommended models are
 * marked with a small star badge (no text) and float to the top.
 */
export function NimModelSelect({
  id,
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (id: string) => void;
  options: NimModelOption[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Recommended models first, then the rest.
  const sorted = [...options].sort((a, b) => Number(b.recommended) - Number(a.recommended));
  const selected = options.find((o) => o.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-label-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{selected?.displayName ?? placeholder ?? ""}</span>
          {selected?.recommended && (
            <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" />
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-on-surface-variant transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"
          >
            {sorted.map((o) => (
              <li key={o.id} role="option" aria-selected={o.id === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-label-md text-on-surface hover:bg-surface-variant",
                    o.id === value && "bg-primary/10 text-primary",
                  )}
                >
                  <span className="truncate">{o.displayName}</span>
                  {o.recommended && (
                    <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}