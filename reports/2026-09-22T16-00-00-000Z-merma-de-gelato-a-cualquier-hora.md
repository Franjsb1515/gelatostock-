# Sesión 048 (segunda parte) · Merma de gelato a cualquier hora · versión 0.43.0

## Encargo

Tras la auditoría 0.42.1, el usuario decidió el 2026-09-22 sobre el hallazgo pendiente: «me parece, pero yo quiero que yo pueda colocarlo cuando quiera, ya que a veces cambia el personal a mitad del día». Y añadió: «aparte existe "merma" que se puede usar para el otro día, entonces por eso no se anota como pérdida».

Lectura del encargo:
- La merma de un gelato se apunta **cuando ocurre**, no solo en el cierre del día, y tiene que contar como merma en todas partes.
- Lo que se guarda para mañana **no es merma**: en la app ya es así (sigue en stock y sale como «queda para mañana»); solo se apunta lo que se tira. Se dice ahora en el formulario y en la guía para que no haya duda.

## Qué cambia

- **Inventario → Entrada / salida → «Merma / pérdida» sobre un gelato** (un producto que sale de alguna receta) se guarda como **línea de cierre** de su día de negocio: texto «Merma del día AAAA-MM-DD · Motivo · detalle». El día lo manda el formulario (día de negocio de ahora, con la hora de cambio de Configuración); si falta, el núcleo usa el día de negocio con la hora por defecto.
- Por eso la ven igual el **resumen del día** (merma, no ajuste), el **historial** de cierres (con «Corregir» y «Eliminar»), los **informes de venta y coste**, la **Semana** y el **objetivo de merma**. «Deshacer» del cierre la compensa junto con lo demás del día.
- **Exige motivo de la lista** y **rechaza un día confirmado** («El día … está cerrado. Reábrelo…»). Esto cierra en parte el pendiente de TODO 5 sobre movimientos manuales en un día cerrado: la merma ya se bloquea; conteo, entrada y salida siguen sin bloquearse.
- **Un ingrediente no cambia**: su merma sigue con el texto «Merma · Motivo · detalle» de Inventario, sin día, como en 0.39.0.
- El formulario de Inventario explica: «La merma de un gelato cuenta como merma del cierre de hoy, a la hora que la apuntes; lo que guardas para mañana no es merma: sigue en stock.»

## Código

- core/schema.ts: `movement` admite `date` (día de negocio, opcional).
- core/domain.ts, acción `movement`: si `kind === "waste"` y el producto es `recipe.product` de alguna receta → `ensure(wasteReason)`, `ensureDayOpen(día)`, texto `wasteReasonText(día, motivo)` + « · detalle»; la actividad dice «Cuenta como merma del cierre del día …».
- core/sales.ts: `wastePattern` separa motivo y detalle (`· ([^·]+?)` y luego `· (.+)`), así `closeLineOf` devuelve el motivo limpio y el historial agrupa bien por motivo.
- src/ui/actions-extended.js: el formulario manda `date: businessToday()` con cualquier merma y explica el caso del gelato.
- Sin migración: ningún movimiento existente cambia de texto ni de lectura.

## Pruebas

- Nueva en tests/sales.test.cjs: merma de gelato a media jornada con motivo y detalle → texto, stock, `closeLineOf` con motivo limpio, resumen del día (merma 0,3 y ajuste 0), historial por motivo, informe de valor, Semana y objetivo de merma; el cierre de la tarde suma (0,5) y «Deshacer» compensa las dos; sin motivo de la lista se rechaza; con el día confirmado se rechaza; sin fecha usa el día de negocio de ahora; un ingrediente sigue igual.
- `npm test`: **201 pruebas, 0 fallos** (reports/tests-2026-09-22-v0430.txt). `format:check` y `typecheck` sin avisos.
- Sonda sobre una copia de los datos del usuario (reports/audit-2026-09-22-v0430-sonda-dia.txt): con el día confirmado, la merma manual del gelato se rechaza; tras reabrir, una merma de 0,05 kg «Vitrina o temperatura» aparece en el resumen del día como merma (0,25 con la del cierre) y ajuste 0, y el historial del día la lista por motivo junto a la de textura.
- Chat: **35/35** (reports/ai-chat-v0430.json) tras añadir a la guía del chat la frase de la merma de gelato.
- Ejecutable: dist/GelatoStock-0.43.0-win32-x64/GelatoStock.exe (work/audit-package-0430.txt).
- Prueba de escritorio con ese ejecutable: **21 PASS** (reports/desktop-smoke-2026-09-22-v0430.txt). El primer intento en segundo plano acabó sin salida y dejó la app de prueba abierta (cuatro procesos del ejecutable 0.43.0 con la carpeta de datos de la prueba, no la app del usuario); se cerraron esos procesos y se repitió en primer plano.

## Límite conocido

Un día que solo tenga una merma de gelato (sin cierre de ventas todavía) cuenta como «día con cierre registrado» en la venta media de «Qué producir hoy» hasta que se registre el cierre de ese día. Como el cierre llega al final de la jornada, el efecto dura horas y desaparece solo.

