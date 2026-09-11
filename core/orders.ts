// Order follow-up: what needs a nudge today. Pure function over the full state.
import type { State } from "./schema";
import { localDate } from "./messages";

export type OrderReminder = {
  order: string;
  number: string;
  supplier: string;
  kind: "unsent" | "unanswered" | "overdue";
  days: number;
  text: string;
};
const DAY = 86400000;
export function orderReminders(s: State, at = Date.now()): OrderReminder[] {
  const today = localDate(new Date(at));
  const out: OrderReminder[] = [];
  const supplierName = (id: string) =>
    s.suppliers.find((x) => x.id === id)?.name ?? "";
  for (const o of s.orders) {
    if (["received", "cancelled"].includes(o.status)) continue;
    const name = supplierName(o.supplier);
    if (o.status === "pending") {
      const days = Math.floor((at - Date.parse(o.at)) / DAY);
      if (days >= 1)
        out.push({
          order: o.id,
          number: o.number,
          supplier: name,
          kind: "unsent",
          days,
          text: `${o.number} (${name}) lleva ${days} día${days === 1 ? "" : "s"} autorizado sin enviar.`,
        });
      continue;
    }
    if (o.expected && o.expected < today) {
      const days = Math.floor(
        (Date.parse(today + "T12:00:00") -
          Date.parse(o.expected + "T12:00:00")) /
          DAY,
      );
      out.push({
        order: o.id,
        number: o.number,
        supplier: name,
        kind: "overdue",
        days,
        text: `${o.number} (${name}) tenía entrega prevista hace ${days} día${days === 1 ? "" : "s"} y no se ha registrado.`,
      });
      continue;
    }
    if (o.dispatch && !o.confirmedAt) {
      const answered = s.messages.some((m) => m.order === o.id);
      const days = Math.floor((at - Date.parse(o.dispatch.at)) / DAY);
      if (!answered && days >= 1)
        out.push({
          order: o.id,
          number: o.number,
          supplier: name,
          kind: "unanswered",
          days,
          text: `${o.number} (${name}) se envió hace ${days} día${days === 1 ? "" : "s"} y no hay respuesta.`,
        });
    }
  }
  return out;
}
// Order text from a template with placeholders; the default is the historical wording.
export const defaultOrderTemplate =
  "Hola, pedido {numero} de {negocio}:\n{lineas}\n¿Nos confirmas disponibilidad y fecha de entrega? Gracias.";
export function renderOrderTemplate(
  template: string,
  values: {
    numero: string;
    negocio: string;
    lineas: string;
    proveedor: string;
  },
): string {
  const t =
    template && template.includes("{lineas}") ? template : defaultOrderTemplate;
  return t
    .replaceAll("{numero}", values.numero)
    .replaceAll("{negocio}", values.negocio)
    .replaceAll("{proveedor}", values.proveedor)
    .replaceAll("{lineas}", values.lineas)
    .trim();
}
