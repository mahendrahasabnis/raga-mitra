/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling for time-series.
 * Preserves visual shape while reducing point count for performant rendering.
 * See: https://github.com/sveinn-steinarsson/flot-downsample
 */
export function lttb<T>(
  data: T[],
  targetPoints: number,
  getX: (p: T) => number,
  getY: (p: T) => number
): T[] {
  if (data.length <= targetPoints || targetPoints < 3) return data;

  const sampled: T[] = [];
  const bucketSize = (data.length - 2) / (targetPoints - 2);
  let a = 0;

  sampled.push(data[0]);

  for (let i = 0; i < targetPoints - 2; i++) {
    const avgX = (i + 1) * bucketSize;
    const avgY = (i + 1) * bucketSize;
    const rangeStart = Math.floor(avgX) + 1;
    const rangeEnd = Math.min(Math.floor(avgX) + bucketSize + 1, data.length - 1);

    const pointAX = getX(data[a]);
    const pointAY = getY(data[a]);

    let maxArea = -1;
    let maxAreaPoint = rangeStart;

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area =
        Math.abs(
          (pointAX - getX(data[data.length - 1])) * (getY(data[j]) - pointAY) -
          (pointAX - getX(data[j])) * (getY(data[data.length - 1]) - pointAY)
        ) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = j;
      }
    }

    sampled.push(data[maxAreaPoint]);
    a = maxAreaPoint;
  }

  sampled.push(data[data.length - 1]);
  return sampled;
}

const DOWNSAMPLE_THRESHOLD = 20_000;
const DOWNSAMPLE_TARGET = 8_000;

/**
 * Downsample data for display when over threshold; preserves LTTB for time + value.
 */
export function downsampleForChart<T>(
  data: T[],
  getTs: (p: T) => number,
  getA: (p: T) => number | null,
  getB: (p: T) => number | null
): T[] {
  if (data.length <= DOWNSAMPLE_THRESHOLD) return data;
  const getY = (p: T) => (getA(p) ?? getB(p) ?? 0) as number;
  return lttb(data, DOWNSAMPLE_TARGET, getTs, getY);
}
