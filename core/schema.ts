import { z } from "zod";
import { replyCategories } from "./messages";
export const idSchema = z.string().regex(/^[a-zA-Z0-9-]{1,100}$/);
export const quantity = z
  .number()
  .finite()
  .min(0)
  .max(1_000_000)
  .refine(
    (n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 0.00001,
    "Máximo tres decimales.",
  );
const signedQuantity = z.number().finite().min(-1_000_000).max(1_000_000);
const text = (max = 200) => z.string().trim().min(1).max(max);
const documentDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Fecha inválida.");
const at = z.string().datetime();
const cents = z.number().int().min(0).max(100_000_000);
// Composition per 100 g or 100 mL, in percent. Optional: only what the ingredient sheet says.
const pct = z.number().min(0).max(100);
export const compositionSchema = z
  .object({ sugars: pct, fat: pct, solids: pct, msnf: pct })
  .partial();
export const zones = z.enum([
  "vitrina",
  "camara",
  "congelador",
  "almacen",
  "obrador",
  "barra",
  "otra",
]);
export const productFields = {
  name: text(100),
  composition: compositionSchema.optional(),
  // Where the product is counted; drives the guided count sheets.
  zone: zones.default("almacen"),
  detail: z.string().max(200).default(""),
  category: z.enum(["Gelatería", "Cafetería", "Postres", "Envases"]),
  unit: z.enum(["kg", "L", "ud"]),
  stock: quantity,
  min: quantity,
  target: quantity,
  pack: quantity.refine((n) => n > 0),
  price: cents,
  supplier: idSchema,
};
export const productSchema = z.object({
  id: idSchema,
  ...productFields,
  icon: z.string().max(30).default("box"),
});
const supplierFields = {
  name: text(100),
  initials: text(5),
  category: text(100),
  delivery: text(200),
  aliases: z.string().max(1000).optional(),
  taxId: z.string().trim().max(30).optional(),
  whatsapp: z
    .string()
    .transform((v) => v.replace(/[ ()-]/g, ""))
    .refine(
      (v) => v === "" || /^\+[1-9]\d{7,14}$/.test(v),
      "Usa el teléfono con prefijo internacional, por ejemplo +34.",
    )
    .optional(),
  // Purchase website (Makro and similar). Only https, opened in the system browser on demand.
  web: z
    .string()
    .trim()
    .max(200)
    .refine(
      (v) =>
        v === "" || /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:[/?#]\S*)?$/i.test(v),
      "Usa una dirección completa que empiece por https://",
    )
    .optional(),
  color: z.enum(["sage", "rose", "sand", "lavender"]),
};
const supplierSchema = z.object({ id: idSchema, ...supplierFields });
const lineSchema = z.object({
  product: idSchema,
  packs: z.number().int().min(1).max(10000),
  pack: quantity.refine((n) => n > 0),
  price: cents,
  received: quantity,
});
// A real send: what was sent, to whom and when. Set once; sending never changes stock.
const dispatchSchema = z.object({
  channel: z.literal("whatsapp"),
  to: text(30),
  messageId: text(200),
  at,
  text: text(4000),
});
const orderSchema = z.object({
  id: idSchema,
  number: z.string().regex(/^GS-\d+$/),
  supplier: idSchema,
  status: z.enum(["pending", "sent", "partial", "received", "cancelled"]),
  at,
  simulated: z.literal(true),
  lines: z.array(lineSchema).min(1).max(10000),
  dispatch: dispatchSchema.optional(),
  expected: documentDate.optional(),
  // Set when the supplier confirmed (by a linked reply or by hand). Never changes stock.
  confirmedAt: at.optional(),
});
export const priorities = z.enum(["important", "normal", "low", "review"]);
export const relevanceLevels = z.enum([
  "relevant",
  "informational",
  "irrelevant",
  "review",
]);
const messageSchema = z.object({
  id: idSchema,
  supplier: idSchema,
  text: text(5000),
  kind: z.enum(["change", "delivery", "promotion", "confirmation", "unknown"]),
  priority: priorities,
  reason: text(500),
  relevance: relevanceLevels.default("review"),
  relevanceReason: text(500).default(
    "Mensaje anterior: relevancia pendiente de revisión.",
  ),
  read: z.boolean(),
  reviewed: z.boolean().default(false),
  at,
  simulated: z.boolean().default(true),
  channel: z.enum(["demo", "whatsapp"]).default("demo"),
  sender: z.string().max(30).optional(),
  order: idSchema.optional(),
  decision: text(300).optional(),
  decidedAt: at.optional(),
  interpretation: z
    .object({
      category: z.enum(replyCategories),
      needsReading: z.boolean(),
      deliveryDate: documentDate.optional(),
      deliveryHint: text(100).optional(),
      missing: text(120).optional(),
      summary: text(300),
      learned: z.boolean().optional(),
      corrected: z.boolean().optional(),
    })
    .optional(),
  aiReading: z
    .object({
      category: z.enum(replyCategories),
      status: z.enum(["agreement", "disagreement", "invalid"]),
      model: text(100),
      at,
    })
    .optional(),
});
const ingredientSchema = z.object({
  product: idSchema,
  quantity: quantity.refine((n) => n > 0),
});
export const recipeFamilies = z.enum([
  "crema",
  "sorbete",
  "postre",
  "base",
  "otro",
]);
export const recipeFields = {
  name: text(100),
  family: recipeFamilies.default("crema"),
  product: idSchema.optional(),
  yield: quantity.refine((n) => n > 0),
  ingredients: z.array(ingredientSchema).min(1).max(100),
  // Free text for the book: method and allergens. Never used in calculations.
  steps: z.string().max(3000).default(""),
  allergens: z.string().max(300).default(""),
  note: z.string().max(500).default(""),
};
// Sale value per kilo of the finished gelato, written by the person. A history: the value of a
// business day is the entry with the latest "from" on or before it, so the past never changes.
const saleValueSchema = z.object({
  from: documentDate,
  cents: cents.refine((n) => n > 0),
  at,
});
const recipeSchema = z.object({
  id: idSchema,
  ...recipeFields,
  saleValues: z.array(saleValueSchema).max(1000).default([]),
  // Cost per kilo written by hand; while it exists it rules over the calculated one.
  manualCost: z.object({ cents: cents.refine((n) => n > 0), at }).optional(),
});
const productionSchema = z.object({
  id: idSchema,
  recipe: idSchema,
  name: text(100),
  quantity: quantity.refine((n) => n > 0),
  date: documentDate,
  at,
  status: z.enum(["proposed", "applied", "discarded"]),
  lines: z.array(z.object({ product: idSchema, quantity })).max(100),
  output: z.object({ product: idSchema, quantity }).optional(),
  note: z.string().max(500).default(""),
  // An applied production that was annulled: its movements were compensated, never erased.
  voidedAt: at.optional(),
  voidReason: z.string().max(200).optional(),
  // Snapshot of the cost when it was approved (cents for the whole batch). Absent: not available.
  cost: z
    .object({ cents, source: z.enum(["calculated", "manual"]) })
    .optional(),
});
export const documentTypes = z.enum([
  "factura",
  "proforma",
  "abono",
  "albaran",
  "lista_precios",
  "oferta",
  "mensaje",
  "otro",
]);
const photoSchema = z
  .object({
    id: idSchema,
    name: text(200),
    ocrText: z.string().max(20000).optional(),
    supplier: idSchema.optional(),
    documentDate: documentDate.optional(),
    docType: documentTypes.optional(),
    order: idSchema.optional(),
    source: z.enum(["photo", "whatsapp"]).default("photo"),
    suggestion: z
      .object({
        supplier: idSchema.optional(),
        order: idSchema.optional(),
        docType: documentTypes.optional(),
        reason: text(300),
      })
      .optional(),
    note: z.string().max(500),
    at,
    data: z
      .string()
      .max(14_000_000)
      .regex(
        /^data:(?:image\/(?:png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/,
      )
      .optional(),
    file: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    mime: z
      .enum(["image/png", "image/jpeg", "image/webp", "application/pdf"])
      .optional(),
  })
  .refine((p) => !!p.data || !!p.file, "Falta el archivo adjunto.");
export const movementSchema = z.object({
  id: idSchema,
  product: idSchema,
  kind: z.enum([
    "count",
    "entry",
    "exit",
    "waste",
    "receipt",
    "reversal",
    "production",
    "output",
  ]),
  delta: signedQuantity,
  before: quantity,
  after: quantity,
  reason: text(500),
  at,
  order: idSchema.optional(),
  reverses: idSchema.optional(),
  production: idSchema.optional(),
});
// A confirmed day close: the summary as it was when the person confirmed it. Key order matters:
// it is the same as in core/day.ts, so a stored snapshot can be compared with a fresh one.
const amount = z.number().finite().min(-1_000_000).max(1_000_000);
const maybeCents = z.number().int().min(0).max(10_000_000_000).nullable();
export const daySnapshotSchema = z.object({
  rows: z
    .array(
      z.object({
        product: idSchema,
        name: text(100),
        opening: amount,
        produced: amount,
        sold: amount,
        waste: amount,
        gift: amount,
        adjust: amount,
        remaining: amount,
        saleValue: maybeCents,
        soldCents: maybeCents,
        wasteCents: maybeCents,
        giftCents: maybeCents,
      }),
    )
    .max(10000),
  totals: z.object({
    opening: amount,
    produced: amount,
    sold: amount,
    waste: amount,
    gift: amount,
    adjust: amount,
    remaining: amount,
    soldCents: maybeCents,
    wasteCents: maybeCents,
    giftCents: maybeCents,
  }),
});
const dayCloseSchema = z.object({
  id: idSchema,
  date: documentDate,
  status: z.enum(["closed", "reopened"]),
  confirmedAt: at,
  // What the person says was really sold that day (till, TPV…). Optional; never calculated.
  realSaleCents: cents.optional(),
  snapshot: daySnapshotSchema,
  log: z
    .array(
      z.object({
        at,
        kind: z.enum(["confirmed", "reopened"]),
        reason: z.string().max(200).default(""),
      }),
    )
    .max(200),
});
export const stateSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().min(0),
  business: text(80),
  place: z.string().max(80).default(""),
  demo: z.literal(true),
  products: z.array(productSchema).max(100000),
  suppliers: z.array(supplierSchema).max(100000),
  cart: z
    .array(
      z.object({
        product: idSchema,
        packs: z.number().int().min(1).max(10000),
      }),
    )
    .max(10000),
  orders: z.array(orderSchema).max(100000),
  messages: z.array(messageSchema).max(100000),
  activity: z
    .array(z.object({ id: idSchema, at, text: text(1000) }))
    .max(500000),
  photos: z.array(photoSchema).max(100000),
  processed: z.array(idSchema).default([]),
  movements: z.array(movementSchema).default([]),
  recipes: z.array(recipeSchema).max(10000).default([]),
  productions: z.array(productionSchema).max(100000).default([]),
  learned: z
    .array(
      z.object({
        id: idSchema,
        pattern: text(300),
        category: z.enum(replyCategories),
        example: text(300),
        at,
      }),
    )
    .max(5000)
    .default([]),
  // Confirmed day closes, newest first.
  days: z.array(dayCloseSchema).max(100000).default([]),
  // Price history per product (cents per pack): every change of the card price, oldest first.
  prices: z
    .array(
      z.object({
        id: idSchema,
        product: idSchema,
        supplier: idSchema,
        at,
        from: cents,
        to: cents,
        source: z.enum(["edit", "document", "message"]).default("edit"),
      }),
    )
    .max(100000)
    .default([]),
});
export type State = z.infer<typeof stateSchema>;
export type Product = z.infer<typeof productSchema>;
export type Movement = z.infer<typeof movementSchema>;
export type Photo = State["photos"][number];
export type Message = State["messages"][number];
export type Recipe = State["recipes"][number];
export type Learned = State["learned"][number];
export type Production = State["productions"][number];
export type DayClose = State["days"][number];
export type DaySnapshot = z.infer<typeof daySnapshotSchema>;
const productInput = z.object({ type: z.literal("product"), ...productFields });
export const actionSchema = z.intersection(
  z.object({
    revision: z.number().int().min(0).optional(),
    operationId: idSchema.optional(),
  }),
  z.discriminatedUnion("type", [
    productInput,
    z.object({
      type: z.literal("editProduct"),
      product: idSchema,
      composition: compositionSchema.optional(),
      zone: zones.optional(),
      name: text(100),
      detail: z.string().max(200),
      min: quantity,
      target: quantity,
      pack: quantity.refine((n) => n > 0),
      price: cents,
      supplier: idSchema,
    }),
    z.object({
      type: z.literal("supplier"),
      id: idSchema.optional(),
      ...supplierFields,
    }),
    z.object({
      type: z.literal("count"),
      product: idSchema,
      value: quantity,
      reason: text(500).default("Conteo manual"),
    }),
    z.object({
      type: z.literal("movement"),
      product: idSchema,
      kind: z.enum(["entry", "exit", "waste"]),
      value: quantity.refine((n) => n > 0),
      reason: text(500),
    }),
    z.object({ type: z.literal("reverse"), id: idSchema, reason: text(500) }),
    z.object({
      type: z.literal("cart"),
      product: idSchema,
      packs: z.number().int().min(0).max(10000),
    }),
    z.object({ type: z.literal("suggest") }),
    z.object({ type: z.literal("authorize") }),
    z.object({
      type: z.literal("send"),
      order: idSchema,
      dispatch: dispatchSchema.optional(),
    }),
    z.object({ type: z.literal("cancel"), order: idSchema }),
    z.object({
      type: z.literal("setExpected"),
      order: idSchema,
      date: documentDate,
    }),
    z.object({ type: z.literal("confirmOrder"), order: idSchema }),
    // The supplier cannot serve a product: it leaves the order (nothing received yet for it).
    z.object({
      type: z.literal("removeLine"),
      order: idSchema,
      product: idSchema,
    }),
    z.object({
      type: z.literal("receive"),
      order: idSchema,
      lines: z.array(z.object({ product: idSchema, value: quantity })).min(1),
    }),
    z.object({
      type: z.literal("message"),
      supplier: idSchema,
      text: text(5000),
      eventId: idSchema.optional(),
      channel: z.enum(["demo", "whatsapp"]).default("demo"),
      sender: z.string().max(30).optional(),
    }),
    z.object({ type: z.literal("read"), id: idSchema }),
    z.object({ type: z.literal("review"), id: idSchema }),
    z.object({
      type: z.literal("priority"),
      id: idSchema,
      priority: priorities,
    }),
    z.object({
      type: z.literal("relevance"),
      id: idSchema,
      relevance: relevanceLevels,
      reason: text(500),
    }),
    z.object({ type: z.literal("link"), id: idSchema, order: idSchema }),
    z.object({
      type: z.literal("correctReading"),
      id: idSchema,
      category: z.enum(replyCategories),
      remember: z.boolean().default(true),
    }),
    z.object({ type: z.literal("forgetLearned"), id: idSchema }),
    // Guided count of one zone: every line is a counted quantity in the product's base unit.
    z.object({
      type: z.literal("countSheet"),
      zone: zones,
      lines: z
        .array(z.object({ product: idSchema, value: quantity }))
        .min(1)
        .max(1000),
    }),
    z.object({ type: z.literal("decide"), id: idSchema, decision: text(300) }),
    z.object({
      type: z.literal("aiNote"),
      id: idSchema,
      category: z.enum(replyCategories),
      status: z.enum(["agreement", "disagreement", "invalid"]),
      model: text(100),
    }),
    z.object({
      type: z.literal("recipe"),
      id: idSchema.optional(),
      // Without a finished product, create one named like the recipe (made in house, in kg).
      createProduct: z.boolean().default(false),
      ...recipeFields,
    }),
    z.object({ type: z.literal("deleteRecipe"), id: idSchema }),
    // Sale value per kilo of a recipe's gelato from a business day on (same day: replaces it).
    z.object({
      type: z.literal("setSaleValue"),
      recipe: idSchema,
      cents: cents.refine((n) => n > 0),
      from: documentDate,
    }),
    // Cost per kilo written by hand; without cents it is removed and the calculated one returns.
    z.object({
      type: z.literal("setManualCost"),
      recipe: idSchema,
      cents: cents.refine((n) => n > 0).optional(),
    }),
    z.object({
      type: z.literal("business"),
      name: text(80),
      place: z.string().trim().max(80).default(""),
    }),
    z.object({
      type: z.literal("purge"),
      before: at,
      keep: z.number().int().min(0).max(100000).default(50),
    }),
    z.object({
      type: z.literal("produce"),
      recipe: idSchema,
      quantity: quantity.refine((n) => n > 0),
      date: documentDate,
    }),
    z.object({
      type: z.literal("applyProduction"),
      id: idSchema,
      lines: z.array(z.object({ product: idSchema, quantity })).max(100),
      output: quantity.optional(),
      note: z.string().max(500).default(""),
    }),
    z.object({ type: z.literal("discardProduction"), id: idSchema }),
    z.object({
      type: z.literal("dailySales"),
      date: documentDate,
      lines: z
        .array(
          z.object({
            product: idSchema,
            // Either what was sold, or what is left in the tub (then sold = stock − waste − left).
            sold: quantity.optional(),
            remaining: quantity.optional(),
            waste: quantity.default(0),
            // Given away or eaten by the team: leaves the stock, but it is not a loss.
            gift: quantity.default(0),
            wasteReason: z
              .enum(["expiry", "texture", "display", "accident", "other"])
              .optional(),
          }),
        )
        .min(1)
        .max(500),
    }),
    z.object({ type: z.literal("undoDailySales"), date: documentDate }),
    // Confirm the close of a business day: its summary is frozen and the day stops accepting
    // changes until it is reopened with a reason.
    z.object({
      type: z.literal("confirmDay"),
      date: documentDate,
      realSaleCents: cents.optional(),
      changeHour: z.number().int().min(0).max(8).default(5),
    }),
    z.object({
      type: z.literal("reopenDay"),
      date: documentDate,
      reason: text(200),
    }),
    // Annul an applied production; with redo, a new proposal with the same data is left to fix.
    z.object({
      type: z.literal("voidProduction"),
      id: idSchema,
      reason: z.string().max(200).default(""),
      redo: z.boolean().default(false),
    }),
    // One line of a day close (a sale or a waste): remove it, or change its weight and reason.
    z.object({ type: z.literal("undoCloseLine"), id: idSchema }),
    z.object({
      type: z.literal("editCloseLine"),
      id: idSchema,
      quantity: quantity.refine((n) => n > 0),
      wasteReason: z
        .enum(["expiry", "texture", "display", "accident", "other"])
        .optional(),
    }),
    z.object({
      type: z.literal("photoType"),
      id: idSchema,
      docType: documentTypes.optional(),
    }),
    z.object({
      type: z.literal("organizePhoto"),
      id: idSchema,
      supplier: idSchema.optional(),
      documentDate,
    }),
    z.object({
      type: z.literal("photo"),
      ocrText: z.string().max(20000).optional(),
      supplier: idSchema.optional(),
      documentDate: documentDate.optional(),
      name: text(200),
      data: z.string().max(14_000_000),
      note: z.string().max(500).default(""),
      order: idSchema.optional(),
      source: z.enum(["photo", "whatsapp"]).default("photo"),
    }),
    z.object({
      type: z.literal("linkDocument"),
      id: idSchema,
      order: idSchema.optional(),
    }),
    z.object({ type: z.literal("applySuggestion"), id: idSchema }),
  ]),
);
export type Action = z.infer<typeof actionSchema>;
export function parseAction(input: unknown): Action {
  const r = actionSchema.safeParse(input);
  if (!r.success)
    throw Error(
      "Revisa los datos: " +
        r.error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .slice(0, 3)
          .join("; "),
    );
  return r.data;
}
