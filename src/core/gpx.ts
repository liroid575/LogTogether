export interface GpxPoint { lat: number; lon: number; elevation?: number; time?: string; }
export interface GpxSummary {
  points: GpxPoint[];
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  highestPointM?: number;
  elapsedMinutes?: number;
}

const EARTH_RADIUS_KM = 6371.0088;

function radians(value: number): number { return value * Math.PI / 180; }

export function haversineKm(a: GpxPoint, b: GpxPoint): number {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function summarizePoints(points: GpxPoint[]): GpxSummary {
  let distanceKm = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;
  let highestPointM: number | undefined;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    if (!previous || !current) continue;
    distanceKm += haversineKm(previous, current);
    if (typeof current.elevation === "number") highestPointM = Math.max(highestPointM ?? current.elevation, current.elevation);
    if (typeof previous.elevation === "number" && typeof current.elevation === "number") {
      const delta = current.elevation - previous.elevation;
      if (delta > 0) elevationGainM += delta;
      if (delta < 0) elevationLossM += Math.abs(delta);
    }
  }
  const timed = points.filter(point => point.time && Number.isFinite(new Date(point.time).getTime()));
  const elapsedMinutes = timed.length >= 2 ? Math.max(0, Math.round((new Date(timed[timed.length - 1]!.time!).getTime() - new Date(timed[0]!.time!).getTime()) / 60000)) : undefined;
  return {
    points,
    distanceKm: Math.round(distanceKm * 100) / 100,
    elevationGainM: Math.round(elevationGainM),
    elevationLossM: Math.round(elevationLossM),
    highestPointM: highestPointM === undefined ? undefined : Math.round(highestPointM),
    elapsedMinutes
  };
}

export function parseGpx(xml: string): GpxSummary {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("Invalid GPX file");
  const points: GpxPoint[] = [...document.querySelectorAll("trkpt")].map(node => {
    const lat = Number(node.getAttribute("lat"));
    const lon = Number(node.getAttribute("lon"));
    const elevationText = node.querySelector("ele")?.textContent;
    const time = node.querySelector("time")?.textContent?.trim() || undefined;
    return { lat, lon, elevation: elevationText === undefined || elevationText === null ? undefined : Number(elevationText), time };
  }).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (points.length < 2) throw new Error("GPX must contain at least two track points");
  return summarizePoints(points);
}
