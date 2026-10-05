# Plan · Ficha de producción diaria (Calendario)

Origen: docs/origen/PEDIDO_FICHA_PRODUCCION_2026-10-05.md y la captura HOJA_PRODUCCION_ARTELLO_2026-10-05.png (no releer; lo necesario está aquí).

## Cómo encaja con lo que ya hay (revisado en el código, 0.51.0)
Ya existe casi todo el cálculo:
- **Producción aprobada** por día de negocio (core/domain.ts produce/applyProduction; el movimiento `output` lleva su día). Es el dato confirmado de kilos hechos y no se cuenta dos veces: un movimiento compensado no cuenta en ningún informe.
- **Cierre del día** (Producción → cierre, src/ui/views-sales.js) con dos modos: apuntar lo vendido, o pesar «lo que queda» en la cubeta; con «queda» la app calcula vendido = lo que había al terminar el día − merma − invitación − queda (core/domain.ts dailySales, `stockAtDayEnd`). Es exactamente la regla pedida, pero hoy la pesada no se guarda como medición: se convierte directamente en venta.
- **Resumen del día** (core/day.ts daySummary): por gelato al empezar, hecho, vendido, merma, invitación, ajustes y queda, con la identidad al empezar + hecho − vendido − merma − invitación + ajustes = queda, venta estimada (kilos × valor por kilo vigente ese día, core/value.ts) y «No disponible» si falta un valor. Cierre confirmado con venta real de caja aparte (confirmDay) y reapertura con motivo.
- El Calendario ya enseña esa tabla en «Gelato del día».

Lo que falta de verdad:
1. **Guardar las pesadas como medición** (peso medido, a qué hora del día y de qué sabor) sin que muevan stock por sí solas.
2. **Estimado frente a registrado**: la venta que sale de las pesadas, al lado de la venta apuntada en el cierre, con la diferencia.
3. **Resúmenes**: día anterior, semana de lunes a domingo, histórico desde el primer dato, distinguiendo «sin datos» de «cero».
4. **Gelatos y sorbetes en dos tablas** (la receta ya tiene familia: crema, sorbete, postre).
5. **Entrada en gramos o kilos** en la ficha (tu hoja usa gramos: 8000 = 8 kg).

## Lo que no encaja tal cual (dicho al usuario antes de construir)
- **Pesar dos veces es redundante**: lo que queda al cerrar hoy es lo que hay al abrir mañana (salvo lo que se estropee de noche). Tu hoja pesa una sola vez, por la mañana. Pedir las dos pesadas duplica el trabajo y crea diferencias que habría que explicar cada día.
- **La cubeta pesa**: si se pesa el pozzetto lleno, hay que restar la cubeta vacía (tara). Si no, cada kilo de acero cuenta como gelato vendido o como «diferencia».
- **Los sabores tienen que existir en la app**: hoy solo hay una receta (CHOCOLOCO); tu hoja tiene unos 40 sabores. Cada sabor necesita su gelato en el Recetario para poder producirlo y pesarlo; una receta pide al menos un ingrediente.
- **Una pesada no puede mover el stock como conteo**: un conteo es un ajuste, y la regla es que un ajuste nunca se convierte en venta. La venta solo la escribe la persona, así que la pesada se guarda como medición y la venta se apunta al confirmarla (una sola vez), igual que hoy con «lo que queda».
- La venta estimada desde pesadas es **lo que salió de la cubeta**: incluye lo que se tiró sin apuntar. Por eso merma e invitación se piden aparte y la ficha nunca llama venta a una diferencia sin explicar.

## Opciones de método (para decidir)
A. **Una pesada al día, por la mañana** (como tu hoja). La pesada de hoy cierra el día de ayer: vendido de ayer = inicial de ayer + hecho ayer − inicial de hoy − merma − invitación + ajustes. Ventaja: es tu costumbre y la tienda está tranquila. Inconveniente: la venta de ayer se conoce hoy.
B. **Una pesada al cerrar** (la de «lo que queda», que ya existe). La venta del día se conoce esa noche; la inicial de mañana es la final de hoy, sin pesar. Inconveniente: pesar al cierre, cansados.
C. **Dos pesadas** (al empezar y al terminar). Detecta lo que se pierde de noche y errores de pesada. Inconveniente: el doble de trabajo cada día.
Recomendación: A si quieres seguir como en tu hoja; B si prefieres saber la venta el mismo día. C solo si sospechas pérdidas nocturnas.

## Respuestas del usuario (2026-10-05)
1. A: una pesada al día, por la mañana.
2. En la báscula va solo el gelato (sin tara).
3. Solo nombre y tipo; él añadirá ingredientes y, en el futuro, los datos de calorías y grasas de los ingredientes.
4. Cada sabor su precio; además, un total con su precio de referencia por kilo (el del gelato más caro), ordenado para que no confunda.

Estado: hecho en 0.52.0 (fase 1 y el alta rápida de la fase 2).

## Fases (una versión por fase, tras las respuestas)
1. Pesadas como medición (datos nuevos con zod y pruebas, tara por cubeta si hace falta, g/kg), cálculo por sabor medido frente a libro, estimado frente a registrado, resúmenes día anterior/semana/histórico, ficha en el día del Calendario con gelatos y sorbetes separados, y «Apuntar como cierre» que convierte la estimación en el cierre del día (una sola vez, con ensureDayOpen).
2. Alta rápida de sabores para que tu lista entre en la app sin rehacer recetas completas (según la respuesta 3).

## Preguntas abiertas (al usuario)
1. ¿Cuándo pesas: A (por la mañana), B (al cerrar) o C (las dos)?
2. ¿Pesas la cubeta llena (hay que restar la cubeta vacía) o solo el gelato?
3. Tus ~40 sabores: ¿los damos de alta como recetas completas (ingredientes reales, para que la producción descuente stock) o primero solo el nombre y el tipo (gelato o sorbetto), y las recetas después?
4. Facturación: ¿un mismo precio por kilo para todos los sabores, o cada sabor el suyo?
