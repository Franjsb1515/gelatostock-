# Prompt maestro de diseño · GelatoStock para Artello

Encargo para un agente de diseño e interfaz que trabaja sobre este repositorio. Su misión: dar a la aplicación una identidad visual completa, coherente y profesional, corregir todos los defectos de composición y dejar cada pantalla con proporción, ritmo y legibilidad impecables, sin romper ninguna función ni prueba.

## 1. Contexto que debes leer antes de tocar nada
- CLAUDE.md, AGENTS.md y docs/PROMPT_MAESTRO_V2.md (reglas del proyecto y directriz de mejora continua).
- README.md (qué hace la app) y el informe más reciente en reports/.
- docs/ARQUITECTURA_PROTOTIPO.md: la interfaz son scripts clásicos en src/ui/*.js (ámbito global, orden de carga en src/index.html) con plantillas literales y src/styles.css. No hay empaquetador ni framework. La CSP exige `'self'`: sin fuentes web ni recursos externos; solo fuentes del sistema o incrustadas en el repo.
- scripts/desktop-smoke.cjs: prueba de escritorio real. Cada texto, `aria-label`, id, clase y `data-action` que use es un contrato: consérvalos exactamente.

## 2. Quién usa esto y para qué
Propuesta de un socio para Artello Gelato (Plaça de Santa Eulàlia, Palma; «arte + gelato»; gelato-lab artesano; sabor insignia Mediterraneo: pistacho, rosa y azafrán). Usuario final: el equipo de la heladería, no técnico, en un portátil, muchas veces con prisa. La app debe sentirse como un objeto de la casa: sobria, cálida, artesana y precisa. No copies logotipos ni activos reales de la marca: la identidad es propia.

## 3. Sistema de diseño que debes establecer (y documentar en docs/DISENO_SISTEMA.md)
- Tokens en `:root`: paleta (base Mediterraneo ya presente en styles.css: pistacho profundo #35604a, pistacho claro #e6eedc, rosa #c85c73/#fbe7ec, azafrán #e0a53a/#fbeccf, crema #fbf7f0/#fffdf9, acero #6b7680, tinta #1e2a2f), radios, sombras, espaciado en múltiplos de 8, anchos de lectura (60–75 caracteres), escala tipográfica (12/13/14/15/18/22/32) e interlineados (1,2 en títulos, 1,5–1,6 en texto).
- Identidad por pantalla: cada sección tiene un acento (`--accent`) y un carácter (rótulo, icono, color de estadísticas) reconocible sin ser ruidoso. `<main class="page-…">` ya existe para ello si lo aplicas; si no, créalo.
- Componentes: cabecera de página, tarjeta/panel, tabla, formulario y campos, botones (primario, secundario, peligro, deshabilitado), píldoras de estado, avisos, diálogos, burbujas de mensaje, tarjetas de documento/producción/receta, lista de navegación agrupada. Cada uno con estados hover/focus/disabled y tamaños consistentes.
- Iconografía: los iconos SVG existentes en src/ui/core.js; puedes añadir o depurar iconos en el mismo estilo (trazo 1,5–1,75, esquinas redondeadas).

## 4. Defectos conocidos que debes corregir sí o sí
- Tarjetas de documento (pantalla Documentos): la caja de propuesta desborda, el botón «Aceptar» pisa el texto y los botones de acción se apilan en columnas estrechas. Rediseña la tarjeta: miniatura a la izquierda, contenido con anchura mínima garantizada, propuesta como bloque completo debajo con botón alineado, acciones en fila con envoltura elegante (o menú «Más» si no caben).
- Revisa TODAS las pantallas con la misma lupa: Resumen, Inventario, Producción, Compras (carrito y Control de entregas), Mensajes (lista y detalle), WhatsApp, Documentos, Proveedores, Actividad, IA local (analizador y chat), Configuración (todas las secciones), diálogos y la pantalla de inicio.
- Textos que se cortan o solapan, botones de altura variable, tablas sin alineación, párrafos demasiado anchos o estrechos, rótulos de 8–10 px ilegibles, márgenes desiguales entre secciones, contraste insuficiente.

## 5. Criterios de aceptación (comprueba cada uno)
- Ningún solapamiento ni texto cortado a 1280×800, 1440×900 y 1920×1080 (mín. 1000×700 que fija la ventana).
- Contraste AA (≥ 4,5:1 en texto normal, ≥ 3:1 en texto grande e iconos).
- Foco visible por teclado en todo control; orden de tabulación lógico.
- Ritmo vertical de 8 px y espaciado entre secciones constante; una sola escala tipográfica.
- Botones en una fila con envoltura ordenada; anchura mínima de tarjetas ≥ 320 px; párrafos ≤ 72 caracteres.
- El estado vacío de cada pantalla explica qué hacer.
- La pantalla de inicio «arte + gelato» dura ≤ 1,5 s y no bloquea.
- `npm test`, `npm run format:check` y `npm run test:desktop` en verde; no cambias `core/`, `src/server.cjs`, `src/whatsapp*.cjs`, `src/ai*.cjs`, `src/desktop.cjs` ni pruebas salvo para añadir comprobaciones nuevas (nunca para ocultar fallos).

## 6. Método de trabajo
1. Inventario visual: lanza la app sin empaquetar con Playwright y Electron (patrón de scripts/desktop-smoke.cjs, usando `require("electron")` como ejecutable y `["."]` como argumentos, con `GELATO_DATA_DIR` a una carpeta temporal en work/) y captura cada pantalla y cada diálogo en output/design/antes/. Anota defectos por pantalla en docs/DISENO_SISTEMA.md.
2. Define los tokens y componentes; aplica el sistema pantalla por pantalla, reduciendo reglas duplicadas en styles.css en lugar de acumular más.
3. Vuelve a capturar en output/design/despues/ y compara. Repite hasta cumplir los criterios.
4. Ejecuta las pruebas y la prueba de escritorio; si algo falla por un selector o texto que cambiaste, restaura el contrato (no cambies la prueba).
5. Entrega: resumen por pantalla (qué cambió y por qué), lista de tokens y componentes, capturas antes/después, cualquier límite que no pudiste resolver y por qué. No hagas commit: el cierre lo hace la sesión principal.

## 7. Estilo de trabajo
Trabaja con máxima profundidad y cuidado, sin prisa: es la propuesta que verá el negocio. Prioriza legibilidad y calma sobre ornamento; cada decisión visual debe tener un motivo funcional. Mantén el español de la interfaz (voseo/tuteo tal como esté) y no inventes funciones nuevas.
