// Deterministic checks. These are validation rules, not model reasoning or a confidence score.
function moneyCents(value) {
  let s = value
    .trim()
    .replace(/^(?:EUR|€)\s*/i, "")
    .replace(/\s*(?:EUR|€)$/i, "")
    .trim();
  if (
    !/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}$/.test(s) &&
    !/^-?\d+(?:\.\d{2})?$/.test(s)
  )
    return null;
  if (s.includes(",")) s = s.replaceAll(".", "").replace(",", ".");
  const n = Math.round(Number(s) * 100);
  return Number.isSafeInteger(n) && Math.abs(n) <= 10000000000 ? n : null;
}
function arithmeticCheck(text) {
  const found = { base: [], tax: [], total: [] };
  for (const line of text.split(/\r?\n/)) {
    const m = line
      .trim()
      .match(
        /^(base imponible|base|subtotal|(?:cuota(?:\s+de)?\s+)?IVA(?:\s*\(?\s*\d+(?:[.,]\d+)?\s*%\s*\)?)?|total(?:\s+factura|\s+a\s+pagar)?|importe(?:\s+total|\s+a\s+pagar))\s*:\s*(.+)$/i,
      );
    if (!m) continue;
    const label = m[1].toLowerCase();
    const key = /^(base|subtotal)/.test(label)
      ? "base"
      : /^(iva|cuota)/.test(label)
        ? "tax"
        : "total";
    found[key].push(moneyCents(m[2]));
  }
  if (
    /\b(descuento|recargo|retenci[oó]n|irpf|anticipo|suplido|gastos|portes)\b/i.test(
      text,
    )
  )
    return {
      status: "not_checked",
      reason: "Hay otros conceptos: no se ha comprobado la suma completa.",
    };
  if (
    Object.values(found).some(
      (values) => values.length !== 1 || values[0] === null,
    )
  )
    return {
      status: "not_checked",
      reason:
        "Para comprobar la suma hacen falta una base, una cuota de IVA y un total inequívocos, en líneas separadas.",
    };
  const base = found.base[0],
    tax = found.tax[0],
    total = found.total[0],
    expected = base + tax;
  return {
    status: expected === total ? "matched" : "mismatch",
    base,
    tax,
    total,
    expected,
    reason:
      expected === total
        ? "Base + cuota de IVA coincide con el total. No verifica precios, tipos fiscales ni autenticidad."
        : "La base más la cuota de IVA no coincide con el total del documento.",
  };
}
const typeLabels = {
  factura: "factura",
  proforma: "proforma",
  abono: "abono",
  albaran: "albarán",
  lista_precios: "lista de precios",
  oferta: "oferta",
  mensaje: "mensaje",
  otro: "sin tipo claro",
};
// Normalization for rules only: accents, case, OCR zeros inside words ("T0TAL") and spaced
// capitals ("F A C T U R A"). The original text is never altered or displayed from here.
function normalizeDoc(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(?<=[a-z])0(?=[a-z])/g, "o")
    .replace(/\b(?:[a-z] ){2,}[a-z]\b/g, (m) => m.replace(/ /g, ""));
}
// Order matters: "factura proforma" and "factura rectificativa" must not count as invoices.
const headingRules = [
  ["proforma", /^(?:factura\s+)?pro-?\s?forma\b|^presupuesto\b/],
  [
    "abono",
    /^(?:factura\s+rectificativa\b|nota\s+de\s+(?:abono|credito)\b|abono(?:\s+(?:n[º°o.]*|numero|#))?\s*[a-z]{0,3}-?\d)/,
  ],
  [
    "factura",
    /^(?:n[º°o.]*\s*)?factura(?:\s+simplificada|\s+electronica)?(?:\s*$|\s*[:#]|\s+(?:n[º°o.]*|num(?:ero)?\.?)(?:\s|$)|\s+[a-z]{0,3}-?\d)/,
  ],
  ["albaran", /^(?:albaran\b|nota\s+de\s+entrega\b|delivery\s+note\b)/],
  ["lista_precios", /^(?:lista(?:do)?\s+de\s+precios|tarifas?\b|catalogo\b)/],
  ["oferta", /^(?:ofertas?\b|promocion(?:es)?\b)/],
];
function documentHeadings(text) {
  const found = new Set();
  const lines = normalizeDoc(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/^[^a-z0-9{]+/, "").trim())
    .filter(Boolean)
    .slice(0, 10);
  for (const line of lines)
    for (const [type, re] of headingRules)
      if (re.test(line)) {
        found.add(type);
        break;
      }
  return [...found];
}
const messageCues =
  /[?¿]|(?:^|[^a-z])(?:hola|buenos dias|buenas(?: tardes| noches)?|gracias|saludos|oye|avisa(?:me|nos)|os|te|me|nos|podeis|quereis|quieres|puedes|prefieres|confirmais)(?:$|[^a-z])/;
// Rule-based reading of a document's type. Rules are the primary reading (measured against
// synthetic corpora); the model is a second opinion. Never treated as proof of anything.
function classifyDocument(text) {
  const headings = documentHeadings(text);
  if (headings.length > 1)
    return {
      tipo: "otro",
      confidence: "alta",
      reason: "Hay títulos de varios documentos: parece una mezcla.",
      headings,
    };
  if (headings.length === 1)
    return {
      tipo: headings[0],
      confidence: "alta",
      reason: "El título del documento indica " + typeLabels[headings[0]] + ".",
      headings,
    };
  const norm = normalizeDoc(text);
  if (norm.length <= 600 && messageCues.test(norm))
    return {
      tipo: "mensaje",
      confidence: "media",
      reason:
        "Texto breve con saludo, pregunta o trato directo: parece un mensaje.",
      headings,
    };
  return {
    tipo: "otro",
    confidence: "baja",
    reason: "Sin título de documento ni rasgos de mensaje.",
    headings,
  };
}
function reviewReading(text, first, second, mode) {
  const warnings = [];
  let agreement = mode === "careful" ? "disagreement" : "single";
  if (
    mode === "careful" &&
    !first.invalid &&
    second &&
    !second.invalid &&
    first.tipo === second.tipo
  )
    agreement = "agreement";
  const injection =
    /(?:ignora|ignore|olvida|disregard)\b[^\n]{0,90}(?:instrucciones|instructions|reglas|rules)/i.test(
      text,
    );
  if (injection)
    warnings.push(
      "El texto contiene posibles instrucciones dirigidas a una IA; se trata como contenido no fiable.",
    );
  const rules = classifyDocument(text);
  const headings = rules.headings;
  if (headings.length > 1)
    warnings.push(
      "Se detectan títulos de varios tipos de documento; revisa si hay documentos mezclados.",
    );
  const hardBlock = injection || headings.length > 1;
  let tipo;
  if (hardBlock) tipo = "otro";
  else if (rules.confidence !== "baja") {
    // Rules decide; the model is only contrasted.
    tipo = rules.tipo;
    if (first.invalid)
      warnings.push(
        "El modelo no dio una lectura válida; se muestra la lectura por reglas.",
      );
    else if (first.tipo !== rules.tipo)
      warnings.push(
        `Las reglas leen ${typeLabels[rules.tipo]} y el modelo propuso ${typeLabels[first.tipo]}. Prevalece la lectura por reglas: contrasta el original.`,
      );
    else if (mode === "careful" && agreement !== "agreement")
      warnings.push(
        "La segunda lectura del modelo discrepa; las reglas y la primera lectura coinciden.",
      );
  } else {
    // No rule evidence: the model only stands if its readings agree and the type needs no heading.
    if (first.invalid || (mode === "careful" && agreement !== "agreement"))
      warnings.push(
        "Las lecturas no permiten una clasificación consistente. Revisa el original.",
      );
    if (
      ["factura", "proforma", "abono", "albaran", "lista_precios"].includes(
        first.tipo,
      )
    )
      warnings.push(
        "No se encontró un encabezado documental inequívoco que respalde esta clasificación.",
      );
    tipo = warnings.length > 0 ? "otro" : first.tipo;
  }
  const proposedType = first.invalid ? "otro" : first.tipo;
  const arithmetic = ["factura", "proforma", "abono"].includes(
    hardBlock ? proposedType : tipo === "otro" ? proposedType : tipo,
  )
    ? arithmeticCheck(text)
    : null;
  if (arithmetic?.status === "mismatch") warnings.push(arithmetic.reason);
  if (arithmetic?.status === "mismatch") tipo = hardBlock ? "otro" : tipo;
  return {
    ...first,
    tipo,
    proposedType,
    modelType: proposedType,
    rules: {
      tipo: rules.tipo,
      confidence: rules.confidence,
      reason: rules.reason,
    },
    review: true,
    needsAttention: warnings.length > 0,
    warnings,
    verification: { mode, status: agreement },
    headings,
    arithmetic,
  };
}
module.exports = {
  moneyCents,
  arithmeticCheck,
  reviewReading,
  documentHeadings,
  classifyDocument,
  normalizeDoc,
  typeLabels,
};
