/**
 * Lab forms: new bodies designed against the same data model the engine uses.
 *
 * A body is a radial silhouette (r(θ), 1 = base radius), a pair of shape
 * metrics for the eyes, and a 3D modelling recipe that mirrors the engine:
 *
 * - `extrusion`  : 2D outline extruded in ±z with a rounded rim (engine `ac`)
 * - `revolution` : 2D profile spun around the Y axis (engine `Qs`)
 * - `loft`       : scaled rings with a cos^p depth profile (engine `sc`)
 *
 * The mirroring matters: the same silhouette function can be handed to
 * `shapeGeometry` (readable renderer) or to a body registry entry for the
 * mark engine without changing the design.
 */

const TAU = Math.PI * 2;

const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, value));

const smoothstep = (value: number): number => {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
};

/** Wraps an angle into [-π, π] so bells never see a discontinuity. */
const wrapAngle = (angle: number): number =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

/** Gaussian lobe on the circle: 1 at `center`, width `sigma`. */
const bell = (angle: number, center: number, sigma: number): number => {
  const delta = wrapAngle(angle - center);
  return Math.exp(-(delta * delta) / (sigma * sigma));
};

export interface LabFormMetrics {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly eyeGap: number;
  readonly eyeY: number;
  readonly shiftY: number;
}

export interface LabFormEngine {
  /** Which 3D recipe the mark engine would use. */
  readonly modelling: "extrusion" | "loft";
  /** Depth of the extrusion / loft, in body radii. */
  readonly depth: number;
  /** Rim inset (extrusion) or profile exponent helper (loft). */
  readonly inset: number;
  /** Eye seat used by the mark engine. */
  readonly seat: "front" | "wrap" | "loft";
  /** Extra decoration the renderer needs to draw (hem or chips). */
  readonly decoration: "none" | "hem" | "chips";
}

export interface LabForm {
  readonly id: string;
  readonly label: string;
  readonly labelZh: string;
  /** One sentence of design intent. */
  readonly idea: string;
  /** r(θ), 1 = base radius. */
  readonly radius: (angle: number) => number;
  readonly metrics: LabFormMetrics;
  readonly engine: LabFormEngine;
}

const format = (value: number): string =>
  String(Math.round(value * 1000) / 1000);

/**
 * Closed path through the radial silhouette, smoothed exactly like
 * `shapeGeometry.smoothClosedPath` (quadratic segments through edge midpoints).
 */
export const buildFormPath = (
  form: LabForm,
  radius = 36,
  count = 160,
): string => {
  const points = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * TAU;
    const reach = form.radius(angle) * radius;
    return {
      x: Math.cos(angle) * reach * form.metrics.scaleX,
      y: Math.sin(angle) * reach * form.metrics.scaleY,
    };
  });
  const last = points[count - 1]!;
  const first = points[0]!;
  let path = `M${format((last.x + first.x) / 2)} ${format((last.y + first.y) / 2)}`;
  for (let index = 0; index < count; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % count]!;
    path += ` Q${format(current.x)} ${format(current.y)} ${format((current.x + next.x) / 2)} ${format((current.y + next.y) / 2)}`;
  }
  return `${path} Z`;
};

/**
 * Ghost: a dome with a five-lobed hem. Angles follow SVG convention (positive
 * angle points down), so the hem lives where sin(θ) > 0. The hem is a radial
 * wave gated to the lower half, so the silhouette stays star-shaped and the
 * engine's hull / star silhouette algorithms keep it exactly.
 */
const ghostRadius = (angle: number): number => {
  const sine = Math.sin(angle);
  const hem = smoothstep((sine - 0.05) / 0.35);
  const wave = -Math.sin(5 * angle + 0.35) * 0.12 * hem;
  return 0.91 + 0.12 * hem + 0.02 * sine + wave;
};

/**
 * Cookie: a round biscuit with a bite taken out of the upper right. The bite is
 * a Gaussian notch in the radial function; it is genuinely concave, which the
 * engine preserves for extruded bodies through its polygon boolean union.
 */
const cookieRadius = (angle: number): number => {
  const bite = 0.46 * bell(angle, -0.5, 0.24);
  const crumbs = 0.012 * Math.sin(9 * angle) + 0.007 * Math.sin(5 * angle + 1.2);
  return 1 - bite + crumbs;
};

export const LAB_FORMS: readonly LabForm[] = [
  {
    id: "ghost",
    label: "Ghost",
    labelZh: "幽灵",
    idea: "Dome top plus a five-lobed hem; reads as a sheet with weight.",
    radius: ghostRadius,
    metrics: { scaleX: 1, scaleY: 1.04, eyeGap: 0.3, eyeY: 0.01, shiftY: 0.05 },
    engine: {
      modelling: "loft",
      depth: 0.9,
      inset: 0.72,
      seat: "loft",
      decoration: "hem",
    },
  },
  {
    id: "cookie",
    label: "Cookie",
    labelZh: "饼干",
    idea: "A round biscuit with one bite; the notch is a real concavity.",
    radius: cookieRadius,
    metrics: { scaleX: 1.02, scaleY: 0.98, eyeGap: 0.3, eyeY: 0, shiftY: 0.04 },
    engine: {
      modelling: "extrusion",
      depth: 0.36,
      inset: 0.22,
      seat: "front",
      decoration: "chips",
    },
  },
];

export const getLabForm = (id: string): LabForm =>
  LAB_FORMS.find((form) => form.id === id) ?? LAB_FORMS[0]!;

/** Exposed for tests / previews: the raw radius at a given angle. */
export const sampleLabRadius = (form: LabForm, angle: number): number =>
  form.radius(angle);
