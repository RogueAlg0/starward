// Tiny UI primitives with no dependencies back into the game,
// so game modules can import them freely.
import { esc } from "../game/rng";

export { esc };

// Single toast line, vanilla behavior: a #toast div in index.html shows
// the latest message for 2.6s. (Vanilla's toast was a silent no-op because
// the div was missing; the port ships the div, so toasts actually appear.)
export function toast(msg: string): void {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  (el as HTMLElement).style.display = "block";
  const prev = (el as unknown as { _t?: number })._t;
  if (prev) window.clearTimeout(prev);
  (el as unknown as { _t?: number })._t = window.setTimeout(() => {
    (el as HTMLElement).style.display = "none";
  }, 2600);
}

export function tag(label: string, cls?: string): string {
  return '<span class="tag' + (cls ? " " + cls : "") + '">' + esc(label) + "</span>";
}

export function bar(pct: number, cls: string): string {
  const w = Math.max(0, Math.min(100, Math.round(pct)));
  return '<div class="bar"><span class="' + cls + '" style="width:' + w + '%"></span></div>';
}
