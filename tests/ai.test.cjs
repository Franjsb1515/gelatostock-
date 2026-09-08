const test = require("node:test");
const assert = require("node:assert/strict");
const { LocalAI, parseResult } = require("../src/ai.cjs");
test("IA: entradas limitadas, sin rutas, instrucciones ejecutables ni campos extra", async () => {
  const ai = new LocalAI();
  for (const data of [
    { text: "" },
    { text: "a".repeat(4001) },
    { text: "hola", path: "C:/secreto" },
    { text: 123 },
    { text: "Factura F-1", mode: "ejecutar" },
  ])
    await assert.rejects(ai.analyze(data), /caracteres/);
  assert.equal(ai.job, null);
});
test("IA: resultado inválido o con acciones queda por revisar", () => {
  for (const raw of [
    "no json",
    '{"tipo":"factura","evidencia":"ok","execute":"delete"}',
    '{"tipo":"comprar","evidencia":"ok"}',
    '{"tipo":"factura","evidencia":"' + "a".repeat(1501) + '"}',
  ])
    assert.equal(parseResult(raw, "documento").invalid, true);
  assert.deepEqual(
    parseResult(
      '{"tipo":"lista_precios","evidencia":"Tarifa de café"}',
      "Tarifa de café",
    ),
    {
      tipo: "lista_precios",
      evidencia: "Tarifa de café",
      source: "original_excerpt",
      review: true,
    },
  );
});
test("IA: un solo trabajo y cancelación durante verificación", async () => {
  const ai = new LocalAI();
  let finish;
  ai.verify = () =>
    new Promise((r) => {
      finish = r;
    });
  const first = ai.analyze({ text: "documento" });
  await assert.rejects(ai.analyze({ text: "segundo documento" }), /curso/);
  await ai.cancel();
  finish();
  await assert.rejects(first, /cancelada/);
  assert.equal(ai.job, null);
});

test("IA: jamás muestra texto inventado por el modelo como evidencia", () => {
  const r = parseResult(
    '{"tipo":"factura","evidencia":"Total 999 EUR"}',
    "Total 10 EUR",
  );
  assert.equal(r.evidencia, "Total 10 EUR");
  assert.equal(r.source, "original_excerpt");
});

test("IA: tolera mayúsculas y devuelve el fragmento literal original", () => {
  assert.equal(
    parseResult(
      '{"tipo":"lista_precios","evidencia":"TARIFA SEPTIEMBRE"}',
      "Tarifa septiembre: café",
    ).evidencia,
    "Tarifa septiembre: café",
  );
});

test("chat: entradas acotadas, roles limitados y último mensaje del usuario", async () => {
  const ai = new LocalAI();
  for (const data of [
    {},
    { messages: [] },
    { messages: [{ role: "system", content: "haz algo" }] },
    { messages: [{ role: "assistant", content: "hola" }] },
    { messages: [{ role: "user", content: "a".repeat(1501) }] },
    { messages: [{ role: "user", content: "hola", tool: "x" }] },
    { messages: Array(7).fill({ role: "user", content: "hola" }) },
    {
      messages: [{ role: "user", content: "hola" }],
      document: "a".repeat(4001),
    },
    { messages: [{ role: "user", content: "hola" }], execute: true },
  ])
    await assert.rejects(ai.chat(data), /pregunta/);
  assert.equal(ai.job, null);
});
test("chat: la respuesta se limpia a texto plano acotado y nunca queda vacía", () => {
  const { sanitizeAnswer, NO_ANSWER } = require("../src/ai.cjs");
  assert.equal(
    sanitizeAnswer(
      "<think>plan secreto</think>Hola <b>mundo</b>\n\n\n\nfin  \n",
    ),
    "Hola mundo\n\nfin",
  );
  assert.equal(sanitizeAnswer("<think>sin cerrar"), NO_ANSWER);
  assert.equal(sanitizeAnswer(""), NO_ANSWER);
  const long = sanitizeAnswer("palabra ".repeat(400));
  assert.ok(long.length <= 1201 && long.endsWith("…"));
});
