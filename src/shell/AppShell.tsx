import { useCallback, useState, type ReactNode } from "react";
import { useEscape, useMediaQuery, usePersistentState, useScrollLock } from "./hooks";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

/**
 * Responsive application shell.
 *
 * Desktop (>=1024px): a left nav that collapses between a labelled sidebar and
 * an icon rail, plus a right inbox panel that docks beside the content.
 * Below that width both become off-canvas overlays driven by the hamburger.
 *
 * Collapse state persists, but the "open overlay" flags deliberately do not —
 * restoring a modal overlay on load would trap the user behind a backdrop.
 */
export default function AppShell({
  nav,
  activeId,
  onNavigate,
  title,
  subtitle,
  inboxTitle,
  inboxBadge,
  inbox,
  footer,
  children,
}: {
  nav: readonly NavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  title: string;
  subtitle?: string;
  inboxTitle: string;
  inboxBadge?: number;
  inbox: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [navExpanded, setNavExpanded] = usePersistentState("bhw.nav.expanded", true);
  const [inboxDocked, setInboxDocked] = usePersistentState("bhw.inbox.docked", false);
  // Overlays are transient on purpose — see the note above.
  const [navOverlay, setNavOverlay] = useState(false);
  const [inboxOverlay, setInboxOverlay] = useState(false);

  const overlayOpen = !isDesktop && (navOverlay || inboxOverlay);

  const closeOverlays = useCallback(() => {
    setNavOverlay(false);
    setInboxOverlay(false);
  }, [setNavOverlay, setInboxOverlay]);

  useEscape(overlayOpen, closeOverlays);
  useScrollLock(overlayOpen);

  const toggleNav = () => {
    if (isDesktop) setNavExpanded((v) => !v);
    else setNavOverlay((v) => !v);
  };

  const toggleInbox = () => {
    if (isDesktop) setInboxDocked((v) => !v);
    else setInboxOverlay((v) => !v);
  };

  const navVisible = isDesktop || navOverlay;
  const inboxVisible = isDesktop ? inboxDocked : inboxOverlay;
  // On mobile the nav is always fully labelled; the rail is a desktop affordance.
  const showLabels = navExpanded || !isDesktop;

  const navList = (
    <nav aria-label="Tools" className="flex flex-col gap-1 p-2">
      {nav.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onNavigate(item.id);
              if (!isDesktop) setNavOverlay(false);
            }}
            aria-current={active ? "page" : undefined}
            title={showLabels ? undefined : item.label}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-cyan-500 font-semibold text-zinc-950"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            } ${showLabels ? "" : "justify-center px-0"}`}
          >
            <span aria-hidden className="text-base leading-none">
              {item.icon}
            </span>
            {showLabels && <span className="truncate">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/85 px-3 py-2 backdrop-blur">
        <button
          type="button"
          onClick={toggleNav}
          aria-label={
            isDesktop
              ? navExpanded
                ? "Collapse sidebar"
                : "Expand sidebar"
              : navOverlay
                ? "Close menu"
                : "Open menu"
          }
          aria-expanded={isDesktop ? navExpanded : navOverlay}
          className="rounded-lg border border-zinc-800 px-2.5 py-1.5 text-zinc-300 transition hover:bg-zinc-800"
        >
          <span aria-hidden className="block text-base leading-none">
            ☰
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold leading-tight sm:text-base">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden truncate text-[11px] text-zinc-500 sm:block">
              {subtitle}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={toggleInbox}
          aria-label={inboxVisible ? `Hide ${inboxTitle}` : `Show ${inboxTitle}`}
          aria-expanded={inboxVisible}
          className={`relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${
            inboxVisible
              ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
              : "border-zinc-800 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          <span aria-hidden>📥</span>
          <span className="hidden sm:inline">{inboxTitle}</span>
          {!!inboxBadge && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-black text-zinc-950">
              {inboxBadge}
            </span>
          )}
        </button>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Backdrop for mobile overlays */}
        {overlayOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={closeOverlays}
            aria-hidden
          />
        )}

        {/* Left nav */}
        {navVisible && (
          <aside
            className={`border-zinc-800 bg-zinc-950 ${
              isDesktop
                ? `shrink-0 border-r transition-[width] duration-200 ${
                    navExpanded ? "w-56" : "w-14"
                  }`
                : "fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto border-r pt-2 shadow-2xl"
            }`}
          >
            {!isDesktop && (
              <div className="flex items-center justify-between px-3 pb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Tools
                </span>
                <button
                  type="button"
                  onClick={() => setNavOverlay(false)}
                  className="rounded border border-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  Close
                </button>
              </div>
            )}
            {navList}
          </aside>
        )}

        {/* Content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-5">{children}</div>
          {footer && (
            <div className="border-t border-zinc-800 px-4 py-4 text-center text-[11px] text-zinc-600">
              {footer}
            </div>
          )}
        </main>

        {/* Right inbox */}
        {inboxVisible && (
          <aside
            aria-label={inboxTitle}
            className={`border-zinc-800 bg-zinc-950 ${
              isDesktop
                ? "w-80 shrink-0 overflow-y-auto border-l"
                : "fixed inset-y-0 right-0 z-50 w-[min(22rem,92vw)] overflow-y-auto border-l shadow-2xl"
            }`}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {inboxTitle}
              </span>
              <button
                type="button"
                onClick={() => (isDesktop ? setInboxDocked(false) : setInboxOverlay(false))}
                className="rounded border border-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
            {inbox}
          </aside>
        )}
      </div>
    </div>
  );
}
