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
  if (name === "orderNudge") {
    // Reclamar respuesta: la app propone el texto, la persona lo lee, lo cambia si quiere y envía.
    let preview;
    try {
      preview = await request("/api/whatsapp", {
        type: "nudgePreview",
        order: el.dataset.order,
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
      "Reclamar respuesta de " + preview.number,
      "Se envía una sola vez al número de la ficha del proveedor. Puedes cambiar el texto antes de enviarlo.",
      `<p><strong>Para:</strong> ${esc(preview.label)} · ${esc(preview.to)}</p><p class="fineprint">Enviado hace ${esc(preview.days)}${preview.answered ? ", y hay algún mensaje suyo vinculado a este pedido" : ", sin ningún mensaje suyo vinculado"}.</p><label class="field">Mensaje que se enviará<textarea name="text" class="ai-editor" maxlength="1000" rows="5">${esc(preview.text)}</textarea></label>${blocked ? `<p role="alert">${esc(blocked)}</p>` : '<p class="fineprint">Reclamar no cambia el pedido ni el stock: solo pide respuesta. Como mucho, un recordatorio por pedido y día.</p>'}`,
      async (f) => {
        if (blocked) return false;
        const data = await request("/api/whatsapp", {
          type: "nudge",
          order: el.dataset.order,
          text: f.get("text"),
        });
        applyEnvelope(data);
        render();
        toast("Recordatorio enviado a " + data.sent.recipient + ".");
        return true;
      },
      blocked ? "Cerrar" : "Enviar recordatorio",
    );
    return;
  }
  if (name === "nudgeTemplateEditor") {
    modal(
      "Plantilla del recordatorio",
      "Texto que se propone al reclamar respuesta de un pedido. Usa {numero} para el número del pedido y, si quieres, {proveedor}, {negocio} y {dias}. Vacío = texto original.",
      `<label class="field">Plantilla<textarea name="template" maxlength="1000" rows="6">${esc(nudgeTemplate)}</textarea></label>`,
      async (f) => {
        applyEnvelope(
          await request("/api/maintenance", {
            type: "nudgeTemplate",
            template: f.get("template"),
          }),
        );
        render();
        toast("Plantilla guardada. Se propone en los próximos recordatorios.");
        return true;
      },
    );
    return;
  }
  if (name === "replyTemplatesEditor") {
    modal(
      "Respuestas rápidas",
      "Son los botones que salen en un mensaje para responder de un toque. Cambia el texto de los que quieras; vacío deja el original. {fecha} se sustituye por la fecha que dijo el proveedor.",
      `<div class="template-list">${replyDefaults
        .map(
          (r) =>
            `<label class="field">${esc(r.label)}<textarea name="${esc(r.id)}" maxlength="300" rows="2">${esc(replyTemplates[r.id] || r.text)}</textarea></label>`,
        )
        .join("")}</div>`,
      async (f) => {
        const templates = {};
        for (const r of replyDefaults) {
          const written = String(f.get(r.id) || "").trim();
          if (written && written !== r.text) templates[r.id] = written;
        }
        applyEnvelope(
          await request("/api/maintenance", {
            type: "replyTemplates",
            templates,
          }),
        );
        render();
        toast("Respuestas rápidas guardadas.");
        return true;
      },
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
          "Gelato que sale de esta receta",
          "product",
          [
            [
              "__new__",
              "El de esta receta: se crea solo con su nombre (recomendado)",
            ],
            ["", "Ninguno: es una base o pasta que no se vende"],
            ...state.products
              .filter((p) => p.unit === "kg")
              .map((p) => [p.id, p.name]),
          ],
          // A gelato needs its finished product: sales, waste and sale value hang from it.
          r.product ||
            // New recipes create it by default; an existing one keeps what it had.
            (r.id ? "" : "__new__"),
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
            ...(f.get("product") === "__new__"
              ? { createProduct: true }
              : f.get("product")
                ? { product: f.get("product") }
                : {}),
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
  if (name === "createFinished") {
    // One click from the recipe sheet: the finished product is created with the recipe's name.
    const r = state.recipes.find((x) => x.id === el.dataset.id);
    const { id, cost, balance, saleValues, manualCost, locked, ...fields } = r;
    const before = state.productions
      .filter((p) => p.recipe === r.id && p.status === "applied")
      .reduce((n, p) => n + p.quantity, 0);
    modal(
      "Activar " + r.name,
      "La app dará de alta este gelato para que puedas ponerle valor de venta y apuntar sus ventas y mermas." +
        (before
          ? ` Ya habías producido ${num(before)} kg antes de activarlo; esos kilos no se guardaron en ningún stock, así que la app no sabe cuánto te queda.`
          : "") +
        " Si ahora tienes gelato hecho, escribe cuántos kilos; si no, déjalo vacío y empieza en 0.",
      field(
        "Kilos que tienes ahora (opcional)",
        "kilos",
        "",
        "number",
        'min="0" max="100000" step="0.001" placeholder="0"',
      ),
      async (f) => {
        const ok = await mutate(
          { type: "recipe", id, ...fields, createProduct: true },
          "Listo: ya puedes ponerle valor de venta y registrar sus ventas y mermas.",
        );
        const kilos = Math.round(Number(f.get("kilos")) * 1000) / 1000;
        const made = state.recipes.find((x) => x.id === id)?.product;
        if (ok && kilos > 0 && made)
          await mutate({
            type: "count",
            product: made,
            value: kilos,
            reason: "Kilos que había al activar el gelato",
          });
        salesData = null;
        render();
        return ok;
      },
      "Activar",
    );
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
    const today = businessToday();
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
          // «Qué producir hoy» opens this with the kilos that are missing for the goal.
          Number(el.dataset.quantity) || 1,
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
    // The day summary and the value reports below include what was just produced.
    salesData = null;
    render();
    return;
  }
  if (name === "dailySales") {
    const panel = el.closest("[data-sales]");
    const form = readSalesForm(panel);
    if (!form.lines.length) {
      toast("Indica al menos una cantidad.");
      return;
    }
    if (form.problems) {
      toast("Revisa las filas marcadas: no cuadran con el stock.");
      return;
    }
    await mutate(
      {
        type: "dailySales",
        date: panel.querySelector("[data-sales-date]").value,
        lines: form.lines,
      },
      "Cierre del día registrado.",
    );
    salesData = null;
    render();
    return;
  }
  if (name === "salesMode") {
    salesMode = el.dataset.mode === "remaining" ? "remaining" : "sold";
    try {
      localStorage.setItem("gelato-sales-mode", salesMode);
    } catch {
      // The choice simply does not persist.
    }
    render();
    return;
  }
  if (name === "openDay") {
    // From the home notice: Producción, with the day summary on that day.
    dayDate = el.dataset.date;
    salesData = null;
    nav("production");
    return;
  }
  if (name === "setGoal") {
    const p = product(el.dataset.id);
    modal(
      "Objetivo de " + p.name,
      "Cuántos kilos quieres tener de este gelato. «Qué producir hoy» te propone lo que falte hasta ahí. Con 0 no se propone nada.",
      field(
        "Kilos que quieres tener",
        "target",
        p.target || "",
        "number",
        'min="0" max="100000" step="0.001" required',
      ),
      async (f) => {
        await mutate(
          { type: "setGoal", product: p.id, target: Number(f.get("target")) },
          "Objetivo guardado.",
        );
        salesData = null;
        render();
        return true;
      },
    );
    return;
  }
  if (name === "confirmDay" || name === "reopenDay") {
    const day = el.dataset.date;
    const confirm = name === "confirmDay";
    const dayName = date(day + "T12:00:00Z");
    modal(
      (confirm ? "Confirmar el cierre del " : "Reabrir el ") + dayName,
      confirm
        ? "El resumen del día queda guardado tal como está. Después, ventas, mermas y producciones de ese día no se pueden cambiar sin reabrirlo. La venta real es opcional: si la escribes, verás la diferencia con la estimada."
        : "El día vuelve a admitir correcciones. El cierre anterior y el motivo quedan en el registro; al terminar, vuelve a confirmarlo.",
      confirm
        ? field(
            "Venta real del día en € (opcional)",
            "real",
            "",
            "number",
            'min="0" max="1000000" step="0.01" placeholder="Lo que marcó la caja o el TPV"',
          )
        : field(
            "Motivo",
            "reason",
            "",
            "text",
            'required maxlength="200" placeholder="Merma mal pesada, faltaba una producción…"',
          ),
      async (f) => {
        const real = f.get("real");
        await mutate(
          confirm
            ? {
                type: "confirmDay",
                date: day,
                ...(real !== null && real !== ""
                  ? { realSaleCents: Math.round(Number(real) * 100) }
                  : {}),
              }
            : { type: "reopenDay", date: day, reason: f.get("reason") },
          confirm ? "Día cerrado." : "Día reabierto.",
        );
        salesData = null;
        render();
        return true;
      },
      confirm ? "Confirmar cierre" : "Reabrir",
    );
    return;
  }
  if (name === "setSaleValue" || name === "setManualCost") {
    const r = state.recipes.find((x) => x.id === el.dataset.id);
    const sale = name === "setSaleValue";
    const today = businessToday();
    const current = sale
      ? (r.saleValues || []).filter((v) => v.from <= today).pop()?.cents
      : r.cost?.manual;
    modal(
      (sale ? "Valor de venta de " : "Coste a mano de ") + r.name,
      sale
        ? "Euros por kilo de gelato vendido. Vale desde hoy; los días anteriores conservan el valor que tenían."
        : "Euros por kilo. Mientras exista, manda sobre el coste calculado y se rotula «escrito a mano». Déjalo vacío para quitarlo y volver al calculado. Las producciones ya aprobadas conservan su coste.",
      field(
        sale ? "Valor de venta (€ por kilo)" : "Coste (€ por kilo)",
        "euros",
        current ? (current / 100).toFixed(2) : "",
        "number",
        `min="0.01" max="100000" step="0.01" ${sale ? "required" : ""}`,
      ),
      async (f) => {
        const cents = Math.round(Number(f.get("euros")) * 100);
        if (!sale && !cents && !r.cost?.manual) return true;
        await mutate(
          sale
            ? { type: "setSaleValue", recipe: r.id, cents, from: today }
            : {
                type: "setManualCost",
                recipe: r.id,
                ...(cents ? { cents } : {}),
              },
          sale
            ? "Valor de venta guardado."
            : cents
              ? "Coste a mano guardado."
              : "Coste a mano quitado.",
        );
        salesData = null;
        render();
        return true;
      },
    );
    return;
  }
  if (name === "voidProduction" || name === "fixProduction") {
    const p = state.productions.find((x) => x.id === el.dataset.id);
    const fix = name === "fixProduction";
    modal(
      (fix ? "Corregir la producción de " : "Anular la producción de ") +
        p.name,
      fix
        ? `Se anula la producción de ${num(p.quantity)} kg del ${date(p.date + "T12:00:00Z")} y queda una propuesta igual para que cambies lo que esté mal y la apruebes de nuevo. Los ingredientes vuelven al stock mientras tanto.`
        : `Los ingredientes vuelven al stock y los ${num(p.output?.quantity ?? p.quantity)} kg de gelato hecho salen del stock. Úsalo si se registró dos veces o por error. Los movimientos originales se conservan en Actividad.`,
      field(
        "Motivo (opcional)",
        "reason",
        "",
        "text",
        'maxlength="200" placeholder="Duplicada, peso mal apuntado…"',
      ),
      async (f) => {
        await mutate(
          {
            type: "voidProduction",
            id: p.id,
            reason: f.get("reason"),
            redo: fix,
          },
          fix
            ? "Producción anulada. Corrige la propuesta y apruébala."
            : "Producción anulada. El stock volvió a su sitio.",
        );
        salesData = null;
        render();
        return true;
      },
      fix ? "Anular y corregir" : "Anular producción",
    );
    return;
  }
  if (name === "undoCloseLine") {
    await mutate(
      { type: "undoCloseLine", id: el.dataset.id },
      "Línea eliminada. El stock volvió a su sitio.",
    );
    salesData = null;
    render();
    return;
  }
  if (name === "editCloseLine") {
    const day = salesData?.days.find((d) => d.date === el.dataset.date);
    const line = day?.lines.find((l) => l.id === el.dataset.id);
    if (!line) return;
    const shown =
      salesUnit === "g" ? Math.round(line.quantity * 1000) : line.quantity;
    modal(
      `Corregir ${line.kind === "sale" ? "la venta" : line.kind === "gift" ? "la invitación o consumo" : "la merma"} de ${line.name}`,
      `Día ${el.dataset.date}. Escribe el peso correcto en ${salesUnit === "g" ? "gramos" : "kilos"}; la app compensa la línea anterior y recalcula el stock y el día.`,
      field(
        "Peso correcto (" + salesUnit + ")",
        "quantity",
        shown,
        "number",
        unitAttrs().replace(
          'min="0"',
          salesUnit === "g" ? 'min="1"' : 'min="0.001"',
        ) + " required",
      ) +
        (line.kind === "waste"
          ? select(
              "Motivo de la merma",
              "wasteReason",
              [
                ["", "Dejar el que tenía: " + line.reason],
                ...Object.entries(salesData.reasons),
              ],
              "",
            )
          : ""),
      async (f) => {
        await mutate(
          {
            type: "editCloseLine",
            id: line.id,
            quantity: toKg(Number(f.get("quantity"))),
            ...(f.get("wasteReason")
              ? { wasteReason: f.get("wasteReason") }
              : {}),
          },
          "Línea corregida. Stock y día recalculados.",
        );
        salesData = null;
        render();
        return true;
      },
    );
    return;
  }
  if (name === "undoDailySales") {
    const date = el.dataset.date;
    const day = salesData?.days.find((d) => d.date === date);
    modal(
      "Deshacer el cierre del " + date,
      `Se compensan todas las ventas y mermas de ese día (${day ? num(day.sold) + " kg vendidos, " + num(day.waste) + " kg de merma y " + num(day.gift) + " kg de invitación o consumo" : "ese cierre"}) y el stock vuelve a su sitio. Los movimientos originales se conservan en Actividad. Después puedes registrar el cierre correcto.`,
      "",
      async () => {
        await mutate(
          { type: "undoDailySales", date },
          "Cierre deshecho. El stock volvió a su sitio.",
        );
        salesData = null;
        render();
        return true;
      },
      "Deshacer cierre",
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
  if (name === "buyElsewhere") {
    const p = product(el.dataset.product);
    const s = supplier(el.dataset.supplier);
    const packs = Math.max(1, Number(el.dataset.packs) || 1);
    const alt = (p.alternates || []).find((x) => x.supplier === s.id);
    if (!alt) return;
    modal(
      `Comprar ${p.name} a ${s.name}`,
      "Se añade al carrito con el formato y el precio que apuntaste para ese proveedor. No se envía nada: el pedido se crea cuando autorices el carrito.",
      `<p>${packs} paquete${packs === 1 ? "" : "s"} × ${num(alt.pack)} ${esc(p.unit)} · ${alt.price ? money(packs * alt.price) : "precio: No disponible"}</p><p class="fineprint">El proveedor habitual de ${esc(p.name)} no cambia, y el pedido que ya enviaste se queda como está.</p>`,
      async () => {
        const ok = await mutate(
          { type: "cart", product: p.id, packs, supplier: s.id },
          `${p.name} va al carrito de ${s.name}.`,
        );
        if (ok) nav("orders");
        return ok;
      },
      "Añadir al carrito",
    );
    return;
  }
  if (name === "webList") {
    const s = supplier(el.dataset.supplier);
    const lines = state.cart
      .map((l) => ({ l, p: product(l.product), buy: cartSupply(l) }))
      .filter(({ buy }) => buy.supplier === s.id)
      .map(
        ({ l, p, buy }) =>
          `${l.packs} × ${p.name} (${num(buy.pack)} ${p.unit})`,
      );
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
      "Di en qué se mide y cómo lo compras.",
      `<div class="form-grid">${field("Nombre", "name", "", "text", 'required maxlength="100"')}${field("Presentación / detalle", "detail", "", "text", 'maxlength="200"')}${select("Zona de conteo", "zone", Object.entries(zoneLabel), "almacen")}${select(
        "Categoría",
        "category",
        ["Gelatería", "Cafetería", "Postres", "Envases"].map((x) => [x, x]),
      )}${select("Se mide en", "unit", [
        ["kg", "Kilogramos"],
        ["L", "Litros"],
        ["ud", "Unidades"],
      ])}${field("Stock actual", "stock", 0, "number", 'min="0" max="1000000" step="0.001" required')}${field("Stock mínimo", "min", 0, "number", 'min="0" max="1000000" step="0.001" required')}${field("Stock objetivo", "target", 1, "number", 'min="0" max="1000000" step="0.001" required')}${field("Cuánto trae cada paquete", "pack", 1, "number", 'min="0.001" max="1000000" step="0.001" required')}${field("Precio estimado por paquete (€)", "price", 0, "number", 'min="0" max="1000000" step="0.01" required')}${select(
        "Proveedor",
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
      "Autorizar pedidos",
      "Se crean los pedidos, uno por proveedor. No se envía nada todavía: el envío por WhatsApp es el paso siguiente y lo confirmas tú.",
      `<p>${(() => {
        const n = new Set(state.cart.map((l) => cartSupply(l).supplier)).size;
        return n === 1
          ? "Se creará 1 pedido pendiente de envío."
          : `Se crearán ${n} pedidos pendientes de envío, uno por cada proveedor elegido en el carrito.`;
      })()}</p><div class="review-total">Total estimado <strong>${money(state.cart.reduce((n, l) => n + l.packs * cartSupply(l).price, 0))}</strong></div><p class="fineprint">Envío e impuestos por confirmar. En el siguiente paso podrás simular el envío.</p>`,
      async () => {
        const ok = await mutate(
          { type: "authorize", revision },
          "Pedidos creados y pendientes de envío.",
        );
        // The natural next step: send them one by one by WhatsApp, in one decision.
        if (ok && waState?.status === "connected")
          setTimeout(() => action("orderBatch", el), 300);
        return ok;
      },
      "Autorizar pedidos",
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
  if (name === "setExpectedFromMessage") {
    await mutate(
      { type: "setExpected", order: el.dataset.order, date: el.dataset.date },
      "Fecha de entrega fijada en el pedido.",
    );
    return;
  }
  if (name === "setExpected") {
    const o = state.orders.find((x) => x.id === el.dataset.order);
    modal(
      "Fecha de entrega prevista · " + o.number,
      "Solo cambia la fecha que esperas; el stock se mueve al registrar lo que llega.",
      field("Fecha", "date", o.expected || todayLocal(), "date", "required"),
      async (f) =>
        mutate(
          { type: "setExpected", order: o.id, date: f.get("date") },
          "Fecha de entrega fijada.",
        ),
    );
    return;
  }
  if (name === "confirmOrder") {
    await mutate(
      { type: "confirmOrder", order: el.dataset.order },
      "Pedido marcado como confirmado por el proveedor.",
    );
    return;
  }
  if (name === "removeLine") {
    const o = state.orders.find((x) => x.id === el.dataset.order);
    const p = product(el.dataset.product);
    modal(
      "Quitar " + p.name + " de " + o.number,
      "El proveedor no lo sirve: el producto sale del pedido y sigue bajo mínimo en el inventario para pedirlo a otro proveedor. El stock no cambia.",
      "",
      async () =>
        mutate(
          { type: "removeLine", order: o.id, product: p.id },
          p.name + " retirado del pedido.",
        ),
      "Quitar del pedido",
    );
    return;
  }
  if (name === "gotoOrder") {
    nav("orders");
    return;
  }
  if (name === "orderTemplateEditor") {
    modal(
      "Plantilla del pedido",
      "Texto que se envía al proveedor. Usa {lineas} para los productos y, si quieres, {numero}, {negocio} y {proveedor}. Vacío = plantilla original.",
      `<label class="field">Plantilla<textarea name="template" maxlength="1000" rows="7">${esc(orderTemplate)}</textarea></label>`,
      async (f) => {
        applyEnvelope(
          await request("/api/maintenance", {
            type: "orderTemplate",
            template: f.get("template"),
          }),
        );
        render();
        toast("Plantilla guardada. Se aplica a los próximos envíos.");
        return true;
      },
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
  if (name === "pickFolder") {
    try {
      const chosen = await window.gelato.pickFolder(el.dataset.purpose);
      if (!chosen) return;
      const input = $(
        `#modal-form input[name="${CSS.escape(el.dataset.target)}"]`,
      );
      if (input) input.value = chosen;
    } catch (e) {
      toast("No se pudo abrir el explorador: " + e.message);
    }
    return;
  }
  if (name === "exportCsv") {
    try {
      // With the native picker the person chooses where the CSV files go; cancel keeps the default.
      let dir = "";
      if (window.gelato?.pickFolder)
        dir = (await window.gelato.pickFolder("export")) || "";
      const r = await request("/api/export", dir ? { dir } : {});
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
      "Cuenta lo que hay en la zona y escribe cada cantidad como la mides (kilos, litros o unidades). Al guardar, cada línea queda como un conteo (aunque no cambie) y el stock se ajusta.",
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
  if (name === "cruisesRefresh") {
    loadCruises({ sync: true });
    return;
  }
  if (["cruisePrev", "cruiseNext", "cruiseToday", "cruiseDay"].includes(name)) {
    // Days are port days: «today» comes from the server (Europe/Madrid), not from this computer.
    const current = cruiseDay || cruiseDash.today;
    cruiseDay =
      name === "cruiseToday"
        ? ""
        : name === "cruiseDay"
          ? el.dataset.day
          : cruiseShift(current, name === "cruisePrev" ? -1 : 1);
    if (page !== "cruises") page = "cruises";
    if (cruiseTab === "calendar" && cruiseDay)
      cruiseMonth = cruiseDay.slice(0, 7);
    await loadCruises();
    if (name === "cruiseDay")
      document
        .getElementById("cruise-detail")
        ?.scrollIntoView({ block: "start" });
    return;
  }
  if (name === "cruiseTab") {
    cruiseTab = el.dataset.tab;
    cruiseFound = null;
    if (cruiseTab === "calendar")
      cruiseMonth = (cruiseDay || cruiseDash.today).slice(0, 7);
    await loadCruises();
    return;
  }
  if (name === "cruiseMonthPrev" || name === "cruiseMonthNext") {
    const [y, m] = (cruiseMonth || cruiseDash.today.slice(0, 7))
      .split("-")
      .map(Number);
    const x = new Date(
      Date.UTC(y, m - 1 + (name === "cruiseMonthPrev" ? -1 : 1), 1),
    );
    cruiseMonth = x.toISOString().slice(0, 7);
    await loadCruises();
    return;
  }
  if (name === "cruiseMore") {
    await searchCruises(cruiseFound.items.length);
    render();
    return;
  }
  if (name === "cruiseCall") {
    const c = await request(
      "/api/cruises/call?id=" + encodeURIComponent(el.dataset.id),
    );
    const line = (label, value) =>
      `<tr><td>${label}</td><td>${value}</td></tr>`;
    modal(
      c.ship + " · historial y origen",
      "De dónde sale cada dato de esta escala y qué ha cambiado desde que se anunció.",
      `<table class="report-table"><tbody>${line("Identificador de escala", esc(c.id))}${line("Fuente", esc(c.source))}${line("Página de la fuente", esc(c.sourceUrl))}${line("Primera vez vista", esc(cruiseStamp(c.retrievedAt)))}${line("Última verificación", esc(cruiseStamp(c.lastVerifiedAt)))}${line("Previsión del puerto actualizada", c.sourceUpdatedAt ? esc(cruiseWall(c.sourceUpdatedAt)) : NA)}${line("Procedencia", c.origin === "history" ? "Histórico oficial (horas reales)" : "Previsión vigente")}${line("Horario previsto", c.scheduledArrival ? esc(cruiseWall(c.scheduledArrival)) + " → " + esc(cruiseWall(c.scheduledDeparture)) : NA)}</tbody></table><h3 class="cruise-sub">Cambios registrados</h3>${c.changes.length ? `<table class="report-table"><thead><tr><th>Cuándo</th><th>Dato</th><th>Antes</th><th>Después</th><th>Motivo</th></tr></thead><tbody>${c.changes.map((x) => `<tr><td>${esc(cruiseStamp(x.at))}</td><td>${esc(x.field)}</td><td>${esc(x.before || "—")}</td><td>${esc(x.after || "—")}</td><td>${esc(x.reason)}</td></tr>`).join("")}</tbody></table>` : '<p class="muted">Sin cambios desde que se anunció.</p>'}`,
      async () => true,
      "Cerrar",
    );
    return;
  }
  if (name === "cruiseShip") {
    const c = await request(
      "/api/cruises/call?id=" + encodeURIComponent(el.dataset.id),
    );
    const s = c.shipInfo;
    modal(
      "Ficha de " + s.name,
      "El puerto no publica la naviera ni la capacidad. Si las anotas, indica de dónde sale el dato: se mostrará como dato manual con su fuente. Déjalo vacío para que siga como «No disponible».",
      field("Naviera", "line", s.line || "", "text", 'maxlength="80"') +
        field(
          "Capacidad habitual (pasajeros)",
          "capacityStandard",
          s.capacityStandard || "",
          "number",
          'min="1" max="12000" step="1"',
        ) +
        field(
          "Capacidad máxima (pasajeros)",
          "capacityMax",
          s.capacityMax || "",
          "number",
          'min="1" max="12000" step="1"',
        ) +
        field(
          "Tripulación",
          "crew",
          s.crew || "",
          "number",
          'min="1" max="5000" step="1"',
        ) +
        field(
          "Fuente del dato",
          "infoSource",
          s.infoSource || "",
          "text",
          'maxlength="120" placeholder="Web de la naviera, ficha técnica…"',
        ) +
        `<p class="fineprint">IMO ${esc(s.imo || "no disponible")} · ${s.calls} escalas registradas en Palma.</p>`,
      async (f) => {
        const n = (k) => (f.get(k) ? Number(f.get(k)) : null);
        await request("/api/cruises", {
          type: "ship",
          key: s.key,
          line: f.get("line"),
          capacityStandard: n("capacityStandard"),
          capacityMax: n("capacityMax"),
          crew: n("crew"),
          infoSource: f.get("infoSource"),
        });
        await loadCruises();
        toast("Ficha del barco guardada.");
        return true;
      },
    );
    return;
  }
  if (name === "cruiseEventAdd") {
    const day = el.dataset.day;
    modal(
      "Añadir evento",
      "Algo que puede mover gente ese día: una feria, un concierto, una fiesta de barrio. Es una nota tuya; la app no la saca de ninguna fuente.",
      field("Nombre", "name", "", "text", 'maxlength="80" required') +
        field("Desde", "from", day, "date", "required") +
        field("Hasta", "to", day, "date", "required") +
        field(
          "Nota",
          "note",
          "",
          "text",
          'maxlength="200" placeholder="Lugar, horario…"',
        ),
      async (f) => {
        await request("/api/cruises", {
          type: "event",
          name: f.get("name"),
          from: f.get("from"),
          to: f.get("to"),
          note: f.get("note"),
        });
        await loadCruises();
        toast("Evento anotado.");
        return true;
      },
    );
    return;
  }
  if (name === "cruiseEventDelete") {
    await request("/api/cruises", { type: "eventDelete", id: el.dataset.id });
    await loadCruises();
    toast("Evento quitado.");
    return;
  }
  if (name === "cruiseRestore") {
    const r = await request("/api/cruises/copy");
    if (!r.copy) {
      toast(
        "Todavía no hay copia del registro de cruceros. Se crea con la copia diaria.",
      );
      return;
    }
    modal(
      "Restaurar el registro de cruceros",
      `La copia es del ${cruiseStamp(r.copy.modifiedAt)} y contiene ${r.copy.calls} escalas de ${r.copy.ships} barcos. Sustituye al registro actual, que queda guardado al lado como «cruceros-antes-de-restaurar.sqlite». Las escalas posteriores a la copia vuelven en la siguiente consulta al puerto.`,
      '<p class="fineprint">Úsalo si el registro se dañó o perdiste las fichas de barcos que habías anotado.</p>',
      async () => {
        cruiseDash = await request("/api/cruises", { type: "restore" });
        cruiseRange = null;
        await loadCruises();
        toast("Registro de cruceros restaurado desde la copia.");
        return true;
      },
      "Restaurar",
    );
    return;
  }
  if (name === "cruiseSyncs") {
    const r = await request("/api/cruises/syncs");
    modal(
      "Sincronizaciones con el puerto",
      "Las últimas consultas: cuánto tardaron y qué trajeron.",
      `<div class="table-scroll"><table class="report-table"><thead><tr><th>Cuándo</th><th>Tipo</th><th>Duración</th><th>Escalas</th><th>Nuevas</th><th>Cambiadas</th><th>Retiradas</th><th>Rechazadas</th><th>Resultado</th></tr></thead><tbody>${r.syncs.map((x) => `<tr><td>${esc(cruiseStamp(x.started_at))}</td><td>${esc(x.kind)}</td><td>${num(x.duration_ms / 1000)} s</td><td>${x.fetched}</td><td>${x.created}</td><td>${x.updated}</td><td>${x.withdrawn}</td><td>${x.rejected}</td><td>${esc(x.error || "Correcta")}${x.notes ? `<small class="muted">${esc(x.notes)}</small>` : ""}</td></tr>`).join("")}</tbody></table></div>`,
      async () => true,
      "Cerrar",
    );
    return;
  }
  if (name === "cruiseThresholds") {
    const d = cruiseDash || (await request("/api/cruises"));
    const t = d.thresholds;
    modal(
      "Umbrales del impacto potencial",
      "Pasajeros declarados que coinciden a la vez en puerto. Por debajo del primero el día es Bajo. Ajústalos cuando conozcas cómo responde tu local.",
      field(
        "Medio a partir de",
        "medium",
        t.medium,
        "number",
        'min="1" max="100000" step="1" required',
      ) +
        field(
          "Alto a partir de",
          "high",
          t.high,
          "number",
          'min="1" max="100000" step="1" required',
        ) +
        field(
          "Muy alto a partir de",
          "veryHigh",
          t.veryHigh,
          "number",
          'min="1" max="100000" step="1" required',
        ),
      async (f) => {
        cruiseDash = await request("/api/cruises", {
          type: "thresholds",
          medium: Number(f.get("medium")),
          high: Number(f.get("high")),
          veryHigh: Number(f.get("veryHigh")),
        });
        cruiseRange = null;
        await loadCruises();
        await reloadState();
        toast("Umbrales guardados.");
        return true;
      },
    );
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
      ) +
        (window.gelato?.pickFolder
          ? `<div class="setting-actions">${btn("Elegir con el explorador…", "pickFolder", "secondary", 'data-purpose="backup" data-target="dir"')}</div>`
          : '<p class="fineprint">Escribe la ruta tal como aparece en el explorador de archivos.</p>'),
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
