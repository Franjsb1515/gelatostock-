// Fotos de prueba del Calendario: lo que dice cada una, cómo se dibuja y qué debe proponer la app.
// Son SINTÉTICAS (hechas por la app con fuentes del equipo, también de imitación de letra a mano):
// sirven para comprobar que la lectura no falla ni inventa, no para prometer aciertos con fotos
// reales. «Hoy» de la evaluación: 2026-10-05. Los gelatos del estado de prueba: Chocolate 70 %
// (receta «Gelato de chocolate»), Pistacho, Fior di latte y Stracciatella.
const today = "2026-10-05";
// style: printed (impreso, foto recta), phone (foto del teléfono: ladeada, ruido), hand (letra a
// mano imitada), screen (captura de pantalla), blur (ilegible).
const cases = [
  {
    file: "01-horario-impreso.jpg",
    style: "printed",
    font: "Arial",
    table: true,
    lines: [
      "HORARIO SEMANA DEL 5 AL 11 DE OCTUBRE 2026",
      "Lunes | Cerrado",
      "Martes | 11:00 - 23:00 | Ana 10:30-17:00 | Luis 17:00-23:30",
      "Miércoles | 11:00 - 23:00 | Ana 10:30-17:00 | Luis 17:00-23:30",
      "Jueves | 11:00 - 23:00 | Marta 10:30-17:00 | Luis 17:00-23:30",
      "Viernes | 11:00 - 23:30 | Ana 10:30-17:00 | Marta 17:00-23:30",
      "Sábado | 10:00 - 23:30 | Ana 09:30-16:00 | Luis 16:00-23:30",
      "Domingo | 10:00 - 23:00 | Marta 09:30-16:00 | Luis 16:00-23:00",
    ],
    expect: {
      kind: "schedule",
      date: "2026-10-05",
      schedule: [
        { weekday: 0, closed: true },
        {
          weekday: 1,
          open: "11:00",
          close: "23:00",
          shifts: [
            ["Ana", "10:30", "17:00"],
            ["Luis", "17:00", "23:30"],
          ],
        },
        {
          weekday: 2,
          open: "11:00",
          close: "23:00",
          shifts: [
            ["Ana", "10:30", "17:00"],
            ["Luis", "17:00", "23:30"],
          ],
        },
        {
          weekday: 3,
          open: "11:00",
          close: "23:00",
          shifts: [
            ["Marta", "10:30", "17:00"],
            ["Luis", "17:00", "23:30"],
          ],
        },
        {
          weekday: 4,
          open: "11:00",
          close: "23:30",
          shifts: [
            ["Ana", "10:30", "17:00"],
            ["Marta", "17:00", "23:30"],
          ],
        },
        {
          weekday: 5,
          open: "10:00",
          close: "23:30",
          shifts: [
            ["Ana", "09:30", "16:00"],
            ["Luis", "16:00", "23:30"],
          ],
        },
        {
          weekday: 6,
          open: "10:00",
          close: "23:00",
          shifts: [
            ["Marta", "09:30", "16:00"],
            ["Luis", "16:00", "23:00"],
          ],
        },
      ],
    },
  },
  {
    file: "02-horario-sin-fecha.jpg",
    style: "phone",
    font: "Arial",
    lines: [
      "Horario de la tienda",
      "Lunes: cerrado",
      "Martes: 11:00 a 23:00",
      "Miércoles: 11:00 a 23:00",
      "Jueves: 11:00 a 23:00",
      "Viernes: 11:00 a 23:30",
      "Sábado: 10:00 a 23:30",
      "Domingo: 10:00 a 23:00",
    ],
    expect: {
      kind: "schedule",
      date: null,
      schedule: [
        { weekday: 0, closed: true },
        { weekday: 1, open: "11:00", close: "23:00", shifts: [] },
        { weekday: 2, open: "11:00", close: "23:00", shifts: [] },
        { weekday: 3, open: "11:00", close: "23:00", shifts: [] },
        { weekday: 4, open: "11:00", close: "23:30", shifts: [] },
        { weekday: 5, open: "10:00", close: "23:30", shifts: [] },
        { weekday: 6, open: "10:00", close: "23:00", shifts: [] },
      ],
    },
  },
  {
    file: "03-horario-a-mano.jpg",
    style: "hand",
    font: "Ink Free",
    lines: [
      "Turnos semana del 12 al 18 de octubre",
      "Lunes cerrado",
      "Martes 11-23  Ana 10-17  Luis 17-23",
      "Miércoles 11-23  Ana 10-17  Luis 17-23",
      "Jueves 11-23  Marta 10-17  Luis 17-23",
      "Viernes 11-23  Ana 10-17  Marta 17-23",
    ],
    expect: {
      kind: "schedule",
      date: "2026-10-12",
      schedule: [
        { weekday: 0, closed: true },
        {
          weekday: 1,
          open: "11:00",
          close: "23:00",
          shifts: [
            ["Ana", "10:00", "17:00"],
            ["Luis", "17:00", "23:00"],
          ],
        },
        {
          weekday: 2,
          open: "11:00",
          close: "23:00",
          shifts: [
            ["Ana", "10:00", "17:00"],
            ["Luis", "17:00", "23:00"],
          ],
        },
        {
          weekday: 3,
          open: "11:00",
          close: "23:00",
          shifts: [
            ["Marta", "10:00", "17:00"],
            ["Luis", "17:00", "23:00"],
          ],
        },
        {
          weekday: 4,
          open: "11:00",
          close: "23:00",
          shifts: [
            ["Ana", "10:00", "17:00"],
            ["Marta", "17:00", "23:00"],
          ],
        },
      ],
    },
  },
  {
    file: "04-cuadrante-turnos.jpg",
    style: "phone",
    font: "Calibri",
    lines: [
      "Cuadrante de turnos - semana del 19/10/2026",
      "Ana: lunes 10-17, martes 10-17, jueves 10-17",
      "Luis: martes 17-23, miércoles 17-23, viernes 17-23",
      "Marta: miércoles 10-17, viernes 10-17",
    ],
    expect: {
      kind: "schedule",
      date: "2026-10-19",
      schedule: [
        { weekday: 0, shifts: [["Ana", "10:00", "17:00"]] },
        {
          weekday: 1,
          shifts: [
            ["Ana", "10:00", "17:00"],
            ["Luis", "17:00", "23:00"],
          ],
        },
        {
          weekday: 2,
          shifts: [
            ["Luis", "17:00", "23:00"],
            ["Marta", "10:00", "17:00"],
          ],
        },
        { weekday: 3, shifts: [["Ana", "10:00", "17:00"]] },
        {
          weekday: 4,
          shifts: [
            ["Luis", "17:00", "23:00"],
            ["Marta", "10:00", "17:00"],
          ],
        },
      ],
    },
  },
  {
    file: "05-ventas-impreso.jpg",
    style: "printed",
    font: "Courier New",
    lines: [
      "CIERRE DEL DIA 03/10/2026",
      "Pistacho .............. 2,5 kg",
      "Fior di latte ......... 1,8 kg",
      "Chocolate 70% vendido 3 kg merma 0,2 kg",
      "Stracciatella ......... 1200 g",
      "Cafe solo ............. 14",
      "Total caja 412,50 EUR",
    ],
    expect: {
      kind: "sales",
      date: "2026-10-03",
      sales: {
        Pistacho: { sold: 2.5 },
        "Fior di latte": { sold: 1.8 },
        "Chocolate 70 %": { sold: 3, waste: 0.2 },
        Stracciatella: { sold: 1.2 },
      },
      unknown: 0,
    },
  },
  {
    file: "06-ventas-a-mano.jpg",
    style: "hand",
    font: "Segoe Print",
    lines: [
      "Ventas 4 oct",
      "Pistacho 2 kg",
      "Fior di latte 1,5 kg",
      "Stracciatella 900 g",
      "Mango 1 kg",
    ],
    expect: {
      kind: "sales",
      date: "2026-10-04",
      sales: {
        Pistacho: { sold: 2 },
        "Fior di latte": { sold: 1.5 },
        Stracciatella: { sold: 0.9 },
      },
      unknown: 1,
    },
  },
  {
    file: "07-factura-impresa.jpg",
    style: "printed",
    font: "Arial",
    lines: [
      "FACTURA Nº F-2026-201",
      "Gelato Italia S.L.",
      "Fecha: 02/10/2026",
      "Base de pasta de pistacho 2 x 45,00",
      "Base imponible 90,00",
      "IVA 10% 9,00",
      "TOTAL 99,00 EUR",
    ],
    expect: { kind: "document", date: "2026-10-02", supplier: "s3" },
  },
  {
    file: "08-albaran-foto.jpg",
    style: "phone",
    font: "Arial",
    lines: [
      "ALBARÁN 4471",
      "Fresco Mercado",
      "Fecha 01-10-2026",
      "Leche entera 12 L",
      "Nata para montar 6 L",
      "Recibido por: ____________",
    ],
    expect: { kind: "document", date: "2026-10-01", supplier: "s2" },
  },
  {
    file: "09-nota-a-mano.jpg",
    style: "hand",
    font: "Ink Free",
    lines: [
      "6 de octubre",
      "Viene el técnico de la vitrina a las 10.",
      "Avisar a Luis.",
    ],
    expect: { kind: "note", date: "2026-10-06", noteHas: "técnico" },
  },
  {
    file: "10-nota-pantalla.jpg",
    style: "screen",
    font: "Segoe UI",
    lines: [
      "Recordatorio",
      "Pedir conos y vasos para el fin de semana.",
      "Revisar la temperatura de la cámara.",
    ],
    expect: { kind: "note", date: null, noteHas: "conos" },
  },
  {
    file: "11-ilegible.jpg",
    style: "blur",
    font: "Arial",
    lines: ["Lunes cerrado", "Martes 11-23 Ana 10-17", "Pistacho 2 kg"],
    expect: { kind: null, date: null },
  },
  {
    file: "12-ventas-sin-fecha.jpg",
    style: "phone",
    font: "Arial",
    lines: [
      "Ventas",
      "Pistacho 3,2 kg",
      "Chocolate 70% 2 kg",
      "Fior di latte 1 kg  invitación 0,1 kg",
    ],
    expect: {
      kind: "sales",
      date: null,
      sales: {
        Pistacho: { sold: 3.2 },
        "Chocolate 70 %": { sold: 2 },
        "Fior di latte": { sold: 1, gift: 0.1 },
      },
      unknown: 0,
    },
  },
];

/** Estado de prueba: la demo con tres gelatos más, cada uno con su receta. */
function photoState(domain) {
  let s = domain.seed();
  for (const name of ["Pistacho", "Fior di latte", "Stracciatella"])
    s = domain.apply(s, {
      type: "recipe",
      name,
      yield: 1,
      createProduct: true,
      ingredients: [{ product: "p2", quantity: 0.5 }],
    });
  return s;
}

/** Compara una lectura con lo esperado: acierta, falla (con lo que difiere) e inventa. */
function score(c, r) {
  const e = c.expect;
  const problems = [];
  let invented = false;
  if (r.kind !== e.kind)
    problems.push(`apartado ${r.kind} (esperado ${e.kind})`);
  if (r.date !== e.date) {
    problems.push(`fecha ${r.date} (esperada ${e.date})`);
    if (r.date !== null) invented = true;
  }
  if (e.kind === "schedule" && r.kind === "schedule") {
    // Por día: lo que falta es «sin leer»; lo leído que no está en la foto es «inventado».
    const shifts = (d) =>
      (d?.shifts || []).map((x) =>
        (Array.isArray(x) ? x : [x.person, x.from, x.to]).join(" "),
      );
    for (let w = 0; w < 7; w++) {
      const want = e.schedule.find((d) => d.weekday === w);
      const got = r.schedule.find((d) => d.weekday === w);
      const name = "día " + w;
      for (const [k, a, b] of [
        ["cerrado", !!want?.closed, !!got?.closed],
        ["abre", want?.open || null, got?.open || null],
        ["cierra", want?.close || null, got?.close || null],
      ])
        if (a !== b) {
          problems.push(`${name} ${k}: ${b} (esperado ${a})`);
          if (b) invented = true;
        }
      const ws = shifts(want);
      const gs = shifts(got);
      for (const x of ws)
        if (!gs.includes(x)) problems.push(`${name}: sin leer el turno ${x}`);
      for (const x of gs)
        if (!ws.includes(x)) {
          problems.push(`${name}: turno leído de más ${x}`);
          invented = true;
        }
    }
  }
  if (e.kind === "sales" && r.kind === "sales") {
    const got = Object.fromEntries(
      r.sales.map((l) => [
        l.name,
        { sold: l.sold, waste: l.waste, gift: l.gift },
      ]),
    );
    for (const [name, want] of Object.entries(e.sales)) {
      const g = got[name];
      const w = { sold: 0, waste: 0, gift: 0, ...want };
      if (!g) problems.push(`falta ${name}`);
      else if (g.sold !== w.sold || g.waste !== w.waste || g.gift !== w.gift) {
        problems.push(
          `${name}: ${JSON.stringify(g)} (esperado ${JSON.stringify(w)})`,
        );
        invented = true;
      }
    }
    for (const name of Object.keys(got))
      if (!e.sales[name]) {
        problems.push(`gelato de más: ${name}`);
        invented = true;
      }
    if (r.unknown.length !== e.unknown)
      problems.push(
        `${r.unknown.length} líneas sin gelato (esperadas ${e.unknown})`,
      );
  }
  if (
    e.kind === "document" &&
    r.kind === "document" &&
    r.document?.supplier !== e.supplier
  ) {
    problems.push(`proveedor ${r.document?.supplier} (esperado ${e.supplier})`);
    if (r.document?.supplier) invented = true;
  }
  if (
    e.noteHas &&
    r.kind === "note" &&
    !r.note.toLowerCase().includes(e.noteHas)
  )
    problems.push(`la nota no dice «${e.noteHas}»`);
  return { ok: !problems.length, problems, invented };
}

module.exports = { today, cases, photoState, score };
