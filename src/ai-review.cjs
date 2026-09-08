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
        /^(base imponible|base|subtotal|IVA(?:\s*\(\d+(?:[.,]\d+)?\s*%\))?|cuota(?:\s+de)?\s+IVA|total(?:\s+factura)?|importe total)\s*:\s*(.+)$/i,
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
function documentHeadings(text) {
  const found = new Set();
  for (const line of text.split(/\r?\n/).slice(0, 12)) {
    const t = line.trim();
    if (/^(?:factura\s+)?proforma\b/i.test(t)) found.add("proforma");
    else if (
      /^(?:factura\s+rectificativa|nota\s+de\s+(?:abono|cr[eé]dito))\b/i.test(t)
    )
      found.add("abono");
    else if (
      /^factura(?:\s+simplificada)?(?:\s*$|\s+(?:(?:n[º°o.]|n[uú]mero|#)\s*)?[a-z0-9/-]*\d)/i.test(
        t,
      )
    )
      found.add("factura");
    else if (/^albar[aá]n\b/i.test(t)) found.add("albaran");
    else if (/^(?:lista(?:do)?\s+de\s+precios|tarifas?)\b/i.test(t))
      found.add("lista_precios");
    else if (/^oferta(?:s)?(?:\s+especial)?(?:[ :]|$)/i.test(t))
      found.add("oferta");
  }
  return [...found];
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
  if (first.invalid || (mode === "careful" && agreement !== "agreement"))
    warnings.push(
      "Las lecturas no permiten una clasificación consistente. Revisa el original.",
    );
  if (
    /(?:ignora|ignore|olvida|disregard)\b[^\n]{0,90}(?:instrucciones|instructions|reglas|rules)/i.test(
      text,
    )
  )
    warnings.push(
      "El texto contiene posibles instrucciones dirigidas a una IA; se trata como contenido no fiable.",
    );
  const proforma = /(?:^|\n)\s*(?:factura\s+)?proforma\b/i.test(text);
  const credit =
    /(?:^|\n)\s*(?:factura\s+rectificativa|nota\s+de\s+(?:abono|cr[eé]dito))\b/i.test(
      text,
    );
  if (proforma && first.tipo !== "proforma")
    warnings.push(
      "El original indica proforma; no debe tratarse como una factura de cobro.",
    );
  if (credit && first.tipo !== "abono")
    warnings.push(
      "El original indica rectificación o abono; requiere distinguirlo de una compra nueva.",
    );
  const headings = documentHeadings(text);
  if (headings.length > 1)
    warnings.push(
      "Se detectan títulos de varios tipos de documento; revisa si hay documentos mezclados.",
    );
  else if (headings.length === 1 && headings[0] !== first.tipo)
    warnings.push(
      "El encabezado y la clasificación de IA no coinciden. El título indica: " +
        {
          factura: "factura",
          proforma: "proforma",
          abono: "abono",
          albaran: "albarán",
          lista_precios: "lista de precios",
          oferta: "oferta",
        }[headings[0]] +
        ".",
    );
  else if (
    ["factura", "proforma", "abono", "albaran", "lista_precios"].includes(
      first.tipo,
    ) &&
    headings.length === 0
  )
    warnings.push(
      "No se encontró un encabezado documental inequívoco que respalde esta clasificación.",
    );
  const blocked = warnings.length > 0;
  const arithmetic = ["factura", "proforma", "abono"].includes(first.tipo)
    ? arithmeticCheck(text)
    : null;
  if (arithmetic?.status === "mismatch") warnings.push(arithmetic.reason);
  return {
    ...first,
    tipo: blocked ? "otro" : first.tipo,
    proposedType: first.tipo,
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
};
