// Vista de Mensajes: bandeja por conversación, lectura por reglas, responder y decidir.
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
function replyBlock(m) {
  const i = m.interpretation;
  const ai = m.aiReading;
  const order = m.order && state.orders.find((o) => o.id === m.order);
  const reading = i
    ? `<div class="understood-row"><span>Lectura</span><div><strong>${esc(replyLabel[i.category])}${i.needsReading && !m.reviewed ? " " + pill("Debes leer", "peach") : ""}${i.learned ? " " + pill("Aprendido de ti", "sage") : i.corrected ? " " + pill("Corregido por ti", "sage") : ""}</strong><p>${esc(i.summary)}</p>${i.deliveryDate ? `<p><strong>Entrega indicada:</strong> ${date(i.deliveryDate + "T12:00:00Z")}${i.deliveryHint ? " («" + esc(i.deliveryHint) + "»)" : ""}</p>` : i.deliveryHint ? `<p><strong>Plazo indicado:</strong> ${esc(i.deliveryHint)}</p>` : ""}${i.missing ? `<p><strong>Producto que falta:</strong> ${esc(i.missing)}</p>` : ""}</div></div>`
    : "";
  const second = ai
    ? `<div class="understood-row"><span>IA local</span><div><p>${esc(replyLabel[ai.category])} · ${ai.status === "agreement" ? "dos lecturas coincidentes" : ai.status === "disagreement" ? "las lecturas discrepan: revisa tú" : "sin lectura válida"} · ${time(ai.at)}${ai.status === "agreement" && i && ai.category !== i.category ? " · No coincide con las reglas: decide leyendo el original." : ""}</p></div></div>`
    : "";
  return `<div class="reply-reading understood"><div class="message-label">LO QUE ENTENDIÓ LA APP · POR REGLAS</div>${reading}<div class="understood-row"><span>Prioridad</span><div><strong>${esc(priorityLabel[m.priority])}</strong>${i && m.reason.includes(i.summary) ? "" : `<p>${esc(m.reason)}</p>`}</div></div><div class="understood-row"><span>Pedido</span><div><strong>${order ? esc(order.number) + (order.expected ? " · entrega prevista " + date(order.expected + "T12:00:00Z") : "") : esc(relevanceLabel[m.relevance])}</strong><p>${order ? "" : "Sin pedido vinculado. "}${esc(m.relevanceReason)} Nada de esto cambia compras ni stock.</p></div></div>${second}</div>`;
}
// Shared by the list and by «Abrir»: does the current filter show this message?
function messageMatches(x) {
  const fold = (v) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  return (
    (messageSupplier === "all" || x.supplier === messageSupplier) &&
    (messageFilter === "all" ||
      (messageFilter === "unread" && !x.read) ||
      (messageFilter === "pending" && !x.reviewed) ||
      (messageFilter === "important" &&
        x.priority === "important" &&
        !x.reviewed) ||
      (messageFilter === "relevant" && x.relevance === "relevant") ||
      (messageFilter === "toread" &&
        x.interpretation?.needsReading &&
        !x.reviewed)) &&
    fold(x.text + " " + supplier(x.supplier).name).includes(fold(messageQuery))
  );
}
// Botones de respuesta rápida. El texto de origen es este; la persona puede cambiar el suyo en
// Configuración (replyTemplates) y {fecha} se sustituye por la fecha que dijo el proveedor.
const replyDefaults = [
  {
    id: "gracias",
    cats: ["delivery_date", "confirmation"],
    label: "Vale, gracias",
    text: "Vale, gracias. Quedamos así.",
  },
  {
    id: "fecha",
    cats: ["delivery_date"],
    needsDate: true,
    label: "De acuerdo con la fecha",
    text: "De acuerdo, esperamos la entrega {fecha}. Gracias.",
  },
  {
    id: "loquetengas",
    cats: ["out_of_stock", "change"],
    label: "Mándanos lo que tengas",
    text: "Mándanos lo que tengas disponible y avísanos del resto. Gracias.",
  },
  {
    id: "otrolado",
    cats: ["out_of_stock", "change"],
    label: "Lo compramos por otro lado",
    text: "Gracias, esta vez lo resolvemos por otro lado. Deja fuera lo que falte.",
  },
  {
    id: "si",
    cats: ["question"],
    label: "Sí, confirmado",
    text: "Sí, confirmado. Gracias.",
  },
  {
    id: "no",
    cats: ["question"],
    label: "No, mejor no",
    text: "No, mejor no. Gracias por preguntar.",
  },
  {
    id: "entendido",
    cats: ["cancellation"],
    label: "Entendido",
    text: "Entendido, gracias por avisar.",
  },
  {
    id: "llamo",
    cats: null,
    label: "Te llamo",
    text: "Te llamo en un momento para concretarlo.",
  },
];
const quickReplies = (m) => {
  const i = m.interpretation || {};
  const when = i.deliveryDate
    ? date(i.deliveryDate + "T12:00:00Z")
    : i.deliveryHint || "";
  return replyDefaults
    .filter(
      (r) =>
        (!r.cats || r.cats.includes(i.category)) && (!r.needsDate || !!when),
    )
    .map((r) => [
      r.label,
      (replyTemplates[r.id] || r.text).replaceAll("{fecha}", when),
    ])
    .slice(0, 4);
};
function messages() {
  const list = state.messages.filter(messageMatches);
  const m = list.find((x) => x.id === selectedMessage) || list[0];
  // Conversations: one group per supplier, newest activity first.
  const groups = [];
  for (const x of list) {
    let g = groups.find((y) => y.supplier === x.supplier);
    if (!g) {
      g = { supplier: x.supplier, items: [], unread: 0 };
      groups.push(g);
    }
    g.items.push(x);
    if (!x.read) g.unread++;
  }
  const pending = state.messages.filter(
    (x) => x.interpretation?.needsReading && !x.reviewed,
  );
  const todo = pending.slice(0, 3);
  const order = m?.order && state.orders.find((o) => o.id === m.order);
  const canReply =
    m &&
    m.channel === "whatsapp" &&
    !!m.sender &&
    waState?.status === "connected";
  return (
    header(
      "Mensajes que se convierten en acciones.",
      "Cada respuesta de tus proveedores, leída y ordenada por conversación. Tú decides qué hacer con cada una.",
      btn(icon("plus") + " Simular mensaje", "message", "secondary"),
    ) +
    `<section class="panel todo-panel"><div class="panel-heading"><div><h2>Qué hacer ahora</h2><p>${pending.length ? `${pending.length} mensaje${pending.length === 1 ? "" : "s"} que debes leer y decidir.` : "Nada pendiente de leer. Las confirmaciones y fechas quedan anotadas solas."}</p></div>${pending.length ? btn("Ver todos", "messagesToRead", "secondary") : ""}</div>${todo.map((x) => `<button class="todo-row" data-open-message="${x.id}"><span class="supplier-avatar ${supplier(x.supplier).color}">${esc(supplier(x.supplier).initials)}</span><div><strong>${esc(supplier(x.supplier).name)} · ${esc(replyLabel[x.interpretation.category])}</strong><p>${esc(x.interpretation.summary)}</p></div><span class="text-link">Abrir ${icon("arrow")}</span></button>`).join("")}</section><div class="message-filters"><label class="field">Buscar mensajes<input id="message-search" type="search" value="${esc(messageQuery)}" placeholder="Texto o proveedor"></label><label class="field">Proveedor<select id="message-supplier"><option value="all">Todos los proveedores</option>${state.suppliers.map((s) => `<option value="${s.id}" ${messageSupplier === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label><label class="field">Mostrar<select id="message-filter">${Object.entries(
      {
        all: "Todos los mensajes",
        toread: "Debes leer",
        unread: "Sin leer",
        pending: "Sin decidir",
        important: "Importantes pendientes",
        relevant: "Relacionados con pedidos",
      },
    )
      .map(
        ([v, l]) =>
          `<option value="${v}" ${messageFilter === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label></div><section class="inbox-layout"><div class="conversation-list"><div class="conversation-heading">Conversaciones <span>${list.length} de ${state.messages.length}</span></div>${groups.map((g) => `<div class="conversation-group"><div class="conversation-group-title"><strong>${esc(supplier(g.supplier).name)}</strong><small>${g.items.length} mensaje${g.items.length === 1 ? "" : "s"}${g.unread ? " · " + g.unread + " sin leer" : ""}</small></div>${g.items.map((x) => `<button class="conversation ${m?.id === x.id ? "selected" : ""}" data-open-message="${x.id}"><span class="supplier-avatar ${supplier(x.supplier).color}">${esc(supplier(x.supplier).initials)}</span><div><div class="conversation-title"><strong>${esc(x.interpretation ? replyLabel[x.interpretation.category] : priorityLabel[x.priority])}</strong><small>${date(x.at)} ${time(x.at)}</small></div><p>${esc(x.text)}</p><span class="mini-status">${x.reviewed ? (x.decision ? "Decidido" : "Revisado") : priorityLabel[x.priority]} · ${relevanceLabel[x.relevance]}${x.interpretation?.needsReading && !x.reviewed ? " · Leer" : ""}</span></div>${!x.read ? '<i class="unread-dot"></i>' : ""}</button>`).join("")}</div>`).join("") || '<div class="empty compact"><h3>No hay mensajes que coincidan con estos filtros.</h3><p>Cambia el filtro «Mostrar», elige otro proveedor o borra la búsqueda.</p></div>'}</div><div class="message-detail">${
      m
        ? `<div class="detail-heading"><span class="supplier-avatar ${supplier(m.supplier).color}">${esc(supplier(m.supplier).initials)}</span><div><h2>${esc(supplier(m.supplier).name)}</h2><p>${m.channel === "whatsapp" ? "WhatsApp · " + esc(m.sender || "") : "Mensaje de demostración"} · ${date(m.at)}, ${time(m.at)}</p></div>${pill(m.reviewed ? (m.decision ? "Decidido" : "Revisado") : priorityLabel[m.priority], m.reviewed ? "sage" : m.priority === "important" ? "peach" : "lavender")}</div><div class="message-body"><div class="message-label">MENSAJE ORIGINAL</div><div class="message-bubble">${esc(m.text)}</div>${m.decision ? `<div class="decision-box"><div class="message-label">TU DECISIÓN</div><p>${esc(m.decision)}</p><small>${m.decidedAt ? date(m.decidedAt) + " " + time(m.decidedAt) : ""}</small></div>` : ""}${replyBlock(m)}${orderActions(m, order)}<div class="decide-block"><div class="message-label">RESPONDER Y DECIDIR</div>${
            canReply
              ? `<div class="quick-replies">${quickReplies(m)
                  .map(([label, text]) =>
                    btn(
                      label,
                      "fillReply",
                      "secondary",
                      `data-text="${esc(text)}"`,
                    ),
                  )
                  .join(
                    "",
                  )}</div><div class="reply-composer"><textarea id="reply-text" rows="3" maxlength="4000" placeholder="Escribe tu respuesta a ${esc(supplier(m.supplier).name)}…">${esc(replyDrafts[m.id] || "")}</textarea><div class="composer-row"><small>Se envía a ${esc(m.sender || "")} desde tu cuenta, una sola vez, al pulsar Enviar.</small>${btn(icon("message") + " Enviar por WhatsApp", "sendReply", "primary", `data-id="${esc(m.id)}"`)}</div></div>`
              : `<p class="muted">${m.channel === "whatsapp" ? "Conecta WhatsApp para responder desde aquí." : "Los mensajes de demostración no se responden; decide y cierra."}</p>`
          }<div class="message-actions">${btn(m.reviewed ? "Cambiar decisión" : icon("check") + " Decidir y cerrar", "decideMessage", "primary", `data-id="${esc(m.id)}"`)}${btn(m.reviewed ? "Mensaje revisado" : "Marcar revisado", "review", "secondary", `data-id="${m.id}" ${m.reviewed ? "disabled" : ""}`)}${btn("Vincular pedido", "link", "secondary", `data-id="${m.id}"`)}</div></div><details class="more-actions"><summary>Más opciones</summary><div class="message-actions">${btn(aiReplyBusy === m.id ? "Leyendo la respuesta…" : "Segunda lectura con IA local", "aiReadReply", "secondary", `data-id="${esc(m.id)}" ${aiReplyBusy ? "disabled" : ""}`)}${btn("Abrir en IA local", "aiMessage", "secondary", `data-id="${esc(m.id)}"`)}${btn("Corregir lectura", "correctReading", "secondary", `data-id="${esc(m.id)}"`)}${btn("Cambiar prioridad", "priority", "secondary", `data-id="${m.id}"`)}${btn("Corregir relevancia", "relevance", "secondary", `data-id="${m.id}"`)}</div></details><p class="fineprint">La app aprende a leer mensajes parecidos; nunca aprende decisiones. Lo que decides queda anotado aquí y no cambia pedidos ni stock.</p></div>`
        : '<div class="empty"><h3>Elige una conversación.</h3><p>Aquí verás el mensaje, su lectura por reglas y las opciones para responder y decidir.</p></div>'
    }</div></section>`
  );
}

// Actions the reading makes obvious for the linked order. Each one is a click by the person.
function orderActions(m, order) {
  if (!order || ["received", "cancelled"].includes(order.status)) return "";
  const i = m.interpretation || {};
  const fold = (v) =>
    String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const buttons = [];
  if (i.deliveryDate && order.expected !== i.deliveryDate)
    buttons.push(
      btn(
        `Fijar entrega el ${date(i.deliveryDate + "T12:00:00Z")}`,
        "setExpectedFromMessage",
        "secondary",
        `data-order="${esc(order.id)}" data-date="${esc(i.deliveryDate)}"`,
      ),
    );
  if (
    (i.category === "confirmation" || i.category === "delivery_date") &&
    !order.confirmedAt &&
    ["sent", "partial"].includes(order.status)
  )
    buttons.push(
      btn(
        "Marcar confirmado",
        "confirmOrder",
        "secondary",
        `data-order="${esc(order.id)}"`,
      ),
    );
  if (i.category === "out_of_stock" && i.missing) {
    const hit = order.lines
      .map((l) => product(l.product))
      .find(
        (p) =>
          fold(p.name).includes(fold(i.missing)) ||
          fold(i.missing).includes(fold(p.name).split(" ")[0]),
      );
    if (hit && order.lines.length > 1)
      buttons.push(
        btn(
          `Quitar ${esc(hit.name)} del pedido`,
          "removeLine",
          "secondary",
          `data-order="${esc(order.id)}" data-product="${esc(hit.id)}"`,
        ),
      );
    // Otros proveedores donde él compra ese mismo producto. Solo los que apuntó: la app no elige.
    if (hit) {
      const packs = order.lines.find((l) => l.product === hit.id)?.packs || 1;
      for (const x of hit.alternates || [])
        buttons.push(
          btn(
            `Comprarlo a ${esc(supplier(x.supplier).name)}${x.price ? " · " + money(packs * x.price) : ""}`,
            "buyElsewhere",
            "secondary",
            `data-product="${esc(hit.id)}" data-supplier="${esc(x.supplier)}" data-packs="${packs}"`,
          ),
        );
      if (!(hit.alternates || []).length)
        buttons.push(
          btn(
            `Apuntar otro proveedor de ${esc(hit.name)}`,
            "altSuppliers",
            "secondary",
            `data-product="${esc(hit.id)}"`,
          ),
        );
    }
  }
  if (i.category === "cancellation" && order.status === "pending")
    buttons.push(
      btn(
        "Cancelar pedido",
        "cancelOrder",
        "danger",
        `data-order="${esc(order.id)}"`,
      ),
    );
  buttons.push(
    btn(
      "Ver pedido",
      "gotoOrder",
      "secondary",
      `data-order="${esc(order.id)}"`,
    ),
  );
  return `<div class="order-actions"><div class="message-label">PEDIDO ${esc(order.number)} · ${esc(supplier(order.supplier).name)}</div><p class="muted">${order.confirmedAt ? "Confirmado el " + date(order.confirmedAt) + ". " : ""}${order.expected ? "Entrega prevista " + date(order.expected + "T12:00:00Z") + ". " : "Sin fecha de entrega. "}Lo que hagas aquí cambia el pedido, no el stock.</p><div class="message-actions">${buttons.join("")}</div></div>`;
}
