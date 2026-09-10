# Sesión 029 · Correcciones de la auditoría general · versión 0.17.1

## Encargo
Tras la auditoría (reports/2026-09-10T01-05-00-000Z-auditoria-general-0170.md) el usuario pidió continuar; se ejecutaron los puntos aprobados en el orden propuesto: 1, 2, 3, 4, 5, 9 y 10.

## Cambios
- Espacio (1): eliminadas 26 versiones antiguas de dist (49,4 GB → 4,3 GB, dos versiones). scripts/package.cjs conserva automáticamente las dos más recientes.
- Paquete (2): scripts/package.cjs omite onnxruntime-web, las variantes de @img/sharp de otras plataformas y los binarios de onnxruntime-node para darwin, linux y win32-arm64. Ejecutable 0.17.1: 1,9 GB (0.17.0: 2,2 GB). Hallazgo durante la verificación: el primer paquete podado sin sharp arrancaba pero la IA fallaba con «Cannot find module sharp» (transformers lo exige al cargar; en el árbol de desarrollo Node lo encontraba en la carpeta superior y por eso la prueba manual engañaba). Se conserva sharp con su binario de Windows x64 y el trabajador de IA ahora adjunta la causa técnica al registro ia.log. Las vulnerabilidades transitivas de sharp/adm-zip siguen en el paquete (sin arreglo upstream, no se ejercitan con datos del usuario).
- Fechas locales (3): core/messages.ts hace toda la aritmética con el calendario local (localDate, addDays con setDate, comparaciones por día) y src/ui/core.js aporta todayLocal para producción y ventas. Prueba nueva con un mensaje a las 23:30 UTC. Nota: el equipo de desarrollo está en UTC−3 y el negocio en UTC+2; por eso la prueba no asume zona horaria.
- CSV (4): src/csv.cjs con csvCell; prueba de fórmulas, números negativos, comillas y separadores.
- Registros (5): src/logs.cjs appendLog con rotación a .anterior al superar 1 MB, usado por ia.log, errores.log y diagnostico.log; prueba de rotación.
- Tuteo (9): 43 sustituciones en src/ui, src/*.cjs, core y README (Puedes, Añade, Prepara, Revisa, Registra, Elige, Indica, Autorízalo, Conecta, Haz, Usa, Pega) y la prueba de WhatsApp que esperaba «Conectá».
- README (10): catorce cabeceras históricas renumeradas a su versión real según CHANGELOG.

## Verificación
- npm test: 122/122 (antes 119). Formato limpio.
- Evidencia final (paquete y prueba de escritorio) al pie.

## Pendiente de la auditoría
Puntos 6 (memoria IA: medir en Mac), 7 (estado paginado), 8 (copia secundaria) y 11 (partir views.js, pruebas de Recetario y «Abrir») quedan en TODO.md.

## Evidencia final
- npm test: 122 aprobadas (reports/tests-2026-09-10-v0171.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.17.1-win32-x64.
- npm run test:desktop: 11 PASS (completa). reports/desktop-smoke-2026-09-10-v0171.txt.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M core/identify.ts
 M core/messages.ts
 M core/schema.ts
 M core/seed.ts
 M core/store.ts
 M package-lock.json
 M package.json
 M scripts/package.cjs
 M src/ai-worker.cjs
 M src/ai.cjs
 M src/desktop.cjs
 M src/ocr.cjs
 M src/server.cjs
 M src/ui/actions.js
 M src/ui/core.js
 M src/ui/forms.js
 M src/ui/views.js
 M src/whatsapp-store.cjs
 M src/whatsapp.cjs
 M tests/domain.test.cjs
 M tests/server.test.cjs
 M tests/whatsapp.test.cjs
?? reports/2026-09-10T07-32-03-168Z-correcciones-auditoria.md
?? reports/desktop-smoke-2026-09-10-v0171.txt
?? reports/tests-2026-09-10-v0171.txt
?? src/csv.cjs
?? src/logs.cjs
```
