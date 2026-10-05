// Utilidades pequeñas que comparten los módulos del núcleo (antes cada uno tenía su copia).

/** Redondeo a tres decimales: los gramos dentro de los kilos, los mililitros dentro de los litros. */
export const kg = (n: number): number => Math.round(n * 1000) / 1000;

/** Dos cifras: 5 → «05». */
export const pad = (n: number): string => String(n).padStart(2, "0");

/** Sin tildes y en minúsculas, para comparar textos escritos de formas distintas. */
export const fold = (v: string): string =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Aritmética de calendario sobre "AAAA-MM-DD" (sin zonas: son fechas, no instantes). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const x = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}
