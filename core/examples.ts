// Datos de ejemplo: lo que trae un espacio creado con seed() (productos p1–p10, proveedores
// s1–s4, la receta r1 y el mensaje de bienvenida) y lo que se hizo con ellos para practicar
// (pedidos que nunca salieron por WhatsApp y mensajes de demostración). removeExamples quita
// solo lo que la persona no usa: un producto de ejemplo que está en una receta, en una
// producción, en un pedido que se queda, en una pesada, en un cierre confirmado o con
// movimientos propios se conserva. Se reconoce por su identificador fijo, nunca por el nombre.
import type { State } from "./schema";
import { seed } from "./seed";

export const exampleIds = {
  products: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"],
  suppliers: ["s1", "s2", "s3", "s4"],
  recipes: ["r1"],
  messages: ["welcome-message"],
};

export type ExamplesPlan = {
  orders: { id: string; number: string }[];
  messages: number;
  recipes: { id: string; name: string }[];
  products: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  // Productos de ejemplo que se quedan porque se usan, con el motivo.
  kept: { id: string; name: string; why: string }[];
};

// Misma composición, sin depender del orden de las claves.
const same = (a: object | undefined, b: object | undefined) => {
  const key = (x: object | undefined) =>
    JSON.stringify(
      Object.entries(x ?? {}).sort(([k], [l]) => (k < l ? -1 : 1)),
    );
  return key(a) === key(b);
};

export function examplesPlan(s: State): ExamplesPlan {
  // Una receta de ejemplo se va si no tiene producciones vivas.
  const recipes = s.recipes.filter(
    (r) =>
      exampleIds.recipes.includes(r.id) &&
      !s.productions.some((p) => p.recipe === r.id && p.status !== "discarded"),
  );
  const goneRecipes = new Set(recipes.map((r) => r.id));
  // Un pedido que nunca salió por WhatsApp era una práctica («Simular envío»).
  const orders = s.orders.filter((o) => !o.dispatch);
  const goneOrders = new Set(orders.map((o) => o.id));
  const messages = s.messages.filter(
    (m) => m.channel === "demo" || exampleIds.messages.includes(m.id),
  );
  const goneMessages = new Set(messages.map((m) => m.id));
  const keptRecipes = s.recipes.filter((r) => !goneRecipes.has(r.id));
  const why = (id: string): string | null => {
    const inRecipe = keptRecipes.find(
      (r) =>
        r.product === id ||
        r.ingredients.some((i) => i.product === id) ||
        (r.process ?? []).some((x) => x.product === id),
    );
    if (inRecipe) return `está en la receta ${inRecipe.name}`;
    if (
      s.productions.some(
        (p) =>
          !goneRecipes.has(p.recipe) &&
          (p.lines.some((l) => l.product === id) || p.output?.product === id),
      )
    )
      return "tiene producciones";
    const order = s.orders.find(
      (o) => !goneOrders.has(o.id) && o.lines.some((l) => l.product === id),
    );
    if (order) return `está en el pedido ${order.number}, enviado por WhatsApp`;
    if (
      s.movements.some(
        (m) => m.product === id && !(m.order && goneOrders.has(m.order)),
      )
    )
      return "tiene movimientos de stock apuntados a mano";
    if (s.prices.some((p) => p.product === id))
      return "tiene cambios de precio apuntados";
    if (s.weighings.some((w) => w.product === id)) return "tiene pesadas";
    if (s.days.some((d) => d.snapshot.rows.some((r) => r.product === id)))
      return "sale en un día cerrado";
    if (
      s.nameProducts.some((n) => n.product === id) ||
      s.flavorSkips.some((f) => f.product === id)
    )
      return "lo enlazaste con tu lista de precios o tu tabla";
    return null;
  };
  const products = [];
  const kept = [];
  for (const p of s.products.filter((x) =>
    exampleIds.products.includes(x.id),
  )) {
    const reason = why(p.id);
    if (reason) kept.push({ id: p.id, name: p.name, why: reason });
    else products.push({ id: p.id, name: p.name });
  }
  const goneProducts = new Set(products.map((p) => p.id));
  const stays = (supplier: string) =>
    s.products.some(
      (p) =>
        !goneProducts.has(p.id) &&
        (p.supplier === supplier ||
          p.alternates.some((a) => a.supplier === supplier)),
    ) ||
    s.orders.some((o) => !goneOrders.has(o.id) && o.supplier === supplier) ||
    s.messages.some(
      (m) => !goneMessages.has(m.id) && m.supplier === supplier,
    ) ||
    s.photos.some(
      (f) => f.supplier === supplier || f.suggestion?.supplier === supplier,
    ) ||
    s.prices.some((p) => p.supplier === supplier);
  const suppliers = s.suppliers
    .filter((x) => exampleIds.suppliers.includes(x.id) && !stays(x.id))
    .map((x) => ({ id: x.id, name: x.name }));
  return {
    orders: orders.map((o) => ({ id: o.id, number: o.number })),
    messages: messages.length,
    recipes: recipes.map((r) => ({ id: r.id, name: r.name })),
    products,
    suppliers,
    kept,
  };
}

// Aplica el plan sobre una copia ya clonada por apply(). Nada cambia de stock en lo que se
// queda: un movimiento de un pedido de práctica se conserva y solo pierde el enlace al pedido.
export function removeExamples(s: State): ExamplesPlan {
  const plan = examplesPlan(s);
  const gone = (list: { id: string }[]) => new Set(list.map((x) => x.id));
  const orders = gone(plan.orders),
    recipes = gone(plan.recipes),
    products = gone(plan.products),
    suppliers = gone(plan.suppliers);
  s.recipes = s.recipes.filter((r) => !recipes.has(r.id));
  s.productions = s.productions.filter((p) => !recipes.has(p.recipe));
  s.orders = s.orders.filter((o) => !orders.has(o.id));
  s.messages = s.messages.filter(
    (m) => !(m.channel === "demo" || exampleIds.messages.includes(m.id)),
  );
  for (const m of s.messages)
    if (m.order && orders.has(m.order)) delete m.order;
  for (const f of s.photos) {
    if (f.order && orders.has(f.order)) delete f.order;
    if (f.suggestion?.order && orders.has(f.suggestion.order))
      delete f.suggestion.order;
  }
  s.movements = s.movements.filter((m) => !products.has(m.product));
  for (const m of s.movements)
    if (m.order && orders.has(m.order)) delete m.order;
  s.cart = s.cart.filter(
    (l) =>
      !products.has(l.product) && !(l.supplier && suppliers.has(l.supplier)),
  );
  s.products = s.products.filter((p) => !products.has(p.id));
  s.suppliers = s.suppliers.filter((x) => !suppliers.has(x.id));
  // La composición de ejemplo no es la del ingrediente de la persona: si nadie la cambió, se
  // quita y el balance dirá que falta, en lugar de calcular con valores inventados.
  const example = new Map(seed().products.map((p) => [p.id, p.composition]));
  for (const p of s.products)
    if (
      exampleIds.products.includes(p.id) &&
      p.composition &&
      same(p.composition, example.get(p.id))
    )
      delete p.composition;
  s.demo = false;
  return plan;
}
