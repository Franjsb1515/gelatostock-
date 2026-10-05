# Limpieza y velocidad · 0.50.1 · 2026-10-05

Encargo: «después del commit, limpia el código a mejor; quiero que todo esté mejor optimizado». Se hizo después del commit 0.50.0 (c4bb798), que queda como punto de vuelta.

## Método
Medir antes de tocar, con datos que crecen (no hay lentitud con los datos actuales del usuario: 15 movimientos, todo < 1 ms):
- work/bench-core.cjs: un año simulado de uso diario (10 gelatos, producción y cierre cada día: 14.965 movimientos, 3.650 producciones; estado guardado en work/bench-state.json). Construirlo con apply() tardó 12 min: cada acción copia y valida el estado entero.
- work/bench-apply.cjs: una acción según el tamaño (1.000 / 10.000 / 40.000 movimientos: 3,9 / 34 / 143 ms).
- work/bench-store.cjs: un guardado completo en una base temporal con 40.000 movimientos, con desglose.

## Lo que se cambió (con su medida)
1. **Día de cada movimiento** (core/day.ts `movementDay`): buscaba la producción del movimiento recorriendo todas las producciones, movimiento a movimiento (15.000 × 3.650). Ahora `productionDays(s)` hace un índice una vez por cálculo y los bucles de computeDay, stockAtDayEnd y el Calendario lo usan. Con el año simulado: mes del Calendario 1.292 → 52 ms; ficha del día 157 → 8 ms; daySummary 36 → 1,5 ms; año 85 → 3 ms; resumen de inicio (todayBrief) 77 → 4 ms. Sin el índice el resultado es el mismo (la función acepta seguir sin él).
2. **Guardado** (core/store.ts `dispatch`): tras guardar se releía toda la base y se validaba otra vez (~260 ms con 40.000 movimientos); la copia por proveedor (syncArchive) hacía otra copia del estado; y la entrada a apply() otra. Ahora apply() recibe el estado en memoria sin copia (apply ya copia), write() no revalida lo que viene de apply() (`trusted`), lo guardado queda en memoria normalizado como JSON (igual que al releer: sin claves vacías) y syncArchive lee sin copiar. Guardado con 40.000 movimientos: 908 → 273 ms. Prueba nueva en tests/store.test.cjs: tras seis acciones de tipos distintos (conteo, foto, carrito, producción, foto del Calendario, vacaciones), lo que queda en memoria es idéntico (deepEqual) a abrir la base de nuevo, y los adjuntos quedan como archivo, no en línea. La primera versión de esa prueba falló por claves `undefined` en memoria: se arregló normalizando con JSON, no cambiando la prueba.
3. **Utilidades repetidas**: core/util.ts (nuevo) con `kg`, `pad`, `fold` y `addDays`, que estaban copiadas en calendar, day, plan, value, sales, dayphoto, documents, messages y cruises (messages y cruises las reexportan para no romper a quien las importa). plan.ts usaba su propio `shift` con hora local: ahora `addDays` (mismo resultado para fechas «AAAA-MM-DD»). calendar.ts `dayOf` usa `businessDay`. En la pantalla, `ymd` y `shiftDay` en src/ui/core.js sustituyen a `calShiftDay`, `cruiseShift` y `shiftWeek`; scripts/desktop-smoke.cjs llamaba a `calShiftDay` por su nombre y se actualizó el nombre (no lo que comprueba).
4. Código muerto: `tsc --noUnusedLocals --noUnusedParameters` sobre core/ y el servidor no encuentra nada; work/unused-ui.cjs (declaraciones de primer nivel de src/ui que nadie nombra) tampoco.

## Lo que NO se tocó, y por qué
- La validación completa con zod en cada acción (60 ms con 40.000 movimientos) es una garantía del proyecto: no se degrada. Si con los años pesa, el camino es validar solo lo que cambia, con su prueba.
- No se reescribieron pantallas ni módulos que funcionan: «implementa solo lo necesario» y cada cambio grande sin una medida que lo pida es riesgo sin beneficio.

## Pruebas (salidas guardadas)
- npm test 232/232 (reports/tests-2026-10-05-v0501.txt), format:check y typecheck limpios.
- Volcado de 13 pantallas sobre una copia de data/ (work/audit-fase6.cjs): sin errores de página.
- work/check-calendario-fase2.cjs y work/check-calendario-fotos.cjs repetidos: mismo resultado que antes de limpiar.
- Ejecutable 0.50.1, prueba de escritorio 22 PASS (reports/desktop-smoke-2026-10-05-v0501.txt); el primer intento falló por el nombre `calShiftDay` en la prueba, ya corregido.
