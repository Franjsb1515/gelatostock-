# 0.62.0 — Datos de ejemplo fuera, sin simulación y cinco textos decididos

Fecha: 2026-10-06. Decisiones del usuario en esta sesión (todas las recomendadas):

1. Quitar ya «Simular envío» y los pedidos y mensajes de demostración.
2. En sus datos, quitar solo los productos y proveedores de ejemplo que no usa.
3. Una instalación nueva empieza vacía.
4. Textos: Cruceros «Todavía no se ha consultado al puerto»; «Calcular y aprobar después» (antes «Producción a mano»); «¿Tiene que ver con un pedido?» (antes «Corregir relevancia»); fuera el aviso «función todavía en pruebas» de WhatsApp.

## Qué cambia

- `core/examples.ts` (nuevo): `examplesPlan` dice qué se quita y qué se queda; `removeExamples` lo aplica (acción `removeExamples`, una vez: exige `state.demo`). Lo de ejemplo se reconoce por su identificador fijo de `seed()` (p1–p10, s1–s4, r1, welcome-message), nunca por el nombre.
  - Se quitan: pedidos que nunca salieron por WhatsApp (sin `dispatch`), mensajes del canal de demostración, la receta r1 sin producciones vivas, productos de ejemplo sin uso y proveedores de ejemplo que se quedan sin nada.
  - «Uso» de un producto de ejemplo: receta (ingrediente, gelato o paso del orden de preparación), producción, pedido que se queda, movimiento que no sea la recepción de un pedido de práctica, cambio de precio, pesada, día cerrado, enlace con la lista o la tabla. Si lo usa, se queda con su stock y su precio; la composición de ejemplo se quita si nadie la cambió (el balance dirá «falta» en vez de calcular con valores inventados).
  - Un movimiento de un producto que se queda nunca se borra: si venía de un pedido de práctica, solo pierde el enlace al pedido.
- `state.demo` pasa de `true` fijo a sí/no. `emptyState()` (core/seed.ts) es el espacio nuevo sin nada.
- `Store(dir, { start })`: por defecto `seed` (las pruebas); `createApp` pasa `emptyState` salvo bajo node:test o con `GELATO_EXAMPLE=1` (la prueba de escritorio lo pone). Una base que ya existe no cambia.
- Servidor: antes de `removeExamples`, copia completa (`store.backup()` y la carpeta secundaria si la hay). El sobre lleva `examples` (el plan) solo mientras hay ejemplo.
- Configuración: tarjeta «Datos de ejemplo» con lo que se quita, lo que se queda y por qué, y «Quitar los datos de ejemplo» con confirmación.
- Compras: «Simular envío» pasa a «Ya lo pedí por otro medio» (teléfono, correo, en persona): marca el pedido como enviado sin enviar nada, para poder registrar lo que llega. No es simulación: los 21 proveedores nuevos no tienen teléfono y sin esto no se podría recibir nada de ellos. El estado del pedido dice «Pedido por otro medio».
- «Simular mensaje» solo aparece en un espacio con datos de ejemplo.
- Resumen vacío: «Para empezar» con tres pasos (proveedores, productos, recetas) y «Todavía no hay productos en el inventario» en vez de «por encima de los mínimos». «Nuevo producto» sin proveedores lleva a Proveedores con un aviso (antes abría un formulario que no se podía guardar).
- Cruceros: también «No se pudo consultar al puerto» (antes «Error de sincronización») y «Ya se está consultando al puerto…».
- Guía y Ayudante: sección «Para empezar», «Ya lo pedí por otro medio», quitar los datos de ejemplo; fuera «Simular envío» y «mensajes de demostración».

## Datos reales del usuario

Con la app cerrada, por el mismo camino que el botón (work/quitar-ejemplos-reales.cjs, con guardia de «ya aplicado»): copia previa en work/copias/antes-quitar-ejemplos-1791259522900/ y copia de la app en data/backups/.

| | Antes | Después |
|---|---|---|
| Productos | 14 | 8 |
| Proveedores | 28 | 25 |
| Pedidos | 14 | 1 (GS-012, enviado por WhatsApp) |
| Mensajes | 6 | 0 |

- Quitados: Pistacho siciliano, Chocolate 70 %, Vainilla de Madagascar, Vasos para llevar, Tarta de queso, Conos artesanos; Origen Coffee, Gelato Italia, EcoPack; GS-001…GS-011, GS-013, GS-014; 6 mensajes de demostración.
- Se quedan porque están en sus recetas: Café de especialidad, Leche entera, Bebida de avena, Nata para montar (precio de ejemplo; composición de ejemplo quitada). Fresco Mercado se queda porque es su proveedor.
- Comprobado contra la copia previa: stock y precio de lo que queda iguales, 18 movimientos de lo que queda iguales, recetas idénticas, 7 producciones, 195 filas de lista y 153 de tabla iguales.
- GS-012 no se quitó: salió de verdad por WhatsApp; no es un pedido de práctica según la regla. Lo puede cancelar o cerrar el usuario.

## Pruebas

- `npm test`: 289/289 (4 nuevas en tests/examples.test.cjs). Dos expectativas de tests/cruises.test.cjs cambiadas porque el usuario decidió el texto (antes «Información pendiente de sincronización» y «Error de sincronización»).
- Chat: 62/62 (dos casos nuevos: pedido por teléfono y quitar ejemplos; el segundo falló a la primera, 61/62, hasta añadir una línea propia a src/ai-help.cjs). reports/ai-chat-v0620.json.
- Pantallas de un espacio vacío (work/audit-vacio.cjs, 13 pantallas): 0 errores.
- Prueba de escritorio: 24 PASS con el ejecutable 0.62.0 (reports/desktop-smoke-2026-10-06-v0620.txt), a la segunda: la primera falló en el paso nuevo por un selector ambiguo de la prueba (dos botones llevan a Mensajes), no por la app. Nuevo paso: quitar los datos de ejemplo dentro del ejecutable. Cuatro botones cambian de nombre en scripts/desktop-smoke.cjs por la decisión de textos.

## Pendiente

- El usuario: revisar el precio de Café, Leche, Avena y Nata (son los del ejemplo) y si su proveedor es Fresco Mercado; GS-012.
- Fase siguiente: enderezar y ampliar la foto antes de leer un cuadrante (0.63.0).
