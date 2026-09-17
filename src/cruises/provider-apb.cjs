// Adaptador de la fuente oficial: Autoridad Portuaria de Baleares (visor público de previsión
// de tráfico, enlazado desde su ficha de datos abiertos). Solo sabe hablar HTTP con el puerto;
// la validación vive en core/cruises.ts y el guardado en repository.cjs. Cambiar de fuente es
// escribir otro adaptador con estos mismos tres métodos.
// Peticiones de cuerpo fijo: nunca viaja ningún dato del negocio.
const BASE = "https://posidoniaweb.portsdebalears.com/gisweb_server";
const PALMA_CRUISES = JSON.stringify({
  groupOp: "AND",
  rules: [
    { field: "tipbuq", op: "eq", data: "7" },
    { field: "codpue", op: "eq", data: "P" },
  ],
});
const MAX_BYTES = 20_000_000;

class ApbProvider {
  constructor({
    fetchImpl = fetch,
    timeoutMs = 45000,
    retryDelayMs = 3000,
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.retryDelayMs = retryDelayMs;
    this.name = "Autoridad Portuaria de Baleares";
    this.url = "https://www.portsdebalears.com/es/buques-en-puerto";
  }
  async post(path, body, cookie) {
    const r = await this.fetchImpl(BASE + path, {
      method: "POST",
      headers: {
        "User-Agent": "GelatoStock (consulta de datos abiertos de la APB)",
        "Content-Type": "application/x-www-form-urlencoded",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (r.status === 429 || r.status === 503) {
      const error = Error(
        "El puerto pide esperar antes de volver a consultar.",
      );
      error.rateLimited = true;
      throw error;
    }
    if (!r.ok) throw Error("El puerto respondió " + r.status + ".");
    return r;
  }
  // One controlled retry, only for network failures (never for rate limits or bad answers).
  async withRetry(task) {
    try {
      return await task();
    } catch (e) {
      const network =
        e?.name === "TimeoutError" ||
        e?.name === "AbortError" ||
        e?.cause?.code;
      if (!network || e?.rateLimited) throw e;
      await new Promise((r) => setTimeout(r, this.retryDelayMs));
      return task();
    }
  }
  // Anonymous session, exactly as the public viewer opens it.
  async session() {
    const r = await this.post("/login.do?metodo=login", "autpor=80");
    return (r.headers.getSetCookie?.() || [])
      .map((c) => c.split(";")[0])
      .join("; ");
  }
  async json(path, body, cookie) {
    const r = await this.post(path, body, cookie);
    const text = await r.text();
    if (text.length > MAX_BYTES)
      throw Error("Respuesta del puerto demasiado grande.");
    try {
      return JSON.parse(text);
    } catch {
      throw Error("El puerto devolvió algo que no es JSON.");
    }
  }
  /** Previsión vigente (todos los puertos y tipos; el filtro fiable se hace al validar). */
  forecast() {
    return this.withRetry(async () => {
      const cookie = await this.session();
      const payload = await this.json(
        "/atraqueop.do?metodo=list",
        "_search=false&rows=5000&page=1&sidx=fecatr&sord=asc",
        cookie,
      );
      let sourceUpdatedAt = "";
      try {
        const stamp = await this.json(
          "/lastupdatetime.do?metodo=generarPantalla",
          "",
          cookie,
        );
        sourceUpdatedAt = String(stamp?.fecactualizacion || "");
      } catch {
        // The update stamp is a courtesy of the source; the forecast is valid without it.
      }
      return { payload, sourceUpdatedAt, cookie };
    });
  }
  /** Escalas finalizadas de cruceros en Palma, de la más reciente a la más antigua. */
  history({ page = 1, rows = 60, cookie } = {}) {
    return this.withRetry(async () => {
      const session = cookie || (await this.session());
      const body = new URLSearchParams({
        _search: "true",
        filters: PALMA_CRUISES,
        rows: String(rows),
        page: String(page),
        sidx: "fecatr",
        sord: "desc",
      }).toString();
      return this.json("/atraqueophis.do?metodo=list", body, session);
    });
  }
}

module.exports = { ApbProvider };
