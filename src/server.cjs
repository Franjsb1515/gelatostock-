const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, timingSafeEqual, scryptSync } = require("node:crypto");
const { identifySupplier } = require("../build/identify.js");
const { interpretReply } = require("../build/messages.js");
const {
  orderMessage,
  recipeBalance,
  weeklyReport,
  weekStart,
  priceAlerts,
  countStatus,
  orderReminders,
  defaultOrderTemplate,
  salesHistory,
  wasteReasonLabels,
  localDate,
} = require("../build/domain.js");
const { recognizeLocal } = require("./ocr.cjs");
const { WhatsAppConnection } = require("./whatsapp.cjs");
const { LocalAI } = require("./ai.cjs");
const { appendLog } = require("./logs.cjs");
const { csvCell } = require("./csv.cjs");
const { CruiseService } = require("./cruises/service.cjs");
const { defaultThresholds, addDays } = require("../build/cruises.js");
const { ContextService } = require("./context/service.cjs");
const {
  salesByImpact,
  dailySalesKg,
  MIN_DAYS_PER_LEVEL,
} = require("../build/context.js");
const version = require("../package.json").version;
const { Store } = require("../build/store.js");
function createApp({
  dataDir = process.env.GELATO_DATA_DIR || path.join(__dirname, "..", "data"),
  port = 0,
  // Newest movements/activity sent to the UI per response; older rows come from /api/history.
  historyLimit = Number(process.env.GELATO_HISTORY_LIMIT) || 300,
  // Pause between two orders of a batch send, so WhatsApp never sees a burst.
  batchDelayMs = Number(process.env.GELATO_BATCH_DELAY_MS) || 4000,
  // Cruise source adapter: injectable for tests; the automatic sync never runs under node:test.
  cruiseProvider,
  // Weather and holiday adapters, injectable for tests ({ weather, holidays }).
  contextProviders,
  cruiseAuto = !process.env.NODE_TEST_CONTEXT &&
    process.env.GELATO_CRUISES_AUTO !== "0",
} = {}) {
  const store = new Store(dataDir);
  // Daily automatic copy (data + photos) with a bounded history of automatic files only.
  const backupDir = path.join(dataDir, "backups");
  const isBackupFile = (f) => /^gelatostock-\d+-[0-9a-f-]{36}\.json$/.test(f);
  const byStamp = (a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]);
  // Optional second folder (USB, OneDrive, NAS…): every backup is copied there too, with the
  // same retention. Losing the main disk then costs at most one day.
  const secondaryInfo = { dir: "", last: null, error: "" };
  const copyToSecondary = (file) => {
    const dir = store.setting("backup_dir_secondary") || "";
    secondaryInfo.dir = dir;
    if (!dir) {
      secondaryInfo.error = "";
      return;
    }
    try {
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, path.basename(file));
      if (!fs.existsSync(target)) fs.copyFileSync(file, target);
      for (const f of fs
        .readdirSync(dir)
        .filter(isBackupFile)
        .sort(byStamp)
        .slice(0, -30))
        fs.unlinkSync(path.join(dir, f));
      secondaryInfo.last = new Date().toISOString();
      secondaryInfo.error = "";
    } catch (e) {
      secondaryInfo.error =
        "No se pudo copiar a la carpeta secundaria: " + String(e.message || e);
    }
  };
  const backupInfo = { last: null, warning: "", secondary: secondaryInfo };
  const autoBackup = () => {
    try {
      fs.mkdirSync(backupDir, { recursive: true });
      const own = () =>
        fs.readdirSync(backupDir).filter(isBackupFile).sort(byStamp);
      const files = own();
      const last = files.length
        ? Number(files[files.length - 1].split("-")[1])
        : 0;
      if (Date.now() - last > 24 * 3600 * 1000) {
        const created = store.backup();
        for (const f of own().slice(0, -30))
          fs.unlinkSync(path.join(backupDir, f));
        backupInfo.last = new Date().toISOString();
        copyToSecondary(created);
        // The cruise registry rides along: one rolling copy here and in the secondary folder.
        try {
          const second = store.setting("backup_dir_secondary");
          for (const copy of [
            cruises.repo.backupTo(backupDir),
            context.backupTo(backupDir),
          ])
            if (second)
              fs.copyFileSync(copy, path.join(second, path.basename(copy)));
        } catch (e) {
          appendLog(
            path.join(dataDir, "runtime", "logs", "cruceros.log"),
            "copia del registro de cruceros: " + String(e?.message || e),
          );
        }
      } else {
        backupInfo.last = new Date(last).toISOString();
        copyToSecondary(path.join(backupDir, files[files.length - 1]));
      }
      backupInfo.warning = "";
    } catch (e) {
      backupInfo.warning =
        "No se pudo crear la copia automática: " + String(e.message || e);
    }
  };
  setImmediate(autoBackup);
  const backupTimer = setInterval(autoBackup, 6 * 3600 * 1000);
  backupTimer.unref();
  // Recipe lock: a local password hides recipes and blocks recipe/production actions
  // until unlocked (30 min). It protects the screen, not the disk.
  const lock = { unlockedUntil: 0, failures: 0 };
  const lockEnabled = () => !!store.setting("recipes_lock");
  const unlocked = () => !lockEnabled() || Date.now() < lock.unlockedUntil;
  const hashPassword = (password, salt = randomBytes(16).toString("hex")) =>
    "scrypt$" + salt + "$" + scryptSync(password, salt, 32).toString("hex");
  const checkPassword = (password) => {
    const stored = store.setting("recipes_lock") || "";
    const [, salt, hex] = stored.split("$");
    if (!salt || !hex) return false;
    const candidate = scryptSync(password, salt, 32);
    return timingSafeEqual(candidate, Buffer.from(hex, "hex"));
  };
  const validPassword = (p) =>
    typeof p === "string" && p.length >= 6 && p.length <= 100;
  const lockInfo = () => ({ enabled: lockEnabled(), unlocked: unlocked() });
  const redact = (state) =>
    unlocked()
      ? {
          ...state,
          // Computed in core from the ingredient sheets; shown in the recipe book.
          recipes: state.recipes.map((r) => ({
            ...r,
            balance: recipeBalance(state, r),
          })),
        }
      : {
          ...state,
          recipes: state.recipes.map((r) => ({
            ...r,
            ingredients: [],
            note: "",
            locked: true,
          })),
          productions: state.productions.map((p) => ({ ...p, lines: [] })),
        };
  const lockedActions = new Set([
    "recipe",
    "deleteRecipe",
    "produce",
    "applyProduction",
    "discardProduction",
    "voidProduction",
  ]);
  // Business day: a shop that closes at 2:00 is still living «yesterday» until this hour.
  const dayChangeHour = () => {
    const v = Number(store.setting("day_change_hour"));
    return Number.isInteger(v) && v >= 0 && v <= 8 ? v : 5;
  };
  // Weekly (or N days) cleanup of activity notes and WhatsApp conversations; movements stay.
  const retentionDays = () => Number(store.setting("retention_days") || 0);
  // Guided counts: a zone is due when its oldest count is older than this (0 = off).
  const orderTemplate = () =>
    store.setting("order_template") || defaultOrderTemplate;
  const countDays = () => {
    const v = store.setting("count_days");
    return v === undefined ? 7 : Number(v);
  };
  const purgeNow = () => {
    const days = retentionDays();
    if (!(days > 0)) return { skipped: true };
    const before = new Date(Date.now() - days * 86400000).toISOString();
    const s = store.load();
    const removable = Math.min(
      s.activity.filter((a) => a.at < before).length,
      Math.max(0, s.activity.length - 50),
    );
    if (removable > 0) store.dispatch({ type: "purge", before, keep: 50 });
    const channel = whatsapp.store.purge(before);
    return { activity: removable, ...channel, before };
  };
  const autoPurge = () => {
    try {
      purgeNow();
    } catch (e) {
      whatsapp.log("limpieza automática falló: " + String(e?.message || e));
    }
  };
  setTimeout(autoPurge, 5000).unref();
  const purgeTimer = setInterval(autoPurge, 6 * 3600 * 1000);
  purgeTimer.unref();
  // Cruise calls at Palma (public open data). Read-only, optional, and the only outbound query.
  // Impact thresholds are the user's: stored as a setting, never hidden in code.
  const cruiseThresholds = () => {
    try {
      const t = JSON.parse(store.setting("cruise_thresholds") || "null");
      if (t && t.medium > 0 && t.high > t.medium && t.veryHigh > t.high)
        return t;
    } catch {
      // A damaged setting falls back to the documented defaults.
    }
    return defaultThresholds;
  };
  const cruises = new CruiseService(dataDir, {
    ...(cruiseProvider ? { provider: cruiseProvider } : {}),
    thresholds: cruiseThresholds,
    log: (line) =>
      appendLog(path.join(dataDir, "runtime", "logs", "cruceros.log"), line),
  });
  const cruisesOn = () => store.setting("cruises_off") !== "1";
  // Day context (weather forecast, official holidays, the user's own events). Same switch as the
  // cruise query: one setting turns off every outbound read.
  const context = new ContextService(dataDir, {
    ...(contextProviders || {}),
    log: (line) =>
      appendLog(path.join(dataDir, "runtime", "logs", "cruceros.log"), line),
  });
  // The timer only asks «is it due?»: intervals and backoff live in the service.
  const autoCruises = () => {
    if (cruisesOn()) {
      cruises.tick().catch(() => {});
      context.sync().catch(() => {});
    }
  };
  let cruiseTimer = null;
  if (cruiseAuto) {
    setTimeout(autoCruises, 8000).unref();
    cruiseTimer = setInterval(autoCruises, 10 * 60 * 1000);
    cruiseTimer.unref();
  }
  const cruiseInfo = () => {
    if (!cruisesOn()) return { enabled: false, updatedAt: null, today: null };
    const status = cruises.status();
    return {
      enabled: true,
      updatedAt: status.updatedAt,
      state: status.state,
      today: status.updatedAt ? cruises.brief(cruises.dashboard().today) : null,
    };
  };
  // The UI receives only the newest rows of the two unbounded tables; totals travel apart.
  const trimHistory = (state) => ({
    ...state,
    movements: state.movements.slice(0, historyLimit),
    activity: state.activity.slice(0, historyLimit),
  });
  const envelope = (state, extra = {}) => ({
    state: redact(trimHistory(state)),
    history: {
      limit: historyLimit,
      movements: state.movements.length,
      activity: state.activity.length,
    },
    dataDir,
    storage: "SQLite",
    archiveWarning: store.archiveWarning,
    version,
    backup: {
      ...backupInfo,
      stale:
        !backupInfo.last ||
        Date.now() - Date.parse(backupInfo.last) > 48 * 3600 * 1000,
    },
    lock: lockInfo(),
    retentionDays: retentionDays(),
    countDays: countDays(),
    dayChangeHour: dayChangeHour(),
    orderTemplate: orderTemplate(),
    cruises: cruiseInfo(),
    alerts: {
      prices: priceAlerts(state, 30),
      counts: countStatus(state, countDays()),
      orders: orderReminders(state),
    },
    ...extra,
  });
  const ai = new LocalAI();
  const aiLog = (line) =>
    appendLog(path.join(dataDir, "runtime", "logs", "ia.log"), line);
  const whatsapp = new WhatsAppConnection(dataDir, store);
  whatsapp.ocr = (data) => recognizeLocal(data);
  const token = randomBytes(32).toString("hex");
  const sameToken = (value) =>
    typeof value === "string" &&
    value.length === token.length &&
    timingSafeEqual(Buffer.from(value), Buffer.from(token));
  // Rules only: category, resolved date and "needs reading" for each imported message.
  // One batch of order sends at a time; the UI polls this while it runs.
  const batch = {
    running: false,
    total: 0,
    done: 0,
    results: [],
    startedAt: null,
    finishedAt: null,
  };
  const batchItems = (state) =>
    state.orders
      .filter((o) => o.status === "pending")
      .map((o) => {
        const supplier = state.suppliers.find((x) => x.id === o.supplier);
        const connected = whatsapp.status === "connected";
        const hasPhone = !!supplier?.whatsapp;
        const authorized =
          hasPhone &&
          !!whatsapp.account &&
          !!whatsapp.store.allowed(whatsapp.account, supplier.whatsapp);
        const already = !!whatsapp.store.sentFor(o.id);
        const reason = already
          ? "Ya se envió por WhatsApp."
          : !hasPhone
            ? supplier?.web
              ? "Sin WhatsApp: proveedor con web de compra."
              : "El proveedor no tiene WhatsApp en su ficha."
            : !connected
              ? "WhatsApp no está conectado."
              : !authorized
                ? "Chat no autorizado para la cuenta conectada."
                : "";
        return {
          order: o.id,
          number: o.number,
          supplier: supplier?.name || "",
          to: supplier?.whatsapp || "",
          web: supplier?.web || "",
          text: orderMessage(state, o.id, orderTemplate()),
          sendable: !reason,
          reason,
        };
      });
  const runBatch = async (queue) => {
    batch.running = true;
    batch.total = queue.length;
    batch.done = 0;
    batch.results = [];
    batch.startedAt = new Date().toISOString();
    batch.finishedAt = null;
    for (const [i, item] of queue.entries()) {
      if (item.error) {
        batch.results.push({
          order: item.order,
          number: item.number,
          ok: false,
          error: item.error,
        });
      } else {
        try {
          const sent = await whatsapp.send({
            phone: item.phone,
            text: item.text,
            order: item.order,
          });
          store.dispatch({
            type: "send",
            order: item.order,
            dispatch: {
              channel: "whatsapp",
              to: sent.recipient,
              messageId: sent.id,
              at: new Date().toISOString(),
              text: item.text,
            },
          });
          batch.results.push({
            order: item.order,
            number: item.number,
            ok: true,
            to: sent.recipient,
          });
        } catch (e) {
          batch.results.push({
            order: item.order,
            number: item.number,
            ok: false,
            error: String(e.message || e),
          });
        }
      }
      batch.done = i + 1;
      if (i < queue.length - 1)
        await new Promise((r) => setTimeout(r, batchDelayMs));
    }
    batch.running = false;
    batch.finishedAt = new Date().toISOString();
    whatsapp.log(
      `lote terminado: ${batch.results.filter((r) => r.ok).length}/${batch.total} pedidos enviados`,
    );
  };
  const annotate = (view) => ({
    ...view,
    batch,
    messages: (view.messages || []).map((m) => ({
      ...m,
      interpretation: m.text ? interpretReply(m.text, m.at) : undefined,
    })),
  });
  const server = http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const json = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(value));
    };
    if (req.headers.host !== new URL(origin).host) {
      json(403, { error: "Origen inválido." });
      return;
    }
    const u = new URL(req.url, origin);
    const authenticated = (req.headers.cookie || "")
      .split("; ")
      .some((c) => c.startsWith("gelato=") && sameToken(c.slice(7)));
    if (u.pathname === "/" && req.method === "GET") {
      const key = u.searchParams.get("key");
      if (key !== null && !sameToken(key)) {
        json(403, { error: "Abrí la aplicación desde su acceso de inicio." });
        return;
      }
      if (key !== null) {
        // Bootstrap: set the session cookie and drop the key from the visible URL.
        res.writeHead(302, {
          "Set-Cookie": `gelato=${token}; HttpOnly; SameSite=Strict; Path=/`,
          Location: "/",
          "Cache-Control": "no-store",
        });
        res.end();
        return;
      }
      if (!authenticated) {
        json(403, { error: "Abrí la aplicación desde su acceso de inicio." });
        return;
      }
    } else if (!authenticated) {
      json(403, { error: "Sesión local no autorizada." });
      return;
    }
    if (u.pathname === "/api/whatsapp" && req.method === "GET") {
      json(200, annotate(whatsapp.view(u.searchParams.get("account"))));
      return;
    }
    if (u.pathname === "/api/state" && req.method === "GET") {
      json(200, envelope(store.load()));
      return;
    }
    if (u.pathname.startsWith("/api/cruises") && req.method === "GET") {
      // Read-only views over the local registry; nothing here talks to the port.
      try {
        const q = (k) => u.searchParams.get(k) || "";
        if (u.pathname === "/api/cruises")
          json(200, {
            enabled: cruisesOn(),
            auto: cruiseAuto,
            ...cruises.dashboard(),
          });
        else if (u.pathname === "/api/cruises/range")
          json(200, cruises.range(q("from"), q("to")));
        else if (u.pathname === "/api/cruises/day")
          json(200, cruises.day(q("day")));
        else if (u.pathname === "/api/cruises/call") {
          const call = cruises.call(q("id").slice(0, 40));
          if (call) json(200, call);
          else json(404, { error: "Escala desconocida." });
        } else if (u.pathname === "/api/cruises/search")
          json(
            200,
            cruises.search({
              q: q("q").slice(0, 60),
              status: [
                "Solicitado",
                "Concedido",
                "Iniciado",
                "Finalizado",
                "withdrawn",
              ].includes(q("status"))
                ? q("status")
                : "",
              from: /^\d{4}-\d{2}-\d{2}$/.test(q("from")) ? q("from") : "",
              to: /^\d{4}-\d{2}-\d{2}$/.test(q("to")) ? q("to") : "",
              limit: 100,
              offset: Number(q("offset")) || 0,
            }),
          );
        else if (u.pathname === "/api/cruises/context")
          json(200, context.range(q("from"), q("to")));
        else if (u.pathname === "/api/cruises/sales") {
          // Registered sales next to that day's impact level. Facts side by side, no correlation.
          const sales = dailySalesKg(store.load().movements);
          const days = [...sales.keys()].sort();
          const rows = days.map((day) => ({
            day,
            salesKg: sales.get(day),
            impact: cruises.brief(day).impact,
          }));
          json(200, {
            minDays: MIN_DAYS_PER_LEVEL,
            daysWithSales: rows.length,
            first: days[0] || null,
            last: days.at(-1) || null,
            levels: salesByImpact(rows),
          });
        } else if (u.pathname === "/api/cruises/copy")
          json(200, { copy: cruises.copyInfo(backupDir) });
        else if (u.pathname === "/api/cruises/syncs")
          json(200, {
            syncs: cruises.repo.lastSyncs(15),
            status: cruises.status(),
          });
        else json(404, { error: "No encontrado." });
      } catch (e) {
        json(400, { error: String(e?.message || e) });
      }
      return;
    }
    if (u.pathname === "/api/sales" && req.method === "GET") {
      // Day closes of finished product (sales and waste) from the full state, by business day.
      const days = Math.min(
        365,
        Math.max(7, Number(u.searchParams.get("days")) || 30),
      );
      const to = localDate(new Date());
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      json(200, {
        ...salesHistory(store.load(), localDate(start), to),
        reasons: wasteReasonLabels,
        tomorrow:
          cruisesOn() && cruises.status().updatedAt
            ? cruises.brief(addDays(cruises.dashboard().today, 1))
            : null,
      });
      return;
    }
    if (u.pathname === "/api/report" && req.method === "GET") {
      // Weekly summary from the full state; the UI only prints it.
      const week = u.searchParams.get("week") || weekStart(new Date());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
        json(400, { error: "Semana inválida." });
        return;
      }
      const report = weeklyReport(
        store.load(),
        weekStart(new Date(week + "T12:00:00")),
      );
      // Cruise facts side by side with sales. No correlation is computed: there is no history yet.
      json(200, {
        ...report,
        cruises: cruisesOn()
          ? report.days.map((d) => cruises.brief(d.date))
          : null,
        context: cruisesOn()
          ? context.range(report.days[0].date, report.days.at(-1).date).days
          : null,
      });
      return;
    }
    if (u.pathname === "/api/history" && req.method === "GET") {
      // Older movements/activity on demand (newest first, same order as the state).
      const kind = u.searchParams.get("kind");
      if (!["movements", "activity"].includes(kind)) {
        json(400, { error: "Historial desconocido." });
        return;
      }
      const offset = Math.max(0, Number(u.searchParams.get("offset")) || 0);
      const limit = Math.min(
        1000,
        Math.max(1, Number(u.searchParams.get("limit")) || historyLimit),
      );
      const rows = store.load()[kind];
      json(200, {
        kind,
        offset,
        total: rows.length,
        items: rows.slice(offset, offset + limit),
      });
      return;
    }
    if (
      req.method === "POST" &&
      [
        "/api/ai",
        "/api/ai/cancel",
        "/api/ai/chat",
        "/api/ai/message",
        "/api/action",
        "/api/backup",
        "/api/cruises",
        "/api/export",
        "/api/lock",
        "/api/maintenance",
        "/api/restore",
        "/api/identify",
        "/api/whatsapp",
        "/api/ocr",
      ].includes(u.pathname)
    ) {
      if (
        req.headers.origin !== origin ||
        !String(req.headers["content-type"]).startsWith("application/json")
      ) {
        json(403, { error: "Solicitud no autorizada." });
        return;
      }
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (
            size >
            (u.pathname.startsWith("/api/ai")
              ? 20000
              : u.pathname === "/api/ocr"
                ? 8_100_000
                : u.pathname === "/api/identify"
                  ? 100_000
                  : 100_000_000)
          )
            throw Error("Archivo demasiado grande (máximo 100 MB).");
          chunks.push(chunk);
        }
        const data = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        if (u.pathname === "/api/ai/cancel") {
          await ai.cancel();
          json(200, { cancelled: true });
          return;
        }
        if (u.pathname === "/api/ai") {
          // Local timing log (no text) to diagnose slow readings on this machine.
          const startedAt = Date.now();
          try {
            const result = await ai.analyze(data);
            aiLog(
              `analisis modo=${String(data.mode || "careful")} chars=${String(data.text || "").length} ms=${Date.now() - startedAt} tipo=${result.tipo}`,
            );
            json(200, result);
          } catch (e) {
            aiLog(
              `analisis ERROR ms=${Date.now() - startedAt} ${String(e.message || e).slice(0, 120)}${e.detail ? " · causa: " + String(e.detail).slice(0, 300) : ""}`,
            );
            throw e;
          }
          return;
        }
        if (u.pathname === "/api/ai/chat") {
          json(200, await ai.chat(data));
          return;
        }
        if (u.pathname === "/api/ai/message") {
          // The model only proposes a category; the annotation never touches stock or orders.
          const message = store
            .load()
            .messages.find((m) => m.id === String(data.id || ""));
          if (!message) throw Error("Mensaje inexistente.");
          const reading = await ai.readReply(message.text);
          const state = store.dispatch({
            type: "aiNote",
            id: message.id,
            category: reading.category,
            status: reading.status,
            model: reading.model,
          });
          json(200, envelope(state, { reading }));
          return;
        }
        if (u.pathname === "/api/whatsapp") {
          if (data.type === "backup") {
            json(200, { path: whatsapp.store.backup() });
            return;
          }
          if (data.type === "preview" || data.type === "send") {
            const state = store.load();
            const order = state.orders.find(
              (o) => o.id === String(data.order || ""),
            );
            if (!order) throw Error("Pedido inexistente.");
            if (order.status !== "pending")
              throw Error("Solo se envían pedidos pendientes.");
            const supplier = state.suppliers.find(
              (x) => x.id === order.supplier,
            );
            if (!supplier?.whatsapp)
              throw Error(
                "El proveedor no tiene WhatsApp en su ficha. Añadilo en Proveedores.",
              );
            const text = orderMessage(state, order.id, orderTemplate());
            if (data.type === "preview") {
              json(200, {
                text,
                to: supplier.whatsapp,
                label: supplier.name,
                connected: whatsapp.status === "connected",
                authorized:
                  !!whatsapp.account &&
                  !!whatsapp.store.allowed(whatsapp.account, supplier.whatsapp),
              });
              return;
            }
            // The person authorizes this exact text; anything else is refused.
            if (data.text !== text)
              throw Error(
                "El texto cambió desde la vista previa. Volvé a abrir el envío.",
              );
            const sent = await whatsapp.send({
              phone: supplier.whatsapp,
              text,
              order: order.id,
            });
            const next = store.dispatch({
              type: "send",
              order: order.id,
              dispatch: {
                channel: "whatsapp",
                to: sent.recipient,
                messageId: sent.id,
                at: sent.at,
                text,
              },
            });
            json(200, envelope(next, { sent }));
            return;
          }
          if (data.type === "recover") {
            const imported = await whatsapp.recover();
            json(200, { ...annotate(whatsapp.view()), imported });
            return;
          }
          if (data.type === "autoconnect") {
            whatsapp.autoConnect = data.enabled === true;
            json(200, annotate(whatsapp.view()));
            return;
          }
          if (data.type === "batchPreview") {
            json(200, {
              connected: whatsapp.status === "connected",
              items: batchItems(store.load()),
            });
            return;
          }
          if (data.type === "sendBatch") {
            // The person selected the orders and saw each text; the app sends them one by one.
            if (batch.running) {
              json(409, {
                error: "Ya hay un envío en curso. Espera a que termine.",
              });
              return;
            }
            if (whatsapp.status !== "connected")
              throw Error("WhatsApp no está conectado.");
            const wanted = Array.isArray(data.orders)
              ? data.orders.slice(0, 50)
              : [];
            if (!wanted.length) throw Error("No hay pedidos seleccionados.");
            const items = batchItems(store.load());
            const queue = wanted.map((w) => {
              const item = items.find(
                (x) => x.order === String(w?.order || ""),
              );
              if (!item)
                return {
                  order: String(w?.order || ""),
                  number: "?",
                  error: "Pedido no pendiente.",
                };
              if (!item.sendable) return { ...item, error: item.reason };
              if (w.text !== item.text)
                return {
                  ...item,
                  error: "El texto cambió desde la vista previa.",
                };
              return { ...item, phone: item.to };
            });
            runBatch(queue);
            json(200, { started: true, total: queue.length });
            return;
          }
          if (data.type === "reply") {
            // Reply to a supplier message from the inbox; the person wrote or edited the text.
            const message = store
              .load()
              .messages.find((m) => m.id === String(data.id || ""));
            if (!message) throw Error("Mensaje inexistente.");
            if (message.channel !== "whatsapp" || !message.sender)
              throw Error(
                "Este mensaje no llegó por WhatsApp: no se puede responder desde aquí.",
              );
            const text = String(data.text || "").trim();
            const sent = await whatsapp.send({ phone: message.sender, text });
            const next = store.dispatch({
              type: "decide",
              id: message.id,
              decision: ("Respondido por WhatsApp: " + text).slice(0, 300),
            });
            json(200, envelope(next, { sent }));
            return;
          }
          if (data.type === "sendText") {
            const sent = await whatsapp.send({
              phone: String(data.phone || ""),
              text: String(data.text || ""),
            });
            json(200, { ...annotate(whatsapp.view()), sent });
            return;
          }
          if (data.type === "connect") await whatsapp.connect();
          else if (data.type === "disconnect") await whatsapp.disconnect();
          else if (data.type === "allow") whatsapp.allow(data);
          else throw Error("Acción WhatsApp desconocida.");
          json(200, annotate(whatsapp.view()));
          return;
        }
        if (u.pathname === "/api/identify") {
          json(200, identifySupplier(store.load(), data));
          return;
        }
        if (u.pathname === "/api/ocr") {
          const result = await recognizeLocal(data.data);
          json(200, {
            ...result,
            detection: identifySupplier(store.load(), { text: result.text }),
          });
          return;
        }
        if (u.pathname === "/api/lock") {
          if (data.type === "set") {
            if (lockEnabled() && !checkPassword(String(data.current || "")))
              throw Error("La contraseña actual no es correcta.");
            if (!validPassword(data.password))
              throw Error("La contraseña debe tener entre 6 y 100 caracteres.");
            store.setSetting("recipes_lock", hashPassword(data.password));
            lock.unlockedUntil = Date.now() + 30 * 60000;
          } else if (data.type === "unlock") {
            if (!lockEnabled())
              throw Error("El recetario no tiene contraseña.");
            await new Promise((r) =>
              setTimeout(r, Math.min(5000, 300 * lock.failures)),
            );
            if (!checkPassword(String(data.password || ""))) {
              lock.failures++;
              throw Error("Contraseña incorrecta.");
            }
            lock.failures = 0;
            lock.unlockedUntil = Date.now() + 30 * 60000;
          } else if (data.type === "lock") lock.unlockedUntil = 0;
          else if (data.type === "remove") {
            if (!checkPassword(String(data.password || "")))
              throw Error("Contraseña incorrecta.");
            store.setSetting("recipes_lock", undefined);
            lock.unlockedUntil = 0;
          } else throw Error("Acción de bloqueo desconocida.");
          json(200, envelope(store.load()));
          return;
        }
        if (u.pathname === "/api/maintenance") {
          if (data.type === "backupDir") {
            const dir = String(data.dir || "").trim();
            if (dir.length > 300) throw Error("Ruta demasiado larga.");
            if (dir) {
              if (!path.isAbsolute(dir))
                throw Error(
                  "Escribe la ruta completa de la carpeta, por ejemplo E:\\CopiasGelato o C:\\Users\\tú\\OneDrive\\GelatoStock.",
                );
              const inside = path.relative(dataDir, dir);
              if (
                inside === "" ||
                (!inside.startsWith("..") && !path.isAbsolute(inside))
              )
                throw Error(
                  "La carpeta secundaria debe estar fuera de la carpeta de datos (idealmente en otro disco o en la nube).",
                );
              fs.mkdirSync(dir, { recursive: true });
              const probe = path.join(dir, ".gelatostock-prueba");
              fs.writeFileSync(probe, "ok");
              fs.unlinkSync(probe);
            }
            store.setSetting("backup_dir_secondary", dir || undefined);
            secondaryInfo.last = null;
            secondaryInfo.error = "";
            secondaryInfo.dir = dir;
            if (dir) copyToSecondary(store.backup());
            json(200, envelope(store.load()));
            return;
          }
          if (data.type === "orderTemplate") {
            const template = String(data.template || "").trim();
            if (template.length > 1000)
              throw Error("Plantilla demasiado larga.");
            if (template && !template.includes("{lineas}"))
              throw Error(
                "La plantilla debe incluir {lineas}, donde van los productos.",
              );
            store.setSetting("order_template", template || undefined);
            json(200, envelope(store.load()));
            return;
          }
          if (data.type === "cruises") {
            store.setSetting("cruises_off", data.enabled ? undefined : "1");
            json(200, envelope(store.load()));
            return;
          }
          if (data.type === "dayChange") {
            const hour = Number(data.hour);
            if (!Number.isInteger(hour) || hour < 0 || hour > 8)
              throw Error("Elige una hora entre las 0:00 y las 8:00.");
            store.setSetting("day_change_hour", String(hour));
            json(200, envelope(store.load()));
            return;
          }
          if (data.type === "countDays") {
            const days = Number(data.days);
            if (![0, 3, 7, 14, 30].includes(days))
              throw Error("Elige 0 (sin recordatorio), 3, 7, 14 o 30 días.");
            store.setSetting("count_days", String(days));
            json(200, envelope(store.load()));
            return;
          }
          if (data.type === "retention") {
            const days = Number(data.days);
            if (![0, 7, 14, 30, 90].includes(days))
              throw Error("Elige 0 (sin limpieza), 7, 14, 30 o 90 días.");
            store.setSetting("retention_days", String(days));
            json(200, envelope(store.load()));
            return;
          }
          if (data.type === "purge") {
            const result = purgeNow();
            json(200, envelope(store.load(), { purge: result }));
            return;
          }
          throw Error("Acción de mantenimiento desconocida.");
        }
        if (u.pathname === "/api/export") {
          // CSV (semicolon, UTF-8 with BOM) of products and movements for a spreadsheet.
          const s = store.load();
          const line = (cells) => cells.map(csvCell).join(";");
          const byId = new Map(s.products.map((p) => [p.id, p]));
          const products = [
            line([
              "producto",
              "detalle",
              "categoria",
              "unidad",
              "stock",
              "minimo",
              "objetivo",
              "presentacion",
              "precio_eur",
              "proveedor",
            ]),
            ...s.products.map((p) =>
              line([
                p.name,
                p.detail,
                p.category,
                p.unit,
                p.stock,
                p.min,
                p.target,
                p.pack,
                (p.price / 100).toFixed(2),
                s.suppliers.find((x) => x.id === p.supplier)?.name || "",
              ]),
            ),
          ].join("\r\n");
          const movements = [
            line([
              "fecha",
              "producto",
              "tipo",
              "cambio",
              "antes",
              "despues",
              "motivo",
            ]),
            ...s.movements.map((m) =>
              line([
                m.at,
                byId.get(m.product)?.name || m.product,
                m.kind,
                m.delta,
                m.before,
                m.after,
                m.reason,
              ]),
            ),
          ].join("\r\n");
          // Default folder inside the data dir; optionally a folder the person picked.
          let dir = path.join(dataDir, "exportaciones");
          if (data.dir) {
            const chosen = String(data.dir).trim();
            if (chosen.length > 300 || !path.isAbsolute(chosen))
              throw Error("Elige una carpeta con su ruta completa.");
            dir = chosen;
          }
          fs.mkdirSync(dir, { recursive: true });
          const stamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/[:T]/g, "-");
          const files = [
            [path.join(dir, `inventario-${stamp}.csv`), products],
            [path.join(dir, `movimientos-${stamp}.csv`), movements],
          ];
          for (const [file, body] of files)
            fs.writeFileSync(file, "\ufeff" + body + "\r\n");
          json(200, { files: files.map(([f]) => f) });
          return;
        }
        if (u.pathname === "/api/cruises") {
          if (!cruisesOn())
            throw Error(
              "La consulta de cruceros está desactivada en Configuración.",
            );
          if (data.type === "ship") {
            json(200, {
              ship: cruises.setShipInfo(String(data.key || ""), data),
            });
            return;
          }
          if (data.type === "thresholds") {
            const t = {
              medium: Number(data.medium),
              high: Number(data.high),
              veryHigh: Number(data.veryHigh),
            };
            if (
              !Object.values(t).every(
                (n) => Number.isInteger(n) && n > 0 && n <= 100000,
              ) ||
              !(t.medium < t.high && t.high < t.veryHigh)
            )
              throw Error(
                "Los umbrales deben ser enteros crecientes: medio < alto < muy alto.",
              );
            store.setSetting("cruise_thresholds", JSON.stringify(t));
            json(200, {
              enabled: true,
              auto: cruiseAuto,
              ...cruises.dashboard(),
            });
            return;
          }
          if (data.type === "event") {
            context.addEvent(data);
            json(200, { ok: true });
            return;
          }
          if (data.type === "eventDelete") {
            context.deleteEvent(data.id);
            json(200, { ok: true });
            return;
          }
          if (data.type === "restore") {
            const info = cruises.restoreCopy(backupDir);
            json(200, {
              restored: info,
              enabled: true,
              auto: cruiseAuto,
              ...cruises.dashboard(),
            });
            return;
          }
          await Promise.all([
            cruises.sync("manual"),
            context.sync({ force: true }),
          ]);
          json(200, {
            enabled: true,
            auto: cruiseAuto,
            ...cruises.dashboard(),
          });
          return;
        }
        if (u.pathname === "/api/backup") {
          const created = store.backup();
          backupInfo.last = new Date().toISOString();
          copyToSecondary(created);
          json(200, {
            path: created,
            secondary: secondaryInfo.dir
              ? secondaryInfo.error ||
                path.join(secondaryInfo.dir, path.basename(created))
              : "",
          });
          return;
        }
        if (u.pathname === "/api/restore") {
          if (!Number.isInteger(data.revision))
            throw Error("Falta la versión de la restauración.");
          store.restore(data.backup, data.revision);
        } else {
          if (
            !Number.isInteger(data.revision) ||
            typeof data.operationId !== "string"
          )
            throw Error("Falta la versión o el identificador de la operación.");
          if (lockedActions.has(String(data.type)) && !unlocked())
            throw Error(
              "Recetas protegidas: desbloqueá el recetario con la contraseña.",
            );
          store.dispatch(data);
        }
        json(200, envelope(store.load()));
      } catch (e) {
        json(/cambiaron|ya corresponde/.test(e.message) ? 409 : 400, {
          error: e.message,
        });
      }
      return;
    }
    if (
      req.method === "GET" &&
      /^\/api\/photos\/[a-zA-Z0-9-]+$/.test(u.pathname)
    ) {
      try {
        const { bytes, mime } = store.photo(u.pathname.split("/").pop());
        res.writeHead(200, {
          "Content-Type": mime,
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=3600",
        });
        res.end(bytes);
      } catch (e) {
        json(404, { error: e.message });
      }
      return;
    }
    const assets = {
      "/": "index.html",
      "/ui/core.js": "ui/core.js",
      "/ui/whatsapp.js": "ui/whatsapp.js",
      "/ui/views.js": "ui/views.js",
      "/ui/views-orders.js": "ui/views-orders.js",
      "/ui/views-production.js": "ui/views-production.js",
      "/ui/views-messages.js": "ui/views-messages.js",
      "/ui/views-documents.js": "ui/views-documents.js",
      "/ui/views-ai.js": "ui/views-ai.js",
      "/ui/views-sales.js": "ui/views-sales.js",
      "/ui/views-weekly.js": "ui/views-weekly.js",
      "/ui/views-cruises.js": "ui/views-cruises.js",
      "/ui/forms.js": "ui/forms.js",
      "/ui/actions.js": "ui/actions.js",
      "/ui/events.js": "ui/events.js",
      "/ui/guide.js": "ui/guide.js",
      "/ui/actions-extended.js": "ui/actions-extended.js",
      "/styles.css": "styles.css",
    };
    if (req.method !== "GET" || !assets[u.pathname]) {
      json(404, { error: "No encontrado." });
      return;
    }
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()",
    );
    res.setHeader(
      "Content-Type",
      u.pathname.endsWith(".js")
        ? "text/javascript; charset=utf-8"
        : u.pathname.endsWith(".css")
          ? "text/css; charset=utf-8"
          : "text/html; charset=utf-8",
    );
    res.end(fs.readFileSync(path.join(__dirname, assets[u.pathname])));
  });
  return new Promise((resolve, reject) => {
    server.once("error", (error) => {
      store.close();
      reject(error);
    });
    server.once("close", () => {
      clearInterval(backupTimer);
      clearInterval(purgeTimer);
      if (cruiseTimer) clearInterval(cruiseTimer);
      cruises.close();
      context.close();
      ai.cancel().catch(() => {});
      store.close();
      whatsapp.close().catch(() => {});
    });
    server.listen(port, "127.0.0.1", () =>
      resolve({
        server,
        store,
        whatsapp,
        ai,
        url: `http://127.0.0.1:${server.address().port}/?key=${token}`,
      }),
    );
  });
}
if (require.main === module)
  createApp({ port: Number(process.env.PORT || 4317) })
    .then(({ url }) => console.log(url))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
module.exports = { createApp };
