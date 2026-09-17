/**
 * 2地点間の距離を求める（Haversine、単位はメートル）。
 *
 * 打刻の位置チェックで使う。数百m〜数kmの範囲で誤差は0.5%未満なので、
 * 「店舗から何m離れているか」の判断には十分。
 */
const EARTH_RADIUS_METERS = 6_371_000;

export function haversineMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}
