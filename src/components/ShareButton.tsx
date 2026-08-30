import { useState } from "react";

/**
 * Share a build-time PNG card. On phones the Web Share API hands the image to
 * Messages/WhatsApp; elsewhere it opens the image in a new tab.
 */
export default function ShareButton({ card, title, label = "Share" }: { card: string; title: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const url = `${import.meta.env.BASE_URL}cards/${card}`;
  const share = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("no card");
      const blob = await res.blob();
      const file = new File([blob], card, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else {
        window.open(url, "_blank", "noopener");
      }
    } catch {
      window.open(url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={share} className="chip text-lagoon-400 cursor-pointer" disabled={busy} aria-label={`${label}: ${title}`}>
      {busy ? "…" : label ? `⬆︎ ${label}` : "⬆︎"}
    </button>
  );
}
