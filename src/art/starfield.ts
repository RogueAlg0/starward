// Canvas starfield: math-based stars and soft procedural nebulae.
// Seeded and static: the same sky every load, redrawn on resize.
import { hashStr, mulberry32 } from "../game/rng";

function hexA(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}

export function initStarfield(): void {
  let cv = document.getElementById("stars") as HTMLCanvasElement | null;
  if (!cv) {
    cv = document.createElement("canvas");
    cv.id = "stars";
    if (document.body.firstChild) {
      document.body.insertBefore(cv, document.body.firstChild);
    } else {
      document.body.appendChild(cv);
    }
  }
  const draw = () => {
    const canvas = cv as HTMLCanvasElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const g = canvas.getContext("2d");
    if (!g) return; // no canvas support in this environment; the CSS gradient remains
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const rng = mulberry32(hashStr("starward-sky"));
    // soft procedural nebulae
    const nebs: Array<[string, number]> = [
      ["#1b2a6b", 0.32],
      ["#0f4a5a", 0.26],
      ["#3a1f5d", 0.24],
    ];
    for (const [col, alpha] of nebs) {
      const x = rng() * W;
      const y = rng() * H;
      const r = 220 + rng() * 340;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, hexA(col, alpha));
      gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }
    // stars, a few with sparkle crosses
    for (let i = 0; i < 240; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const rad = rng() * 1.3 + 0.2;
      const a = 0.25 + rng() * 0.75;
      g.fillStyle = "rgba(215,222,245," + a.toFixed(2) + ")";
      g.beginPath();
      g.arc(x, y, rad, 0, 7);
      g.fill();
      if (rng() < 0.06) {
        g.strokeStyle = "rgba(215,222,245," + (a * 0.6).toFixed(2) + ")";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x - 4, y);
        g.lineTo(x + 4, y);
        g.moveTo(x, y - 4);
        g.lineTo(x, y + 4);
        g.stroke();
      }
    }
  };
  draw();
  let rt: number | null = null;
  window.addEventListener("resize", () => {
    if (rt) window.clearTimeout(rt);
    rt = window.setTimeout(draw, 200);
  });
}
