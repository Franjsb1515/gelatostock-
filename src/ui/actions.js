// Acciones principales disparadas por botones (data-action).
// Los módulos de src/ui comparten el ámbito global y se cargan en orden desde index.html.
async function action(name, el) {
  if (name === "aiOpen") {
    nav("ai");
    return;
  }
  if (name === "aiPhoto" || name === "aiMessage" || name === "aiWhatsApp") {
    if (aiBusy) {
      toast("Espera o detén la lectura actual desde IA local.");
      return;
    }
    aiSourcePhoto = name === "aiPhoto" ? el.dataset.id : "";
    aiDraft =
      name === "aiPhoto"
        ? state.photos.find((x) => x.id === el.dataset.id)?.ocrText || ""
        : name === "aiMessage"
          ? state.messages.find((x) => x.id === el.dataset.id)?.text || ""
          : waState?.messages.find((x) => String(x.id) === el.dataset.id)
              ?.text || "";
    aiResult = null;
    aiError = "";
    nav("ai");
    return;
  }
  if (name === "aiAnalyze") {
    if (aiBusy) return;
    aiDraft = $("#ai-text").value;
    aiBusy = true;
    aiResult = null;
    aiError = "";
    render();
    try {
      aiResult = await request("/api/ai", { text: aiDraft, mode: aiMode });
    } catch (e) {
      aiError = e.message;
    } finally {
      aiBusy = false;
      if (page === "ai") render();
      else toast("La lectura de IA ha terminado. Consulta IA local.");
    }
    return;
  }
  if (name === "orderWhatsApp") {
    const o = state.orders.find((x) => x.id === el.dataset.order);
    let preview;
    try {
      preview = await request("/api/whatsapp", {
        type: "preview",
        order: o.id,
      });
    } catch (e) {
      toast(e.message);
      return;
    }
    const blocked = !preview.connected
      ? "WhatsApp no está conectado. Conecta por QR en la pantalla WhatsApp."
      : !preview.authorized
        ? "Este número no está autorizado para la cuenta conectada. Autorízalo en WhatsApp → Autorizar chat."
        : "";
    modal(
      "Enviar " + o.number + " por WhatsApp",
      "Se envía exactamente este texto, una sola vez, al número de la ficha del proveedor.",
      `<p><strong>Para:</strong> ${esc(preview.label)} · ${esc(preview.to)}</p><label class="field">Mensaje que se enviará<textarea class="ai-editor" readonly>${esc(preview.text)}</textarea></label>${blocked ? `<p role="alert">${esc(blocked)}</p>` : '<p class="fineprint">Enviar no cambia el stock ni da por confirmado el pedido: la respuesta del proveedor llegará a la pantalla WhatsApp.</p>'}`,
      async () => {
        if (blocked) return false;
        const data = await request("/api/whatsapp", {
          type: "send",
          order: o.id,
          text: preview.text,
        });
        state = data.state;
        render();
        toast("Pedido enviado por WhatsApp a " + data.sent.recipient + ".");
        return true;
      },
      blocked ? "Cerrar" : "Enviar ahora",
    );
    return;
  }
  if (name === "aiSavePhotoType") {
    const photo = state.photos.find((p) => p.id === aiSourcePhoto);
    if (!photo || !aiResult || aiResult.invalid) return;
    const docType = aiResult.proposedType || aiResult.tipo;
    await mutate(
      { type: "photoType", id: photo.id, docType },
      "Tipo guardado en la foto. Es tu confirmación, no la de la IA.",
    );
    return;
  }
  if (name === "aiChatSend") {
    if (aiBusy) return;
    const question = $("#ai-chat-input").value.trim();
    if (!question) return;
    aiChatUseDoc = $("#ai-chat-doc").checked;
    aiDraft = $("#ai-text")?.value ?? aiDraft;
    aiChat.push({ role: "user", content: question });
    aiBusy = true;
    aiChatError = "";
    render();
    try {
      const r = await request("/api/ai/chat", {
        messages: aiChat
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content })),
        ...(aiChatUseDoc && aiDraft.trim() ? { document: aiDraft } : {}),
      });
      aiChat.push({
        role: "assistant",
        content: r.answer,
        excerpt: r.excerpt || "",
      });
    } catch (e) {
      aiChatError = e.message;
      aiChat.pop();
    } finally {
      aiBusy = false;
      if (page === "ai") render();
      else toast("La IA local ha respondido. Consulta IA local.");
    }
    return;
  }
  if (name === "aiChatClear") {
    aiChat = [];
    aiChatError = "";
    render();
    return;
  }
  if (name === "recipeEditor") {
    const r = el.dataset.id
      ? state.recipes.find((x) => x.id === el.dataset.id)
      : {
          name: "",
          family: "crema",
          product: "",
          yield: 1,
          ingredients: [],
          steps: "",
          allergens: "",
          note: "",
        };
    modal(
      r.id ? "Editar receta" : "Nueva receta",
      "Indica cuánto rinde la receta y cuánto usa de cada ingrediente para esa cantidad. Elaboración y alérgenos son texto para el recetario.",
      field(
        "Nombre de la receta",
        "name",
        r.name,
        "text",
        'required maxlength="100"',
      ) +
        select(
          "Familia",
          "family",
          Object.entries(familyLabel),
          r.family || "crema",
        ) +
        select(
          "Producto terminado (en kg)",
          "product",
          [
            ["", "Sin producto terminado"],
            ...state.products
              .filter((p) => p.unit === "kg")
              .map((p) => [p.id, p.name]),
          ],
          r.product || "",
        ) +
        field(
          "Rinde (kg de gelato)",
          "yield",
          r.yield,
          "number",
          'min="0.001" max="1000000" step="0.001" required',
        ) +
        `<div class="field"><span>Ingredientes para esa cantidad</span><div id="ingredient-rows">${(r.ingredients.length ? r.ingredients : [{ product: "", quantity: "" }]).map((i) => ingredientRow(i.product, i.quantity)).join("")}</div>${btn(icon("plus") + " Añadir ingrediente", "addIngredient", "secondary")}</div>` +
        `<label class="field">Elaboración (pasos, temperaturas, tiempos)<textarea name="steps" maxlength="3000" rows="5">${esc(r.steps || "")}</textarea></label>` +
        field(
          "Alérgenos",
          "allergens",
          r.allergens || "",
          "text",
          'maxlength="300" placeholder="Leche, huevo, frutos secos…"',
        ) +
        `<label class="field">Nota<textarea name="note" maxlength="500">${esc(r.note || "")}</textarea></label>`,
      async (f) => {
        const products = f.getAll("ing-product"),
          quantities = f.getAll("ing-qty");
        const ingredients = products
          .map((p, i) => ({ product: p, quantity: Number(quantities[i]) }))
          .filter((i) => i.product);
        return mutate(
          {
            type: "recipe",
            ...(r.id ? { id: r.id } : {}),
            name: f.get("name"),
            family: f.get("family") || "crema",
            ...(f.get("product") ? { product: f.get("product") } : {}),
            yield: Number(f.get("yield")),
            ingredients,
            steps: f.get("steps") || "",
            allergens: f.get("allergens") || "",
            note: f.get("note") || "",
          },
          "Receta guardada.",
        );
      },
    );
    return;
  }
  if (name === "addIngredient") {
    $("#ingredient-rows")?.insertAdjacentHTML("beforeend", ingredientRow());
    return;
  }
  if (name === "removeIngredient") {
    const rows = $("#ingredient-rows");
    if (rows && rows.children.length > 1)
      el.closest(".ingredient-row").remove();
    return;
  }
  if (name === "openRecipes") {
    nav("recipes");
    return;
  }
  if (name === "duplicateRecipe") {
    const r = state.recipes.find((x) => x.id === el.dataset.id);
    const { id, ...fields } = r;
    await mutate(
      { type: "recipe", ...fields, name: (r.name + " (copia)").slice(0, 100) },
      "Receta duplicada. Edítala para ajustarla.",
    );
    return;
  }
  if (name === "deleteRecipe") {
    const r = state.recipes.find((x) => x.id === el.dataset.id);
    modal(
      "Eliminar receta",
      "Solo se puede eliminar si no tiene producciones aprobadas.",
      `<p>${esc(r.name)}</p>`,
      async () =>
        mutate({ type: "deleteRecipe", id: r.id }, "Receta eliminada."),
      "Eliminar",
    );
    return;
  }
  if (name === "produce") {
    if (!state.recipes.length) {
      toast("Crea primero una receta.");
      return;
    }
    const today = todayLocal();
    modal(
      "Registrar producción",
      "La app calcula el consumo por receta. Nada cambia hasta que apruebes la propuesta.",
      select(
        "Receta",
        "recipe",
        state.recipes.map((r) => [r.id, r.name]),
        el.dataset.recipe || state.recipes[0].id,
      ) +
        stepperField(
          "Kilos producidos",
          "quantity",
          1,
          'min="0.001" max="1000000" step="0.001" required',
          "0.5",
        ) +
        field("Día de producción", "date", today, "date", "required"),
      async (f) => {
        const ok = await mutate(
          {
            type: "produce",
            recipe: f.get("recipe"),
            quantity: Number(f.get("quantity")),
            date: f.get("date"),
          },
          "Consumo estimado listo para revisar.",
        );
        if (ok) nav("production");
        return ok;
      },
      "Calcular consumo",
    );
    return;
  }
  if (name === "applyProduction") {
    const card = el.closest("[data-production]");
    const lines = [...card.querySelectorAll("[data-prod-line]")].map((i) => ({
      product: i.dataset.prodLine,
      quantity: Number(i.value),
    }));
    const output = card.querySelector("[data-prod-output]");
    await mutate(
      {
        type: "applyProduction",
        id: el.dataset.id,
        lines,
        ...(output ? { output: Number(output.value) } : {}),
        note: card.querySelector("[data-prod-note]")?.value || "",
      },
      "Producción aprobada: ingredientes descontados.",
    );
    return;
  }
  if (name === "dailySales") {
    const panel = el.closest("[data-sales]");
    const lines = [...panel.querySelectorAll("[data-sold]")]
      .map((i) => ({
        product: i.dataset.sold,
        sold: Number(i.value) || 0,
        waste:
          Number(
            panel.querySelector(`[data-waste="${i.dataset.sold}"]`)?.value,
          ) || 0,
      }))
      .filter((l) => l.sold || l.waste);
    if (!lines.length) {
      toast("Indica al menos una cantidad vendida o de merma.");
      return;
    }
    await mutate(
      {
        type: "dailySales",
        date: panel.querySelector("[data-sales-date]").value,
        lines,
      },
      "Ventas y mermas registradas.",
    );
    return;
  }
  if (name === "discardProduction") {
    await mutate(
      { type: "discardProduction", id: el.dataset.id },
      "Producción descartada sin cambios.",
    );
    return;
  }
  if (name === "correctReading") {
    const m = state.messages.find((x) => x.id === el.dataset.id);
    modal(
      "Corregir la lectura del mensaje",
      "Elige lo que el proveedor quiso decir. La app lo recordará para mensajes iguales o casi iguales. Esto solo cambia cómo se lee el mensaje: lo que decidas hacer se elige cada vez.",
      select(
        "Lectura correcta",
        "category",
        Object.entries(replyLabel),
        m.interpretation?.category || "other",
      ) +
        `<label class="check"><input type="checkbox" name="remember" checked> Recordar esta frase para el futuro</label>`,
      async (f) =>
        mutate(
          {
            type: "correctReading",
            id: m.id,
            category: f.get("category"),
            remember: f.get("remember") === "on",
          },
          "Lectura corregida.",
        ),
    );
    return;
  }
  if (name === "forgetLearned") {
    await mutate(
      { type: "forgetLearned", id: el.dataset.id },
      "Frase olvidada.",
    );
    return;
  }
  if (name === "aiReadReply") {
    if (aiBusy || aiReplyBusy) return;
    aiReplyBusy = el.dataset.id;
    render();
    try {
      const data = await request("/api/ai/message", { id: el.dataset.id });
      state = data.state;
      toast(
        data.reading.status === "agreement"
          ? "Segunda lectura anotada: " +
              replyLabel[data.reading.category] +
              ". Solo es una propuesta."
          : "La IA no dio una lectura consistente; se anota como sin interpretar.",
      );
    } catch (e) {
      toast(e.message);
    } finally {
      aiReplyBusy = "";
      render();
    }
    return;
  }
  if (name === "aiCancel") {
    try {
      await request("/api/ai/cancel", {});
    } catch (e) {
      toast(e.message);
    }
    return;
  }

  if (name === "orderFilter") {
    orderFilter = el.dataset.filter;
    render();
    return;
  }
  if (name.startsWith("wa")) {
    await whatsappAction(name, el);
    return;
  }
  if (await extendedAction(name, el)) return;
  if (name === "close") {
    $("#modal").close();
    return;
  }
  if (name === "count") {
    count();
    return;
  }
  if (name === "photo") {
    photo();
    return;
  }
  if (name === "suggest") {
    if (await mutate({ type: "suggest" }, "Reposición añadida al carrito."))
      nav("orders");
    return;
  }
  if (name === "webList") {
    const s = supplier(el.dataset.supplier);
    const lines = state.cart
      .map((l) => ({ l, p: product(l.product) }))
      .filter(({ p }) => p.supplier === s.id)
      .map(({ l, p }) => `${l.packs} × ${p.name} (${num(p.pack)} ${p.unit})`);
    const text =
      `Lista de compra · ${s.name} · ${new Date().toLocaleDateString("es-ES")}\n` +
      lines.join("\n");
    modal(
      "Lista para comprar en " + s.name,
      "Copia la lista y compra en la web con tu cuenta. La app no entra en la web ni paga: cuando llegue, registra la entrega en Control de entregas.",
      `<label class="field">Lista<textarea name="list" readonly rows="${Math.min(12, lines.length + 2)}">${esc(text)}</textarea></label><div class="setting-actions">${btn("Copiar lista", "copyList", "secondary")}<a class="btn secondary" href="${esc(s.web)}" target="_blank" rel="noopener noreferrer">Abrir web de ${esc(s.name)}</a></div>`,
      async () => true,
      "Cerrar",
    );
    return;
  }
  if (name === "copyList") {
    const t = $("#modal-form textarea[name=list]");
    t.focus();
    t.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    toast(
      ok
        ? "Lista copiada. Pégala en la web o en un mensaje."
        : "Selecciona el texto y cópialo con Ctrl+C.",
    );
    return;
  }
  if (name === "addcart") {
    modal(
      "Añadir al carrito",
      "Elige el producto y la cantidad de paquetes.",
      select(
        "Producto",
        "product",
        state.products.map((p) => [
          p.id,
          `${p.name} · ${p.pack} ${p.unit}/paquete`,
        ]),
      ) +
        stepperField(
          "Paquetes",
          "packs",
          1,
          'min="1" max="10000" step="1" required',
        ),
      async (f) =>
        mutate(
          {
            type: "cart",
            product: f.get("product"),
            packs: Number(f.get("packs")),
          },
          "Carrito actualizado.",
        ),
    );
    return;
  }
  if (name === "product") {
    modal(
      "Nuevo producto",
      "Definí su unidad base y cómo lo comprás.",
      `<div class="form-grid">${field("Nombre", "name", "", "text", 'required maxlength="100"')}${field("Presentación / detalle", "detail", "", "text", 'maxlength="200"')}${select("Zona de conteo", "zone", Object.entries(zoneLabel), "almacen")}${select(
        "Categoría",
        "category",
        ["Gelatería", "Cafetería", "Postres", "Envases"].map((x) => [x, x]),
      )}${select("Unidad base", "unit", [
        ["kg", "Kilogramos"],
        ["L", "Litros"],
        ["ud", "Unidades"],
      ])}${field("Stock actual", "stock", 0, "number", 'min="0" max="1000000" step="0.001" required')}${field("Stock mínimo", "min", 0, "number", 'min="0" max="1000000" step="0.001" required')}${field("Stock objetivo", "target", 1, "number", 'min="0" max="1000000" step="0.001" required')}${field("Unidades base por paquete", "pack", 1, "number", 'min="0.001" max="1000000" step="0.001" required')}${field("Precio estimado por paquete (€)", "price", 0, "number", 'min="0" max="1000000" step="0.01" required')}${select(
        "Proveedor de demostración",
        "supplier",
        state.suppliers.map((s) => [s.id, s.name]),
      )}</div>`,
      async (f) => {
        const a = Object.fromEntries(f);
        for (const k of ["stock", "min", "target", "pack"]) a[k] = Number(a[k]);
        a.price = Math.round(Number(a.price) * 100);
        return mutate({ type: "product", ...a }, "Producto creado.");
      },
    );
    return;
  }
  if (name === "checkout") {
    const revision = state.revision;
    modal(
      "Autorizar pedidos de demostración",
      "No se enviará ningún mensaje ni se realizará ningún pago.",
      `<p>Se crearán ${new Set(state.cart.map((l) => product(l.product).supplier)).size} pedidos pendientes de envío.</p><div class="review-total">Total estimado <strong>${money(state.cart.reduce((n, l) => n + l.packs * product(l.product).price, 0))}</strong></div><p class="fineprint">Envío e impuestos por confirmar. En el siguiente paso podrás simular el envío.</p>`,
      async () =>
        mutate(
          { type: "authorize", revision },
          "Pedidos de demostración creados.",
        ),
      "Autorizar demostración",
    );
    return;
  }
  if (name === "send") {
    await mutate(
      { type: "send", order: el.dataset.order },
      "Envío simulado. No se contactó al proveedor.",
    );
    return;
  }
  if (name === "receive") {
    const o = state.orders.find((o) => o.id === el.dataset.order);
    modal(
      "Qué llegó · " + o.number,
      "Escribe las cantidades de esta entrega en kg, L o unidades, no el número de cajas. Se sumarán al stock al guardar. Deja 0 si no llegó ese producto.",
      o.lines
        .map((l) => {
          const p = product(l.product);
          const rem = Math.round((l.packs * l.pack - l.received) * 1000) / 1000;
          // − / + add or remove one presentation (box, bottle…) in base units.
          return stepperField(
            `${p.name} · recibidos ${num(l.received)} de ${num(l.packs * l.pack)} ${p.unit} · faltan ${num(rem)} ${p.unit}`,
            l.product,
            0,
            `min="0" max="${rem}" step="0.001" required`,
            String(Math.min(l.pack, rem)),
          );
        })
        .join(""),
      async (f) =>
        mutate(
          {
            type: "receive",
            order: o.id,
            lines: [...f].map(([product, value]) => ({
              product,
              value: Number(value),
            })),
          },
          "Recepción guardada y stock actualizado.",
        ),
    );
    return;
  }
  if (name === "message") {
    modal(
      "Simular un mensaje entrante",
      "Probá la bandeja y los avisos. Este evento se genera únicamente en el equipo.",
      select(
        "Proveedor",
        "supplier",
        [
          ["", "Elegir proveedor"],
          ...state.suppliers.map((s) => [s.id, s.name]),
        ],
        el.dataset.supplier,
      ) +
        field(
          "Número del remitente (prueba)",
          "sender",
          "",
          "tel",
          'placeholder="+34…" maxlength="40"',
        ) +
        `<p class="detection-status" role="status">Pega un texto o un número para proponer el proveedor.</p><label class="field">Mensaje del proveedor<textarea name="text" maxlength="5000" required>Hola, solo quedan dos cajas. La entrega del resto será mañana.</textarea></label><p class="fineprint">Las reglas detectan expresiones como «sin stock», «entrega» o «promoción». No hay IA conectada.</p>`,
      async (f) => {
        const ok = await mutate(
          { type: "message", supplier: f.get("supplier"), text: f.get("text") },
          "Nuevo mensaje de demostración recibido.",
        );
        if (ok) {
          messageQuery = "";
          messageSupplier = "all";
          messageFilter = "all";
          selectedMessage = state.messages[0].id;
          nav("messages");
        }
        return ok;
      },
      "Recibir mensaje de prueba",
    );
    const form = $("#modal-form");
    let manual = !!el.dataset.supplier,
      serial = 0,
      timer;
    form.querySelector("select[name=supplier]").required = true;
    form
      .querySelector("select[name=supplier]")
      .addEventListener("change", () => (manual = true));
    const detect = () => {
      const current = ++serial;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if ($("#modal-form") !== form) return;
        try {
          const sender = form.querySelector("input[name=sender]").value;
          const result = await request("/api/identify", {
            text: form.querySelector("textarea[name=text]").value,
            sender,
            channel: sender ? "whatsapp" : "document",
          });
          if (current === serial && $("#modal-form") === form)
            showDetection(form, result, manual);
        } catch (e) {
          if ($("#modal-form") === form)
            form.querySelector(".detection-status").textContent = e.message;
        }
      }, 350);
    };
    form.querySelector("input[name=sender]").addEventListener("input", detect);
    form.querySelector("textarea[name=text]").addEventListener("input", detect);
    return;
  }
  if (name === "messagesToRead") {
    messageFilter = "toread";
    render();
    return;
  }
  if (name === "decideMessage") {
    const m = state.messages.find((x) => x.id === el.dataset.id);
    modal(
      "Decidir y cerrar",
      "Anota qué haces con este mensaje. Es tu decisión de hoy; la app no la aplicará sola a otros mensajes.",
      `<label class="field">Decisión<textarea name="decision" maxlength="300" required placeholder="Ejemplo: esperamos al lunes · lo compro en Makro · aceptamos la sustitución">${esc(m.decision || "")}</textarea></label>`,
      async (f) =>
        mutate(
          { type: "decide", id: m.id, decision: f.get("decision").trim() },
          "Decisión anotada y mensaje cerrado.",
        ),
      "Guardar decisión",
    );
    return;
  }
  if (name === "fillReply") {
    const box = $("#reply-text");
    if (!box) return;
    box.value = el.dataset.text || "";
    const id = $("[data-action=sendReply]")?.dataset.id;
    if (id) replyDrafts[id] = box.value;
    box.focus();
    return;
  }
  if (name === "sendReply") {
    const m = state.messages.find((x) => x.id === el.dataset.id);
    const text = ($("#reply-text")?.value || "").trim();
    if (!text) {
      toast("Escribe la respuesta o elige una rápida.");
      return;
    }
    if (busy) return;
    busy = true;
    try {
      const data = await request("/api/whatsapp", {
        type: "reply",
        id: m.id,
        text,
      });
      delete replyDrafts[m.id];
      applyEnvelope(data);
      render();
      toast("Respuesta enviada a " + (m.sender || "") + " y decisión anotada.");
    } catch (e) {
      toast(e.message);
    } finally {
      busy = false;
    }
    return;
  }
  if (name === "orderBatch") {
    let preview;
    try {
      preview = await request("/api/whatsapp", { type: "batchPreview" });
    } catch (e) {
      toast(e.message);
      return;
    }
    const sendable = preview.items.filter((i) => i.sendable);
    const byId = Object.fromEntries(preview.items.map((i) => [i.order, i]));
    modal(
      "Enviar pedidos pendientes por WhatsApp",
      preview.connected
        ? "Marca los pedidos y revisa cada texto. Se envían uno a uno, con unos segundos de pausa, exactamente como se muestran."
        : "WhatsApp no está conectado: conecta por QR en la pantalla WhatsApp. Los pedidos sin WhatsApp se copian para la web o el correo.",
      preview.items
        .map(
          (i) =>
            `<div class="batch-item ${i.sendable ? "" : "blocked"}"><label class="check-label"><input type="checkbox" name="order" value="${esc(i.order)}" ${i.sendable ? "checked" : "disabled"}> <strong>${esc(i.number)}</strong> · ${esc(i.supplier)}${i.to ? " · " + esc(i.to) : ""}</label>${i.reason ? `<p class="fineprint">${esc(i.reason)}${i.web ? ` <a class="text-link" href="${esc(i.web)}" target="_blank" rel="noopener noreferrer">Abrir web</a>` : ""}</p>` : ""}<details><summary>Ver texto</summary><textarea class="batch-text" readonly rows="5" data-order="${esc(i.order)}">${esc(i.text)}</textarea>${btn("Copiar texto", "copyBatchText", "secondary", `data-order="${esc(i.order)}"`)}</details></div>`,
        )
        .join("") ||
        '<div class="empty compact">No hay pedidos pendientes.</div>',
      async (f) => {
        const chosen = f.getAll("order").map(String);
        if (!chosen.length) throw Error("Marca al menos un pedido.");
        const r = await request("/api/whatsapp", {
          type: "sendBatch",
          orders: chosen.map((id) => ({ order: id, text: byId[id].text })),
        });
        // Keep the dialog open and turn it into a progress view.
        $("#modal-form button[type=submit]").hidden = true;
        const body = $("#modal .modal-body");
        const paint = (b) => {
          body.innerHTML = `<p><strong>${b.running ? "Enviando…" : "Envío terminado."}</strong> ${b.done} de ${b.total}.</p><ul class="batch-progress">${chosen
            .map((id) => {
              const res = b.results.find((x) => x.order === id);
              const it = byId[id];
              return `<li class="${res ? (res.ok ? "ok" : "error") : b.running ? "pending" : ""}"><strong>${esc(it.number)}</strong> · ${esc(it.supplier)} · ${res ? (res.ok ? "enviado a " + esc(res.to || it.to) : "error: " + esc(res.error || "")) : "en cola"}</li>`;
            })
            .join(
              "",
            )}</ul>${b.running ? "" : '<p class="fineprint">Cada pedido enviado queda marcado como Enviado en Control de entregas; los que fallaron siguen pendientes.</p>'}`;
        };
        paint({ running: true, done: 0, total: r.total, results: [] });
        const poll = async () => {
          try {
            const view = await request("/api/whatsapp");
            paint(view.batch);
            if (view.batch.running) setTimeout(poll, 1500);
            else {
              await reloadState();
              const ok = view.batch.results.filter((x) => x.ok).length;
              toast(
                `Lote terminado: ${ok} de ${view.batch.total} pedidos enviados.`,
              );
            }
          } catch (e) {
            body.insertAdjacentHTML(
              "beforeend",
              `<p role="alert">${esc(e.message)}</p>`,
            );
          }
        };
        setTimeout(poll, 1200);
        return false;
      },
      "Enviar los marcados, uno a uno",
    );
    if (!sendable.length) $("#modal-form button[type=submit]").disabled = true;
    return;
  }
  if (name === "copyBatchText") {
    const t = $(
      `#modal-form textarea[data-order="${CSS.escape(el.dataset.order)}"]`,
    );
    if (!t) return;
    t.focus();
    t.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    toast(ok ? "Texto copiado." : "Selecciona el texto y cópialo con Ctrl+C.");
    return;
  }
  if (name === "review") {
    await mutate({ type: "review", id: el.dataset.id }, "Mensaje revisado.");
    return;
  }
  if (name === "priority") {
    const m = state.messages.find((m) => m.id === el.dataset.id);
    modal(
      "Cambiar prioridad",
      "Tu corrección queda registrada.",
      select(
        "Prioridad",
        "priority",
        Object.entries(priorityLabel),
        m.priority,
      ),
      async (f) =>
        mutate(
          { type: "priority", id: m.id, priority: f.get("priority") },
          "Prioridad actualizada.",
        ),
    );
    return;
  }
  if (name === "organizePhoto") {
    const ph = state.photos.find((p) => p.id === el.dataset.id);
    modal(
      "Organizar foto",
      "Elige el proveedor y la fecha del documento.",
      photoFields(ph),
      async (f) =>
        mutate(
          {
            type: "organizePhoto",
            id: ph.id,
            supplier: f.get("supplier") || undefined,
            documentDate: f.get("documentDate"),
          },
          "Foto organizada.",
        ),
    );
    return;
  }
  if (name === "relevance") {
    const m = state.messages.find((m) => m.id === el.dataset.id);
    modal(
      "Corregir relevancia",
      "La prioridad y el texto original se conservan.",
      select(
        "Relevancia",
        "relevance",
        Object.entries(relevanceLabel),
        m.relevance,
      ) +
        '<label class="field">Motivo de la clasificación<textarea name="reason" maxlength="500" required></textarea></label>',
      async (f) =>
        mutate(
          {
            type: "relevance",
            id: m.id,
            relevance: f.get("relevance"),
            reason: f.get("reason"),
          },
          "Relevancia actualizada.",
        ),
    );
    return;
  }
  if (name === "link") {
    const m = state.messages.find((m) => m.id === el.dataset.id);
    const list = state.orders.filter((o) => o.supplier === m.supplier);
    if (!list.length) {
      toast("Todavía no hay pedidos de este proveedor para vincular.");
      return;
    }
    modal(
      "Vincular a un pedido",
      "Solo se muestran pedidos del mismo proveedor.",
      select(
        "Pedido",
        "order",
        list.map((o) => [o.id, o.number]),
      ),
      async (f) =>
        mutate(
          { type: "link", id: m.id, order: f.get("order") },
          "Mensaje vinculado.",
        ),
    );
    return;
  }
  if (name === "unlockRecipes") {
    try {
      const data = await request("/api/lock", {
        type: "unlock",
        password: $("#lock-password")?.value || "",
      });
      state = data.state;
      lockInfo = data.lock;
      render();
      toast("Recetario desbloqueado durante 30 minutos.");
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (name === "lockNow") {
    const data = await request("/api/lock", { type: "lock" });
    state = data.state;
    lockInfo = data.lock;
    render();
    return;
  }
  if (name === "lockSet" || name === "lockChange") {
    const change = name === "lockChange";
    modal(
      change
        ? "Cambiar la contraseña del recetario"
        : "Poner contraseña al recetario",
      "Mínimo 6 caracteres. Guárdala: no hay recuperación automática.",
      (change
        ? field(
            "Contraseña actual",
            "current",
            "",
            "password",
            'required maxlength="100"',
          )
        : "") +
        field(
          "Nueva contraseña",
          "password",
          "",
          "password",
          'required minlength="6" maxlength="100"',
        ) +
        field(
          "Repetir contraseña",
          "again",
          "",
          "password",
          'required minlength="6" maxlength="100"',
        ),
      async (f) => {
        if (f.get("password") !== f.get("again"))
          throw Error("Las contraseñas no coinciden.");
        const data = await request("/api/lock", {
          type: "set",
          password: f.get("password"),
          ...(change ? { current: f.get("current") } : {}),
        });
        state = data.state;
        lockInfo = data.lock;
        render();
        toast("Contraseña del recetario guardada.");
        return true;
      },
    );
    return;
  }
  if (name === "lockRemove") {
    modal(
      "Quitar la contraseña del recetario",
      "Las recetas volverán a verse sin contraseña.",
      field(
        "Contraseña actual",
        "password",
        "",
        "password",
        'required maxlength="100"',
      ),
      async (f) => {
        const data = await request("/api/lock", {
          type: "remove",
          password: f.get("password"),
        });
        state = data.state;
        lockInfo = data.lock;
        render();
        return true;
      },
      "Quitar",
    );
    return;
  }
  if (name === "purgeNow") {
    modal(
      "Limpiar ahora",
      `Se borrarán la actividad y las conversaciones de WhatsApp anteriores a ${retentionDays} días. Los movimientos de stock se conservan.`,
      "<p>Existe una copia automática diaria en data/backups.</p>",
      async () => {
        const data = await request("/api/maintenance", { type: "purge" });
        state = data.state;
        toast(
          data.purge?.skipped
            ? "No hay limpieza configurada."
            : `Limpieza hecha: ${data.purge.activity} entradas de actividad, ${data.purge.messages} mensajes de WhatsApp.`,
        );
        render();
        return true;
      },
      "Borrar",
    );
    return;
  }
  if (name === "openDocuments") {
    nav("documents");
    return;
  }
  if (name === "applySuggestion") {
    await mutate(
      { type: "applySuggestion", id: el.dataset.id },
      "Propuesta aceptada.",
    );
    return;
  }
  if (name === "unlinkDocument") {
    await mutate(
      { type: "linkDocument", id: el.dataset.id },
      "Documento desvinculado.",
    );
    return;
  }
  if (name === "linkDocument") {
    const ph = state.photos.find((p) => p.id === el.dataset.id);
    const orders = state.orders.filter(
      (o) =>
        (!ph.supplier || o.supplier === ph.supplier) &&
        o.status !== "cancelled",
    );
    if (!orders.length) {
      toast("No hay pedidos de ese proveedor a los que vincular.");
      return;
    }
    modal(
      "Vincular a un pedido",
      "Elige el pedido al que pertenece este documento.",
      select(
        "Pedido",
        "order",
        orders.map((o) => [
          o.id,
          `${o.number} · ${supplier(o.supplier).name} · ${date(o.at)} · ${statusLabel[o.status]}`,
        ]),
        ph.suggestion?.order || ph.order || orders[0].id,
      ),
      async (f) =>
        mutate(
          { type: "linkDocument", id: ph.id, order: f.get("order") },
          "Documento vinculado.",
        ),
    );
    return;
  }
  if (name === "documentPath") {
    const ph = state.photos.find((p) => p.id === el.dataset.id);
    modal(
      "Dónde está el archivo",
      "Copia derivada dentro de la carpeta del proveedor; el original vive en attachments.",
      `<code class="path">${esc(dataDir)} / proveedores / ${esc(ph.supplier ? "proveedor-…" : "sin-proveedor")} / fotos / ${esc(ph.documentDate || ph.at.slice(0, 10))}</code><p class="fineprint">${esc(ph.name)} · ${esc(ph.mime || "")}</p>`,
      async () => true,
      "Listo",
    );
    return;
  }
  if (name === "businessEditor") {
    modal(
      "Identidad del negocio",
      "Solo texto: la marca visual de la app es propia y no usa logotipos de terceros.",
      field(
        "Nombre del negocio",
        "name",
        state.business,
        "text",
        'required maxlength="80"',
      ) +
        field(
          "Lugar",
          "place",
          state.place || "",
          "text",
          'maxlength="80" placeholder="Palma de Mallorca"',
        ),
      async (f) =>
        mutate(
          {
            type: "business",
            name: f.get("name"),
            place: f.get("place") || "",
          },
          "Identidad guardada.",
        ),
    );
    return;
  }
  if (name === "exportCsv") {
    try {
      const r = await request("/api/export", {});
      modal(
        "Exportación CSV creada",
        "Inventario y movimientos, separados por punto y coma, listos para hoja de cálculo o gestoría.",
        r.files.map((f) => `<code class="path">${esc(f)}</code>`).join(""),
        async () => true,
        "Listo",
      );
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (name === "backup") {
    try {
      const r = await request("/api/backup", {});
      modal(
        "Copia de seguridad creada",
        "Incluye los datos y las fotos guardadas.",
        `<code class="path">${esc(r.path)}</code>`,
        async () => true,
        "Listo",
      );
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (name === "countSheet") {
    const zonesInUse = [
      ...new Set(state.products.map((p) => p.zone || "almacen")),
    ];
    const due = (alerts?.counts || []).find(
      (z) => z.due && zonesInUse.includes(z.zone),
    );
    const initial = el.dataset.zone || (due ? due.zone : zonesInUse[0]);
    modal(
      "Hoja de conteo por zona",
      "Cuenta lo que hay en la zona y escribe cada cantidad en su unidad base. Al guardar, cada línea queda como un conteo (aunque no cambie) y el stock se ajusta.",
      `<label class="field">Zona<select id="count-zone" name="zone">${zonesInUse.map((z) => `<option value="${z}" ${z === initial ? "selected" : ""}>${esc(zoneLabel[z] || z)}</option>`).join("")}</select></label><div id="count-rows">${countRows(initial)}</div>`,
      async (f) => {
        const zone = f.get("zone");
        const lines = state.products
          .filter((p) => (p.zone || "almacen") === zone)
          .map((p) => ({
            product: p.id,
            value: Number(f.get("count_" + p.id)),
          }))
          .filter((l) => Number.isFinite(l.value));
        return mutate(
          { type: "countSheet", zone, lines },
          "Conteo guardado y stock ajustado.",
        );
      },
      "Guardar conteo",
    );
    return;
  }
  if (name === "weeklyPrev" || name === "weeklyNext") {
    const start = weeklyWeek || (weeklyData && weeklyData.start);
    if (!start) return;
    weeklyData = null;
    weeklyWeek = shiftWeek(start, name === "weeklyPrev" ? -7 : 7);
    render();
    return;
  }
  if (name === "printPage") {
    window.print();
    return;
  }
  if (name === "moreHistory") {
    const kind = el.dataset.kind;
    historyShown[kind] += 50;
    const total = historyInfo?.[kind] ?? state[kind].length;
    if (historyShown[kind] > state[kind].length && state[kind].length < total) {
      try {
        const r = await request(
          `/api/history?kind=${kind}&offset=${state[kind].length}&limit=300`,
        );
        // Append only what is not already loaded (the list is newest first).
        const known = new Set(state[kind].map((x) => x.id));
        state[kind] = state[kind].concat(
          r.items.filter((x) => !known.has(x.id)),
        );
      } catch (e) {
        toast(e.message);
      }
    }
    render();
    return;
  }
  if (name === "backupDirEditor") {
    modal(
      "Carpeta secundaria de copias",
      "Cada copia (manual o automática) se duplica ahí. Usa otro disco, un USB o una carpeta sincronizada. Se comprueba que se puede escribir.",
      field(
        "Ruta completa de la carpeta",
        "dir",
        backupInfo?.secondary?.dir || "",
        "text",
        'required maxlength="300" placeholder="E:\\CopiasGelato"',
      ),
      async (f) => {
        applyEnvelope(
          await request("/api/maintenance", {
            type: "backupDir",
            dir: f.get("dir").trim(),
          }),
        );
        render();
        toast("Carpeta secundaria guardada y primera copia hecha.");
        return true;
      },
    );
    return;
  }
  if (name === "backupDirClear") {
    applyEnvelope(
      await request("/api/maintenance", { type: "backupDir", dir: "" }),
    );
    render();
    toast(
      "Carpeta secundaria quitada. Las copias siguen en la carpeta de datos.",
    );
    return;
  }
  if (name === "restore") {
    modal(
      "Restaurar una copia",
      "Reemplaza los datos de demostración actuales. Guardaremos una copia previa.",
      `<label class="field">Archivo de copia (.json)<input type="file" name="backup" accept=".json,application/json" required></label><label class="check-label"><input type="checkbox" required> Entiendo que se reemplazarán los datos actuales.</label>`,
      async (f) => {
        const file = f.get("backup");
        if (file.size > 100000000) throw Error("La copia supera 100 MB.");
        const data = JSON.parse(await file.text());
        const r = await request("/api/restore", {
          backup: data,
          revision: state.revision,
        });
        state = r.state;
        appVersion = r.version || appVersion;
        render();
        toast("Copia restaurada.");
      },
      "Restaurar datos",
    );
    return;
  }
}

// Rows of the count sheet for one zone: current stock as the starting value.
function countRows(zone) {
  const items = state.products.filter((p) => (p.zone || "almacen") === zone);
  if (!items.length)
    return '<p class="muted">No hay productos en esta zona. Asigna la zona en Editar producto.</p>';
  return `<div class="table-scroll"><table class="delivery-table count-table"><thead><tr><th>Producto</th><th>En la app</th><th>Contado</th></tr></thead><tbody>${items
    .map(
      (p) =>
        `<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.detail)}</small></td><td>${num(p.stock)} ${esc(p.unit)}</td><td><input class="inline-input" type="number" name="count_${esc(p.id)}" value="${p.stock}" min="0" max="1000000" step="${p.unit === "ud" ? "1" : "0.001"}" aria-label="Contado de ${esc(p.name)}"></td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}
