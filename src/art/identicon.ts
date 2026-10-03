// Crew identicon: angular 5x5 mirrored mark, seeded by crew identity.
// Same crew member always renders the same mark.
import { hashStr, mulberry32 } from "../game/rng";

export function crewIdenticon(seedStr: string, size?: number): string {
  size = size || 44;
  const rng = mulberry32(hashStr("crew|" + seedStr));
  const palette = ["#6fd3ff", "#ffd36f", "#7dffa8", "#9f7dff", "#ff8d7d"];
  const fg = palette[Math.floor(rng() * palette.length)];
  const cell = 20;
  let s =
    '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size +
    '" class="identicon" role="img" aria-label="crew portrait">';
  s += '<rect width="100" height="100" rx="20" fill="#0e1322"/>';
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if (rng() < 0.45) continue;
      const kind = Math.floor(rng() * 3);
      const op = (0.55 + rng() * 0.45).toFixed(2);
      const cols = [x, 4 - x];
      for (const cx of cols) {
        const px = cx * cell + 10;
        const py = y * cell + 10;
        if (kind === 0) {
          s +=
            '<rect x="' + (px - 6) + '" y="' + (py - 6) + '" width="12" height="12" fill="' +
            fg + '" opacity="' + op + '"/>';
        } else if (kind === 1) {
          s +=
            '<polygon points="' + px + "," + (py - 8) + " " + (px + 8) + "," + py + " " +
            px + "," + (py + 8) + " " + (px - 8) + "," + py + '" fill="' + fg + '" opacity="' + op + '"/>';
        } else {
          const up = rng() < 0.5;
          s +=
            '<polygon points="' + px + "," + (up ? py - 8 : py + 8) + " " + (px + 8) + "," +
            (up ? py + 6 : py - 6) + " " + (px - 8) + "," + (up ? py + 6 : py - 6) + '" fill="' +
            fg + '" opacity="' + op + '"/>';
        }
      }
    }
  }
  s += "</svg>";
  return s;
}
