# Sesión 022 · Identidad visual para la propuesta a Artello · versión 0.13.0

## Contexto
El proyecto es una propuesta del usuario para Artello Gelato (Palma de Mallorca, casco antiguo, abierta en otoño de 2025, sabor insignia «Mediterraneo»: pistacho, rosa y azafrán). No se dispone de su manual de marca; solo presencia pública en Instagram, no consultable desde aquí. Decisión: identidad visual original inspirada en su concepto «arte + gelato», sin logotipo ni activos reales, y colores editables si el negocio facilita su paleta.

## Cambios
- Paleta: primario pistacho profundo #35604a, pistacho claro #e6eedc, rosa #c85c73 (avisos que requieren lectura), azafrán #e0a53a (detalles), crema de casco antiguo #fbf7f0/#fffdf9, acero #6b7680 para textos secundarios. Aplicada por mapeo de los colores anteriores en src/styles.css; sin cambios de estructura.
- Tipografía: títulos y nombre del negocio en serif (Georgia como fuente del sistema, sin descargas).
- Pantalla de inicio «arte + gelato»: nombre, lema, tres pinceladas Mediterraneo y lugar; se retira sola tras el primer render (1,4 s + fundido) y no bloquea clics.
- Identidad editable: estado business/place, acción business, sección «Identidad del negocio» en Configuración; nombre y lugar en barra lateral, migas, pie y texto de pedidos; iniciales calculadas.
- Semilla nueva: Artello · Palma de Mallorca (instalaciones existentes conservan su nombre y lo editan).

## Pruebas
- Dominio: edición de identidad y texto de pedido; 106 pruebas.
- Prueba de escritorio con capturas (output/playwright/*.png) revisadas visualmente.

## Límites
- La paleta es una interpretación; si Artello facilita sus colores, se sustituyen en un solo mapeo.
- Sin fuentes propias empaquetadas; se usa la serif del sistema.

## Evidencia final
- npm test: 106 aprobadas (reports/tests-2026-09-09-v0130.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.13.0-win32-x64.
- npm run test:desktop: 10 PASS (completa). reports/desktop-smoke-2026-09-09-v0130.txt. Capturas en output/playwright/.

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M core/domain.ts
 M core/schema.ts
 M core/seed.ts
 M package-lock.json
 M package.json
 M src/index.html
 M src/styles.css
 M src/ui/actions.js
 M src/ui/core.js
 M src/ui/views.js
 M tests/domain.test.cjs
?? core/documents.ts
?? reports/2026-09-09T11-26-40-250Z-identidad-artello.md
?? reports/desktop-smoke-2026-09-09-v0130.txt
?? reports/tests-2026-09-09-v0130.txt
```
