import { useId, type ReactNode } from "react";
import { usePersistentState } from "./hooks";

/**
 * A collapsible section. Give it a `storageKey` to remember its state.
 *
 * Uses a real <button> with aria-expanded/aria-controls so it is keyboard and
 * screen-reader accessible, rather than a bare clickable div.
 */
export default function Collapsible({
  title,
  subtitle,
  icon,
  children,
  storageKey,
  defaultOpen = true,
  right,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  storageKey?: string;
  defaultOpen?: boolean;
  right?: ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const panelId = `collapsible-${autoId}`;
  const [open, setOpen] = usePersistentState(
    storageKey ?? `bhw.collapse.${autoId}`,
    defaultOpen
  );

  return (
    <section
      className={`overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 ${className}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="-mx-1 flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left transition hover:bg-zinc-800/60"
        >
          <span
            aria-hidden
            className={`shrink-0 text-[10px] text-zinc-500 transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
          {icon && <span aria-hidden className="shrink-0">{icon}</span>}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-zinc-100">
              {title}
            </span>
            {subtitle && (
              <span className="block truncate text-[11px] text-zinc-500">
                {subtitle}
              </span>
            )}
          </span>
        </button>
        {right && <div className="shrink-0">{right}</div>}
      </div>

      {/* Unmounting on collapse would throw away tool state (a half-typed
          mnemonic, mining results), so the panel is hidden, not destroyed. */}
      <div id={panelId} hidden={!open} className="border-t border-zinc-800 p-3">
        {children}
      </div>
    </section>
  );
}
