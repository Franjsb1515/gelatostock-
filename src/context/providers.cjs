// Adaptadores de las fuentes de contexto. Misma forma que el de cruceros: solo HTTP, cuerpo fijo,
// sin datos del negocio. La validación vive en core/context.ts.
//  - Clima: MET Norway (api.met.no). Datos abiertos CC BY 4.0, uso comercial permitido con cita.
//    Sus condiciones piden identificar la aplicación en el User-Agent y no consultar más de lo
//    necesario: se respeta la cabecera Expires y se usa If-Modified-Since.
//  - Festivos: catálogo de datos abiertos del Govern de les Illes Balears (CKAN), conjunto
//    «Calendari Laboral General i Local Illes Balears <año>», licencia Creative Commons Attribution.
const version = require("../../package.json").version;
const { PALMA } = require("../../build/context.js");

const UA = `GelatoStock/${version} (aplicacion de escritorio local; planificacion de una heladeria en Palma)`;
const CKAN =
  "https://intranet.caib.es/opendatacataleg/api/3/action/package_show?id=";
const MAX_BYTES = 5_000_000;

class MetnoProvider {
  constructor({ fetchImpl = fetch, timeoutMs = 30000 } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }
  /** Devuelve { notModified } o { payload, expires, lastModified, updatedAt }. */
  async forecast({ ifModifiedSince = "" } = {}) {
    const r = await this.fetchImpl(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${PALMA.lat}&lon=${PALMA.lon}`,
      {
        headers: {
          "User-Agent": UA,
          ...(ifModifiedSince ? { "If-Modified-Since": ifModifiedSince } : {}),
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    );
    if (r.status === 304)
      return { notModified: true, expires: r.headers.get("expires") || "" };
    if (r.status === 429 || r.status === 403) {
      const error = Error(
        "El servicio meteorológico pide esperar antes de volver a consultar.",
      );
      error.rateLimited = true;
      throw error;
    }
    if (!r.ok)
      throw Error("El servicio meteorológico respondió " + r.status + ".");
    const text = await r.text();
    if (text.length > MAX_BYTES)
      throw Error("Respuesta meteorológica demasiado grande.");
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw Error("El servicio meteorológico devolvió algo que no es JSON.");
    }
    return {
      payload,
      expires: r.headers.get("expires") || "",
      lastModified: r.headers.get("last-modified") || "",
      updatedAt: String(payload?.properties?.meta?.updated_at || ""),
    };
  }
}

class CaibHolidayProvider {
  constructor({ fetchImpl = fetch, timeoutMs = 30000 } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }
  async get(url) {
    const r = await this.fetchImpl(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (r.status === 404) return null;
    if (!r.ok)
      throw Error("El catálogo del Govern respondió " + r.status + ".");
    return r;
  }
  /** CSV oficial del año, o { missing: true } si el Govern aún no lo ha publicado en CSV. */
  async calendar(year) {
    const pkg = await this.get(
      `${CKAN}calendari-laboral-general-i-local-illes-balears-${Number(year)}`,
    );
    if (!pkg)
      return { missing: true, reason: "sin conjunto de datos para ese año" };
    const meta = await pkg.json();
    const resource = (meta?.result?.resources || []).find(
      (x) =>
        String(x.format).toUpperCase() === "CSV" &&
        /^https:\/\/intranet\.caib\.es\//.test(String(x.url)),
    );
    if (!resource)
      return { missing: true, reason: "el año no está publicado en CSV" };
    const file = await this.get(resource.url);
    if (!file)
      return { missing: true, reason: "el CSV ya no está en el catálogo" };
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_BYTES)
      throw Error("CSV de festivos demasiado grande.");
    // The Govern publishes Windows-1252; a future UTF-8 file is detected and read as such.
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder("windows-1252").decode(bytes);
    }
    return {
      text,
      url: resource.url,
      modified: String(meta?.result?.metadata_modified || ""),
      license: String(meta?.result?.license_title || ""),
    };
  }
}

module.exports = { MetnoProvider, CaibHolidayProvider };
