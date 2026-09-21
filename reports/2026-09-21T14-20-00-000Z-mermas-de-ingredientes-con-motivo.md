# Sesión 047 (segunda parte) · Mermas de ingredientes con motivo · versión 0.39.0

## Encargo

Del usuario, el 2026-09-21: «las mermas de ingredientes con los mismos motivos que el cierre». Era el pendiente marcado **[decidir]** de TODO §1; con esa frase queda decidido. La otra mitad de aquella idea —un objetivo de merma con aviso— **no se toca**: falta acordar sobre qué se mide (por producto o por semana, en kilos o en porcentaje) y desde cuándo avisa. Queda en TODO como [decidir].

## Qué cambia en pantalla

- **Inventario → «Entrada / salida»**: al elegir «Merma / pérdida» aparece **«Motivo de la merma»** con la misma lista que el cierre del día: fin de vida útil, textura o cristalización, vitrina o temperatura, caída o rotura, otro motivo. El campo de texto libre deja de ser obligatorio y pasa a llamarse **«Detalle (opcional)»** («se cayó el bote»). Con entrada o salida, todo sigue igual: el motivo es el texto libre y es obligatorio.
- El movimiento queda guardado como **«Merma · Fin de vida útil · abierto desde el lunes»**, y en Actividad se lee «Merma: Café de especialidad, 0,05 kg. Fin de vida útil · abierto desde el lunes» (la palabra «Merma» no se repite).
- **Semana → «Mermas por motivo»**: un bloque nuevo que junta la merma del cierre del día y la de Inventario, porque ahora comparten motivos. Por cada motivo, cuántos apuntes y qué producto y cantidad en **su** unidad.

## Lo que no hace

- **No suma cantidades entre productos.** Cada producto tiene su unidad (kg, L, ud) y sumarlas no significaría nada: cada motivo enseña sus líneas, no un total.
- **No reescribe nada de lo que ya tenías.** Una merma anterior, con el texto que escribiste, se sigue leyendo tal cual y aparece agrupada como **«Sin motivo»**.
- **No convierte una merma de ingrediente en una línea del cierre del día.** El texto nunca empieza por «Merma del día», así que `closeLineOf` no la confunde: el cierre del día, el resumen del día y «Ventas e impacto» siguen contando solo lo del gelato.
- La lista de motivos es la misma a propósito, por decisión del usuario, aunque dos de ellos («textura o cristalización», «vitrina o temperatura») nacieron pensando en el gelato.

## Núcleo

- **core/sales.ts**: `stockWasteText(reason, detail?)` escribe «Merma · Motivo[ · detalle]»; `wasteLabelOf(movimiento)` devuelve la etiqueta del motivo de **cualquier** merma viva, venga del cierre o de Inventario, «Sin motivo» si el movimiento no lo dice, y `null` si no es una merma (un texto antiguo de degustación se lee como invitación, y eso no es merma).
- **core/schema.ts**: la acción `movement` gana `wasteReason` opcional, y su `reason` deja de ser obligatorio en el esquema (lo exige el dominio). Los tres sitios que repetían la lista de motivos usan ahora una sola constante.
- **core/domain.ts · `movement`**: rechaza un motivo de merma en una entrada o una salida, rechaza un movimiento sin motivo ni texto, y compone el texto con `stockWasteText`.
- **core/report.ts**: `wasteByReason` en el resumen semanal, ordenado por número de apuntes.
- **Servidor**: los motivos viajan en el sobre de estado (`wasteReasons`), para que el formulario no los repita en la interfaz.

## Pruebas

- `npm test`: **194 pruebas, 0 fallos** (salida en reports/tests-2026-09-21-v0390.txt). Nueva en tests/sales.test.cjs: el texto que se guarda con y sin detalle, la actividad sin repetir «Merma», que no es una línea de cierre, el rechazo del motivo en una entrada y del movimiento sin motivo, la merma antigua leída como «Sin motivo» sin reescribirla, y la Semana agrupando por motivo la merma del cierre y la del inventario **sin mezclar litros con kilos**.
- `npm run typecheck` y `npm run format:check`: limpios.
- `npm run package:win`: ejecutable 0.39.0 reconstruido (work/audit-package-0390.txt).
- `npm run test:desktop`: **21 PASS**, con una comprobación nueva dentro del ejecutable: una merma de 0,2 kg de pistacho con motivo «Caída o rotura» y detalle queda como «Merma · Caída o rotura · se cayó el bote» y baja el stock a 3 kg. Salida en work/desktop-0390.log.
- `node scripts/evaluate-ai.cjs --chat`: **31/31**, con un caso nuevo (poner el motivo cuando se estropea un ingrediente). Salida en work/audit-chat-0390.txt.
- **Sobre una COPIA de los datos reales** (work/check-merma-motivos.cjs, salida en work/check-merma-motivos.txt): con su café, el formulario esconde el motivo hasta elegir «Merma / pérdida», ofrece los cinco motivos del cierre, y al guardar 0,05 kg por «Fin de vida útil · abierto desde el lunes» el stock pasa de 2,4 a 2,35 kg y la Semana lo enseña en «Fin de vida útil · 1 apunte». Sin errores de consola.

## Límites que quedan

- **El objetivo de merma con aviso sigue sin hacerse**: hace falta decidir cómo se mide.
- Una merma de ingrediente **no tiene día de negocio**: cuenta en el día natural en que se apunta (el cierre del día sí respeta la hora de cambio). No se ha cambiado para no tocar lo que ya funciona.
- «Mermas por motivo» es de la semana. No hay todavía una vista por meses ni una comparación entre semanas.
- Las mermas anteriores no se pueden reclasificar desde la app: quedan como «Sin motivo».
