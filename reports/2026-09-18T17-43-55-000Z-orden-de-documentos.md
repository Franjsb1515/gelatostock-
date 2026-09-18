# Sesión 041 · Orden de documentos y limpieza · sin cambio de versión

## Encargo
El usuario pidió ordenar TODO.md, listas y documentos antes de seguir, porque las sesiones se habían vuelto pesadas.

## Diagnóstico
- CLAUDE.md se carga entero en cada sesión y acumulaba puntos de continuidad de cada versión: 11,5 KB.
- TODO.md mezclaba 73 puntos hechos con 38 pendientes. Tres pendientes estaban repetidos (equivalencias de productos, Makro, Mac) y dos ya estaban resueltos (respuestas del chat por reglas, 0.16.0; historial paginado, 0.18.0).
- README.md describía la app de la versión 0.3 en su cabecera y sumaba un apartado por versión hasta 23 KB.
- work/ (sin versionar) guardaba 35 carpetas temporales de pruebas y capturas, y 190 guiones y registros de un solo uso.

## Hecho
- TODO.md: solo lo pendiente, 34 puntos en seis áreas, con marca de quién tiene que actuar ([tú], [app], [decidir]) y el orden acordado arriba. Lo hecho, en una línea por bloque, con remisión a CHANGELOG.md. No se perdió ningún pendiente: los 38 originales se cotejaron uno a uno.
- CLAUDE.md: 5,8 KB con reglas vigentes, seguridad de WhatsApp, mapa del código, garantías por módulo y rutina de pruebas y cierre. Los puntos de continuidad pasan íntegros a docs/CONTINUIDAD.md. Corregido «Pedidos todavía simulados», que ya no era cierto.
- README.md: qué hace la app hoy por áreas, qué sale a internet, datos y copias, mapa de documentos y desarrollo. Sus notas por versión pasan íntegras a docs/HISTORIA_VERSIONES.md.
- AGENTS.md: regla nueva para que estos tres documentos no vuelvan a crecer.
- work/: eliminadas las carpetas temporales (149 MB liberados; eran perfiles y datos de prueba, ningún dato real) y archivados los guiones de un solo uso en work/archivo. Se conservan las herramientas reutilizables, los experimentos de IA, la caché de npm y wa-qr-probe (puede contener una sesión de WhatsApp: no se toca).
- tests/context.test.cjs dejaba una carpeta temporal por ejecución; ahora la borra.

## Verificación
- npm test: 152/152. npm run format:check: aprobado. Sin cambios en src/: no hace falta reconstruir el ejecutable.

## Propuestas que necesitan decisión del usuario
- reports/ guarda cada parche dos veces (38 sueltos y 40 en reports/patches/) además de estar en git. Propuesta: dejar de generar el parche suelto por sesión. No se ha borrado nada: la regla vigente es conservar los informes.
- La rutina de cierre completa (paquete, prueba de escritorio y evaluación del chat) tarda unos 10 minutos por versión. Propuesta: agrupar cambios pequeños en una sola versión.
