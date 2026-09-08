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
export const productFields = {
  name: text(100),
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
      "Usá el teléfono con prefijo internacional, por ejemplo +34.",
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
const orderSchema = z.object({
  id: idSchema,
  number: z.string().regex(/^GS-\d+$/),
  supplier: idSchema,
  status: z.enum(["pending", "sent", "partial", "received", "cancelled"]),
  at,
  simulated: z.literal(true),
  lines: z.array(lineSchema).min(1).max(10000),
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
  simulated: z.literal(true),
  order: idSchema.optional(),
  interpretation: z
    .object({
      category: z.enum(replyCategories),
      needsReading: z.boolean(),
      deliveryDate: documentDate.optional(),
      deliveryHint: text(100).optional(),
      missing: text(120).optional(),
      summary: text(300),
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
export const recipeFields = {
  name: text(100),
  product: idSchema.optional(),
  yield: quantity.refine((n) => n > 0),
  ingredients: z.array(ingredientSchema).min(1).max(100),
  note: z.string().max(500).default(""),
};
const recipeSchema = z.object({ id: idSchema, ...recipeFields });
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
});
const photoSchema = z
  .object({
    id: idSchema,
    name: text(200),
    ocrText: z.string().max(20000).optional(),
    supplier: idSchema.optional(),
    documentDate: documentDate.optional(),
    note: z.string().max(500),
    at,
    data: z
      .string()
      .max(8_000_000)
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
      .optional(),
    file: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    mime: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
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
export const stateSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().min(0),
  business: text(80),
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
});
export type State = z.infer<typeof stateSchema>;
export type Product = z.infer<typeof productSchema>;
export type Movement = z.infer<typeof movementSchema>;
export type Photo = State["photos"][number];
export type Message = State["messages"][number];
export type Recipe = State["recipes"][number];
export type Production = State["productions"][number];
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
    z.object({ type: z.literal("send"), order: idSchema }),
    z.object({ type: z.literal("cancel"), order: idSchema }),
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
      type: z.literal("aiNote"),
      id: idSchema,
      category: z.enum(replyCategories),
      status: z.enum(["agreement", "disagreement", "invalid"]),
      model: text(100),
    }),
    z.object({
      type: z.literal("recipe"),
      id: idSchema.optional(),
      ...recipeFields,
    }),
    z.object({ type: z.literal("deleteRecipe"), id: idSchema }),
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
      data: z.string().max(8_000_000),
      note: z.string().max(500).default(""),
    }),
  ]),
);
export type Action = z.infer<typeof actionSchema>;
export function parseAction(input: unknown): Action {
  const r = actionSchema.safeParse(input);
  if (!r.success)
    throw Error(
      "Revisá los datos: " +
        r.error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .slice(0, 3)
          .join("; "),
    );
  return r.data;
}
