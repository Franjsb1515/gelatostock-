# Textos para entregar · 0.53.1 · 2026-10-05

Encargo: «no pongas "como en la hoja"; la app la tengo que entregar: que sea lo más prolija posible y se entienda intuitivamente todo».

## Qué se cambió
- Pesada de la mañana: la unidad dice «Gramos (g) · 1000 g = 1 kg» / «Kilos (kg) · 1,5 kg = 1500 g» (antes «como en la hoja: 8000 = 8 kg»); cada casilla lleva su unidad al lado (cambia sola al elegir gramos o kilos) y «Sin pesar» de ejemplo; una columna por sabor, más fácil de leer.
- Mínimos por sabor: «kg» al lado de cada casilla, «Sin mínimo» de ejemplo y «En pausa» alineado.
- Precio de referencia: «Un único precio por kilo para comparar (por ejemplo, el del gelato más caro)» en lugar de «Tu precio… (el del gelato más caro)», que era la costumbre del dueño.
- Tabla de la ficha: sin abreviaturas («Entradas y salidas», «Facturación», «No disponible»).
- Hueco verificado (dos): un día sin pesadas ni producción enseñaba «Vendido 0 kg · 0,00 €» y la semana «vendido 0 kg (faltan pesadas)», como si no se hubiera vendido nada. Ahora: «Sin pesadas ni producción este día: no hay venta ni facturación que estimar» y «No disponible (faltan pesadas de N días)».
- Jerga técnica fuera de la pantalla (volcado de las 15 pantallas con work/audit-fase6.cjs sobre una copia de data/): «Guardado en SQLite» → «Guardado en este equipo»; «SQLite guarda las operaciones…» → «Todo se guarda en este equipo, sin internet…»; «El OCR español…» → «La lectura de fotos también se hace dentro del equipo»; «Registro en cruceros.sqlite…» → «Se guarda en la carpeta de datos»; la contraseña olvidada del Recetario ya no explica tablas de la base en pantalla: «quien te dé soporte técnico puede quitarla sin perder datos», y la instrucción técnica pasa a docs/INSTALADOR.md («Soporte: contraseña del recetario olvidada»). En la Guía y el Ayudante: sin «como la hoja de producción en papel», sin «OCR», sin «SQLite» ni «IA local».
- No se tocó: «Envío simulado» y «Pedidos de demostración» siguen porque el usuario decidió el 2026-09-20 mantenerlos para sus pruebas (TODO). Antes de entregar conviene quitarlos.

## Pruebas
- npm test 243/243 (reports/tests-2026-10-05-v0531.txt); chat 44/44 (reports/ai-chat-v0531.json). Ojo: una primera evaluación se lanzó antes de subir la versión y sobrescribió reports/ai-chat-v0530.json; se restauró con git y se repitió con la 0.53.1.
- Recorridos sobre copias de data/: work/check-ficha-produccion.cjs y work/check-minimos.cjs (mismos resultados, sin errores, persistencia tras reiniciar); capturas de los diálogos con work/shot-pesada.cjs.
- Ejecutable 0.53.1, prueba de escritorio 22 PASS (reports/desktop-smoke-2026-10-05-v0531.txt).
