# Sesión 028 · Recetario, ventas solo de recetas y Mensajes más ordenado · versión 0.17.0

## Encargo
El usuario vio en «Ventas y mermas del día» productos que no salen de ninguna receta; pidió corregirlo, añadir un recetario y que Mensajes sea más ordenado e intuitivo, con todos los botones funcionando («Abrir» debe llevar al mensaje).

## Diagnóstico
- Ventas y mermas listaba productos en kg por categoría (Gelatería/Postres), no por receta: aparecían Pistacho siciliano y Vainilla de Madagascar.
- «Abrir» sí seleccionaba el mensaje, pero si un filtro (proveedor, «Mostrar», búsqueda) lo excluía, el detalle mostraba el primero de la lista y parecía no funcionar. Además, dos bloques del detalle repetían el mismo resumen.

## Cambios
- core/schema.ts: recipeFamilies y campos family, steps, allergens con valores por defecto; core/seed.ts con la receta de ejemplo completa. Prueba nueva en tests/domain.test.cjs.
- src/ui: pantalla Recetario (recipeBook) con filtros, fichas con porcentaje sobre la masa (kg y L cuentan 1:1, unidades fuera del total), escalado por kilos con − / + sin tocar el estado, Producir/Editar/Duplicar/Eliminar; editor de receta con familia, elaboración y alérgenos; Producción con resumen y enlace; ventas solo de recetas.
- Mensajes: messageMatches compartido; «Abrir» restablece filtros si ocultan el mensaje, marca leído solo si no lo estaba y desplaza al detalle; replyBlock reúne lectura, prioridad (sin repetir el resumen), pedido y segunda lectura de IA; botón de demostración secundario.
- Guía (docs/GUIA_USO.md) y guía del chat (src/ai-help.cjs) con la sección Recetario; prueba de escritorio adaptada.

## Verificación
- npm test: 119/119. Formato limpio.
- Captura propia work/shot-recipes.cjs (no versionada): Recetario, escalado a 6 kg (3 L leche, 1,2 L nata), editor, filtro sin resultados, Producción, y «Abrir» con el filtro de proveedor puesto en otro proveedor: abre el mensaje correcto y el filtro vuelve a «Todos» (salida: «abierto: No tenemos nata… | proveedor filtro: all»). Muestras en reports/design/0170-*.png.
- Evidencia final (paquete y prueba de escritorio) al pie.

## Límites
- El porcentaje es sobre la masa de ingredientes en kg/L, no un balance técnico (azúcares, grasas, sólidos): queda en TODO si el usuario aporta fichas reales.
- El escalado no redondea a presentaciones de compra; es para la mesa de trabajo, no para pedir.

## Evidencia final
- npm test: 119 aprobadas (reports/tests-2026-09-10-v0170.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.17.0-win32-x64.
- npm run test:desktop: 11 PASS (completa). reports/desktop-smoke-2026-09-10-v0170.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/schema.ts
 M core/seed.ts
 M docs/GUIA_USO.md
 M package-lock.json
 M package.json
 M scripts/desktop-smoke.cjs
 M src/ai-help.cjs
 M src/styles.css
 M src/ui/actions.js
 M src/ui/core.js
 M src/ui/events.js
 M src/ui/guide.js
 M src/ui/views.js
 M tests/domain.test.cjs
?? reports/2026-09-10T00-34-11-313Z-recetario-y-mensajes.md
?? reports/design/0170-editor-receta.png
?? reports/design/0170-mensajes.png
?? reports/design/0170-recetario.png
?? reports/desktop-smoke-2026-09-10-v0170.txt
?? reports/tests-2026-09-10-v0170.txt
```
