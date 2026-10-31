// 2D affine transforms in skeleton space (x right, y up). The renderer flips
// y once at the SVG boundary, so all motion math stays in a normal math frame.

export type Mat = [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** a * b, i.e. apply b first, then a. */
export function mul(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];

export function rotate(deg: number): Mat {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}

export const scale = (x: number, y = x): Mat => [x, 0, 0, y, 0, 0];

export function apply(m: Mat, x: number, y: number): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

/** Skeleton matrix -> SVG matrix, with a y flip and a stage scale. */
export function toSvg(m: Mat, originX: number, originY: number, s: number): string {
  const [a, b, c, d, e, f] = m;
  return `matrix(${s * a} ${-s * b} ${s * c} ${-s * d} ${originX + s * e} ${originY - s * f})`;
}

/** Local matrix for the face frame: +x right, +y down. */
export function faceMatrix(x: number, y: number, rot: number, size = 1): string {
  const r = (rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  // translate(x, y) * rotate(rot) * scale(1, -1) * scale(size)
  return `matrix(${c * size} ${s * size} ${s * size} ${-c * size} ${x} ${y})`;
}
