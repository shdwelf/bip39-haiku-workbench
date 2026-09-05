import { useState } from "react";
import { monkeySvg } from "../lib/monkey/generate";

export type ArtMode = "offline" | "official";

/** Official MonKey service. Used as a service — no assets are redistributed. */
const OFFICIAL_BASE = "https://monkey.banano.cc/api/v1/monkey";

export function officialMonkeyUrl(address: string, size = 160): string {
  const params = new URLSearchParams({
    format: "svg",
    background: "true",
    size: String(Math.max(100, Math.min(1000, size))),
  });
  return `${OFFICIAL_BASE}/${encodeURIComponent(address)}?${params}`;
}

/**
 * Renders a monKey either from the official service or from the locally drawn
 * fallback.
 *
 * The official accessory artwork is proprietary to Appditto and cannot be
 * bundled (see README), so "official" mode fetches from the public endpoint at
 * runtime and silently drops back to the offline drawing when unreachable —
 * which is what happens on a file:// page or with no network.
 */
export default function MonkeyAvatar({
  address,
  size = 160,
  mode,
  className = "",
}: {
  address: string;
  size?: number;
  mode: ArtMode;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (mode === "official" && !failed) {
    return (
      <img
        src={officialMonkeyUrl(address, size)}
        width={size}
        height={size}
        loading="lazy"
        alt={`Official monKey for ${address}`}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-lg bg-zinc-900 ${className}`}
      />
    );
  }

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-lg ${className}`}
      title={
        failed
          ? "Official art unavailable — showing the offline drawing"
          : undefined
      }
      dangerouslySetInnerHTML={{ __html: monkeySvg(address, size) }}
    />
  );
}
