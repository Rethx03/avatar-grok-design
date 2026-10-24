import type { BotShape } from "./types";

interface ShapeMetrics {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly eyeGap: number;
  readonly eyeY: number;
  readonly shiftY: number;
}

export interface ShapeGeometry {
  readonly bodyPath: string;
  readonly metrics: ShapeMetrics;
  readonly stemPath: string | null;
}

const METRICS: Readonly<Record<BotShape, ShapeMetrics>> = {
  blob: { scaleX: 0.97, scaleY: 0.98, eyeGap: 0.29, eyeY: -0.02, shiftY: 0.04 },
  pebble: { scaleX: 0.94, scaleY: 0.96, eyeGap: 0.3, eyeY: -0.01, shiftY: 0.06 },
  bean: { scaleX: 0.78, scaleY: 0.98, eyeGap: 0.25, eyeY: -0.02, shiftY: 0.08 },
  egg: { scaleX: 0.88, scaleY: 1.02, eyeGap: 0.27, eyeY: 0.01, shiftY: 0.04 },
  squircle: { scaleX: 0.94, scaleY: 0.98, eyeGap: 0.28, eyeY: 0, shiftY: 0.06 },
  tablet: { scaleX: 0.79, scaleY: 0.98, eyeGap: 0.24, eyeY: 0, shiftY: 0.02 },
  capsule: { scaleX: 0.72, scaleY: 1.01, eyeGap: 0.23, eyeY: -0.01, shiftY: 0.05 },
  cylinder: { scaleX: 0.84, scaleY: 1.01, eyeGap: 0.26, eyeY: 0, shiftY: 0.04 },
  hex: { scaleX: 0.89, scaleY: 1.02, eyeGap: 0.29, eyeY: 0, shiftY: 0.04 },
  gem: { scaleX: 0.92, scaleY: 0.96, eyeGap: 0.28, eyeY: 0.01, shiftY: 0.04 },
  crystal: { scaleX: 0.72, scaleY: 1.03, eyeGap: 0.22, eyeY: 0.03, shiftY: 0.04 },
  wedge: { scaleX: 0.88, scaleY: 0.96, eyeGap: 0.27, eyeY: 0.01, shiftY: 0.05 },
  shield: { scaleX: 0.98, scaleY: 1.02, eyeGap: 0.3, eyeY: -0.03, shiftY: 0.04 },
  dome: { scaleX: 0.92, scaleY: 0.96, eyeGap: 0.28, eyeY: 0.02, shiftY: 0.04 },
  arch: { scaleX: 0.76, scaleY: 1.01, eyeGap: 0.23, eyeY: 0.03, shiftY: 0.04 },
  cloud: { scaleX: 1.02, scaleY: 0.87, eyeGap: 0.32, eyeY: 0.03, shiftY: 0.02 },
  teardrop: { scaleX: 0.84, scaleY: 1.02, eyeGap: 0.25, eyeY: 0.06, shiftY: 0.03 },
  leaf: { scaleX: 0.8, scaleY: 1.02, eyeGap: 0.24, eyeY: 0.03, shiftY: 0.03 },
  square: { scaleX: 0.88, scaleY: 0.9, eyeGap: 0.26, eyeY: 0, shiftY: 0.04 },
  sparkle: { scaleX: 0.92, scaleY: 0.98, eyeGap: 0.25, eyeY: 0.02, shiftY: 0.05 },
  clover: { scaleX: 1, scaleY: 0.96, eyeGap: 0.29, eyeY: 0.01, shiftY: 0.04 },
  flower: { scaleX: 1, scaleY: 0.98, eyeGap: 0.28, eyeY: 0.01, shiftY: 0.05 },
  heart: { scaleX: 0.98, scaleY: 0.98, eyeGap: 0.29, eyeY: -0.01, shiftY: 0.03 },
  house: { scaleX: 0.92, scaleY: 0.98, eyeGap: 0.27, eyeY: 0.02, shiftY: 0.04 },
  star: { scaleX: 0.98, scaleY: 0.98, eyeGap: 0.27, eyeY: 0.01, shiftY: 0.04 },
  pumpkin: { scaleX: 1.02, scaleY: 0.91, eyeGap: 0.31, eyeY: 0.02, shiftY: 0.05 },
};

const TAU = Math.PI * 2;

const superellipseRadius = (
  angle: number,
  exponent: number,
  scaleX: number,
  scaleY: number,
): number => {
  const c = Math.abs(Math.cos(angle) / scaleX);
  const s = Math.abs(Math.sin(angle) / scaleY);
  return 1 / Math.pow(Math.pow(c, exponent) + Math.pow(s, exponent), 1 / exponent);
};

const starRadius = (angle: number, points: number, inner: number): number => {
  const segment = TAU / points;
  const local = ((angle % segment) + segment) % segment;
  const midpoint = segment / 2;
  return local < midpoint
    ? 1 - (1 - inner) * (local / midpoint)
    : inner + (1 - inner) * ((local - midpoint) / midpoint);
};

const rawPoint = (shape: BotShape, angle: number): { x: number; y: number } => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  switch (shape) {
    case "blob": {
      const r = 0.9 + 0.055 * Math.sin(3 * angle + 0.55) + 0.025 * Math.cos(5 * angle - 0.4);
      return { x: c * r * 0.97, y: s * r * 0.98 };
    }
    case "pebble": {
      const r = 0.9 + 0.035 * Math.cos(2 * angle + 1.1);
      return { x: c * r * 0.94, y: s * r * 0.96 };
    }
    case "bean":
      return {
        x: c * 0.78 - 0.06 * Math.sin(angle) ** 3,
        y: s * 0.97 + 0.04 * Math.cos(2 * angle),
      };
    case "egg": {
      const taper = 0.83 + 0.08 * s;
      return { x: c * taper, y: s * 1.01 };
    }
    case "squircle": {
      const r = superellipseRadius(angle, 4.2, 1, 1);
      return { x: c * r * 0.94, y: s * r * 0.98 };
    }
    case "tablet": {
      const r = superellipseRadius(angle, 7.5, 0.82, 1);
      return { x: c * r, y: s * r * 0.98 };
    }
    case "capsule": {
      const r = superellipseRadius(angle, 5.5, 0.72, 1);
      return { x: c * r, y: s * r };
    }
    case "cylinder": {
      const r = superellipseRadius(angle, 3.2, 0.84, 1.02);
      return { x: c * r, y: s * r };
    }
    case "hex": {
      const r = 1 / Math.max(Math.abs(c) * 0.86 + Math.abs(s) * 0.5, 0.55);
      return { x: c * Math.min(r, 1.04), y: s * Math.min(r, 1.04) };
    }
    case "gem": {
      const r = starRadius(angle + Math.PI / 8, 8, 0.78);
      return { x: c * r * 0.92, y: s * r * 0.98 };
    }
    case "crystal": {
      const r = starRadius(angle + Math.PI / 6, 6, 0.54);
      return { x: c * r * 0.72, y: s * r * 1.03 };
    }
    case "wedge":
      return { x: c * (0.72 + 0.16 * ((s + 1) / 2)), y: s * 0.98 + 0.04 };
    case "shield": {
      const lower = s > 0.32 ? 1 - (s - 0.32) * 0.5 : 1;
      return { x: c * 0.95 * lower, y: s * 1.02 };
    }
    case "dome":
      return { x: c * 0.93, y: Math.min(0.72, s * 0.98) };
    case "arch":
      return { x: c * (0.72 + 0.04 * (1 - s)), y: s * 1.01 };
    case "cloud": {
      const r = 0.92 + 0.075 * Math.cos(3 * angle + 0.4) + 0.035 * Math.cos(7 * angle);
      return { x: c * r * 1.02, y: s * r * 0.86 };
    }
    case "teardrop": {
      const taper = 0.58 + 0.38 * ((s + 1) / 2);
      return { x: c * taper, y: s * 1.03 };
    }
    case "leaf": {
      const taper = 0.38 + 0.6 * Math.abs(c);
      return { x: c * 0.78, y: s * (0.7 + taper * 0.34) };
    }
    case "square": {
      const r = superellipseRadius(angle, 8.5, 0.9, 0.92);
      return { x: c * r, y: s * r };
    }
    case "sparkle": {
      const r = starRadius(angle, 4, 0.28);
      return { x: c * r * 0.94, y: s * r };
    }
    case "clover": {
      const r = 0.82 + 0.2 * Math.abs(Math.cos(2 * angle)) ** 5;
      return { x: c * r, y: s * r * 0.97 };
    }
    case "flower": {
      const r = 0.84 + 0.16 * Math.abs(Math.sin(3 * angle)) ** 7;
      return { x: c * r, y: s * r };
    }
    case "heart": {
      const x = (16 * Math.sin(angle) ** 3) / 17;
      const y = -(13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) / 17;
      return { x: x * 0.96, y: y * 1.05 };
    }
    case "house": {
      const x = Math.max(-0.93, Math.min(0.93, c * (s < -0.25 ? 1.25 : 0.92)));
      return { x, y: s * 0.98 + 0.04 };
    }
    case "star": {
      const r = starRadius(angle - Math.PI / 2, 5, 0.48);
      return { x: c * r, y: s * r };
    }
    case "pumpkin": {
      const lobes = 1 + 0.035 * Math.cos(8 * angle);
      return { x: c * lobes * 1.03, y: s * lobes * 0.9 };
    }
  }
};

const sampleShape = (shape: BotShape, count = 128): Array<{ x: number; y: number }> => {
  const metrics = METRICS[shape];
  return Array.from({ length: count }, (_, index) => {
    const point = rawPoint(shape, (index / count) * TAU);
    return {
      x: point.x * metrics.scaleX,
      y: point.y * metrics.scaleY,
    };
  });
};

const smoothClosedPath = (
  points: ReadonlyArray<{ x: number; y: number }>,
  radius: number,
): string => {
  if (points.length < 3) return "";
  const scaled = points.map(({ x, y }) => ({ x: x * radius, y: y * radius }));
  const first = scaled[0]!;
  const last = scaled[scaled.length - 1]!;
  const second = scaled[1]!;
  let path = `M${format((first.x + last.x) / 2)} ${format((first.y + last.y) / 2)}`;

  for (let index = 0; index < scaled.length; index += 1) {
    const current = scaled[index]!;
    const next = scaled[(index + 1) % scaled.length]!;
    path += ` Q${format(current.x)} ${format(current.y)} ${format((current.x + next.x) / 2)} ${format((current.y + next.y) / 2)}`;
  }
  return `${path} Z`;
};

const format = (value: number): string => String(Math.round(value * 1000) / 1000);

export const getShapeGeometry = (shape: BotShape, radius = 34): ShapeGeometry => {
  return {
    bodyPath: smoothClosedPath(sampleShape(shape), radius),
    metrics: METRICS[shape],
    stemPath:
      shape === "pumpkin"
        ? `M${format(radius * 0.02)} ${format(-radius * 0.88)} q${format(radius * 0.06)} ${format(-radius * 0.25)} ${format(radius * 0.28)} ${format(-radius * 0.29)}`
        : null,
  };
};

export const getShapeExtent = (shape: BotShape, radius: number): number => {
  const scale = METRICS[shape];
  return radius * Math.max(scale.scaleX, scale.scaleY);
};

