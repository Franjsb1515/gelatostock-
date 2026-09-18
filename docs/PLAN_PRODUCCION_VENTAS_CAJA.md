# Plan · Producción, ventas, mermas y caja

Documento de trabajo. Sustituye la lectura del prompt maestro del usuario del 2026-09-18 (archivado íntegro en docs/origen/PROMPT_PRODUCCION_VENTAS_MERMAS.md; no hace falta leerlo salvo duda concreta). Una fase por sesión; al cerrar cada fase se marca aquí.

## Lo que pide el usuario, en diez líneas

1. Evolucionar la app, no rehacerla. Conservar identidad, nombres y navegación.
2. La app piensa; la persona registra hechos simples: «produje 5 kg», «se perdieron 180 g», «regalé 100 g», «en caja hay X».
3. Corregir sin miedo: producciones y mermas del día se editan o eliminan con un clic; por dentro, anulación trazable y recálculo de todo lo derivado. Ninguna pantalla puede seguir mostrando el cálculo viejo.
4. No mezclar magnitudes: coste de producción, valor comercial, venta esperada, venta real, caja esperada, caja real.
5. Una merma no es una cortesía, ni una degustación, ni un consumo interno, ni un sobrante válido para mañana.
6. Una diferencia de inventario se muestra y se clasifica; nunca se convierte sola en merma.
7. Un precio o un coste que cambia hoy no reescribe el pasado (instantáneas).
8. Día cerrado: no se edita en silencio; se reabre o se rectifica con rastro.
9. Una sola fuente de verdad para stock, coste, venta esperada y cierre.
10. Nada de IA predictiva ni de ajustes que nadie usará; recomendaciones por reglas explicables.

## Decisiones tras auditar la app (0.27.0)

| Área | Qué existe hoy | Decisión | Por qué |
|---|---|---|---|
| Libro de movimientos | Cada cambio de stock es un movimiento con antes, después y motivo; se compensa, nunca se borra | MANTENER | Es justo el «ledger» que pide el prompt |
| Transacciones, reintentos, edición simultánea | SQLite transaccional, `operationId` contra duplicados, `revision` contra ediciones cruzadas | MANTENER | Ya cubre sus puntos 18 y 21 |
| Dinero | Céntimos enteros | MANTENER | Sin decimales inseguros |
| Día de negocio | El cierre lleva su fecha, aunque se teclee al día siguiente | MANTENER | Falta solo decidir si el día acaba a medianoche (pregunta 4) |
| Sobrante para mañana | Lo que no se vende ni se tira sigue en stock y es el stock inicial de mañana | NO AÑADIR «transferencias» ni «reservas» | El prompt lo pide porque imagina un stock que se reinicia cada día; aquí no ocurre. Añadirlo duplicaría el inventario |
| Producción aplicada | Se propone, se corrige y se aprueba; después no se puede corregir ni anular | AÑADIR anular y corregir | Es su requisito prioritario y hoy es un hueco real |
| Mermas del día | Motivos de lista cerrada; se deshace el cierre entero | MEJORAR: corregir o eliminar una línea suelta | Pide corrección por registro, no por día |
| Tipos de salida | «Degustación o invitación» cuenta hoy como merma | MEJORAR: separar merma real de cortesía, degustación y consumo interno | El porcentaje de merma técnica sale hoy inflado |
| Pesos | Se escriben en kg con tres decimales | AÑADIR escribir en gramos (425 g) | Balanza; es barato y evita errores |
| Coste de producción | Hay precio de compra por presentación y consumo aprobado por producción | AÑADIR coste de cada producción con instantánea | Se puede calcular sin pedir nada nuevo |
| Precio de venta | No existe | AÑADIR valor comercial por kg de producto terminado, con historial | Sin él no hay «valor perdido» ni venta esperada (pregunta 1) |
| Venta real | No hay TPV; solo kilos vendidos del cierre | AÑADIR importe real del día tecleado al cerrar | La app no debe convertirse en TPV (pregunta 2) |
| Venta esperada | No existe | AÑADIR: kilos vendidos × valor comercial vigente ese día, con desglose explicable | Depende de las dos anteriores |
| Caja | No existe | AÑADIR mínimo: importes por medio de pago, efectivo esperado, contado y diferencia | Solo si el usuario la quiere aquí (pregunta 3) |
| Cierre del día | Se registra y se deshace; no hay «día cerrado» | AÑADIR confirmar cierre con instantánea; después, reabrir con motivo | Su punto 14; la reapertura es la vía más simple y trazable |
| Stock teórico frente a real | Conteo por zonas para ingredientes; el cierre «peso lo que queda» atribuye todo lo que falta a venta | MEJORAR: si hay venta real, la diferencia se enseña como diferencia | Hoy no puede distinguirse porque no hay venta real |
| Qué producir | Mínimo y objetivo por producto; solo se usan para comprar | INTEGRAR: recomendación «producir X kg» para producto terminado | Regla explicable: objetivo − stock, con la venta media reciente al lado |
| Resumen (inicio) | Avisos de compras, mensajes, conteo, cruceros | MEJORAR al final: producción, venta, merma y caja del día | Cuando existan los datos |
| Historial legible | Pantalla Actividad con frases en castellano | MANTENER y ampliar frases de corrección | Ya es su punto 22 |
| Usuarios y permisos | Una persona; contraseña opcional del recetario | POSPONER | Sin varios usuarios no hay nada que autorizar. Queda en TODO §6 |
| Lotes y caducidades | No existe | POSPONER | Ya estaba en TODO §5; no lo pide como prioridad |
| Varias tiendas, áreas, transferencias entre ellas | No existe | NO AÑADIR | Un solo local; el propio prompt pide no sobredimensionar |
| Tolerancias, promociones, precios por canal | No existe | NO AÑADIR por ahora | «No añadas ajustes que nadie usará» |
| Predicción de demanda con IA | No existe | NO AÑADIR | Lo prohíbe el prompt y nuestra regla de no inventar datos |
| Librerías, rediseño, marca | — | NO TOCAR | Sus puntos 1.2 y 40 |

## Preguntas que no se pueden responder leyendo el código

1. **Precio de venta.** El gelato se vende por formatos (cucurucho, tarrina, litro). Para calcular venta esperada hace falta un valor por kilo de cada sabor o, mejor, tus formatos con su precio y sus gramos. ¿Cuáles son?
2. **Venta real.** ¿Tienes TPV o caja registradora? Si es así, al cerrar teclearías el total del día (y, si quieres, por medio de pago) copiándolo de su informe.
3. **Caja.** ¿Quieres llevar aquí el arqueo (fondo inicial, efectivo contado, diferencia) o ya lo haces en el TPV?
4. **Fin del día.** ¿Cerráis siempre antes de medianoche?
5. **Cortesías.** ¿Distingues invitación a clientes, degustación y consumo del equipo, o te basta «invitación» y «consumo interno»?

Las fases 1 y 2 no dependen de estas respuestas.

## Fases

Cada fase: pruebas propias, guía actualizada, una sola versión y un solo cierre.

- [ ] **Fase 1 · Corregir sin miedo.** Anular y corregir una producción aplicada (compensa ingredientes y producto terminado; se bloquea con explicación si ya se vendió parte). Corregir o eliminar una línea suelta del cierre. Pesos en gramos o kilos. Frases humanas tras cada corrección. Una rutina central recalcula el día.
- [ ] **Fase 2 · Llamar a cada salida por su nombre.** Merma real, cortesía, degustación, consumo interno; migración de lo ya registrado («Degustación o invitación» pasa a cortesía); porcentaje de merma solo con merma real; informes y Semana por categoría.
- [ ] **Fase 3 · Coste y valor.** Coste de cada producción con instantánea; valor comercial por kg con historial; merma en kilos, en coste y en valor perdido. Necesita la pregunta 1.
- [ ] **Fase 4 · Venta esperada frente a real y cierre confirmado.** Importe real del día, desglose explicable de la diferencia, confirmar cierre con instantánea, reabrir con motivo. Necesita la pregunta 2.
- [ ] **Fase 5 · Caja.** Medios de pago, efectivo esperado y contado, diferencia. Solo si la pregunta 3 es «sí».
- [ ] **Fase 6 · Qué producir hoy y Resumen.** Recomendación por reglas e indicadores del día en el inicio.
- [ ] **Fase 7 · Repaso transversal.** Pequeñas mejoras de claridad en toda la app, con su pregunta de control: ¿la hace más clara, rápida, fiable o coherente sin perder identidad?

## Criterios de aceptación del usuario (sus 18 pasos) y dónde se cubren

Stock al empezar (hoy) · qué producir (F6) · registrar producción (hoy) · corregirla y anularla (F1) · merma desde la balanza (F1) · editarla y eliminarla (F1) · descartar, regalar, consumir (F2) · sobrante a mañana (hoy, sin hacer nada) · stock y mínimo (hoy) · registrar ventas (hoy en kilos; importe en F4) · esperada frente a real y entender la diferencia (F4) · caja (F5) · cerrar el día (F4) · corregir después del cierre (F4) · consultar qué pasó (hoy, Actividad e historial).
