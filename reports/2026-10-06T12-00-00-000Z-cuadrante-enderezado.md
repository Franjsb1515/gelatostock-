# 0.63.0 — Cuadrante: enderezar y ampliar la foto antes de leerlo

Fecha: 2026-10-06. Siguiente punto de TODO.md tras 0.62.0: «enderezar la foto antes de leer la cuadrícula y ampliar las pequeñas». Todo medido con imágenes sintéticas (no hay fotos reales nuevas del usuario).

## Qué cambia

- `src/table-ocr.cjs`, `prepareGrid`: primero, la cuadrícula como siempre (líneas casi negras, umbral 80). Solo si no sale, **rescate**:
  1. Inclinación (`skewAngle`): con la foto reducida a 800 px, se proyectan los píxeles oscuros con cada ángulo de −8° a 8° (paso 0,25°) y gana el perfil más concentrado. Si es ≥ 0,5°, se gira la foto (fondo blanco).
  2. Una foto de menos de 1000 px de ancho se amplía al doble.
  3. Líneas menos oscuras (umbrales 80, 120, 160, 200), pero una línea de fila tiene que cruzar el 85 % del ancho (antes, el 50 %): el borde de una fila de etiquetas de color ya no parte una fila en dos.
  4. La cuadrícula solo vale si las columnas de los días miden casi lo mismo (`evenDays`: entre 0,6 y 1,5 veces la mediana, sin contar la más ancha, la de los nombres) y llegan hasta donde llegan las líneas de las filas (`wholeWidth`). Si no, se prueba el siguiente umbral; si ninguno vale, no es una tabla y se lee como texto.
  5. Las casillas se recortan de la imagen enderezada y ampliada. El resultado lleva `photo: { angle, blurry, enlarged }`.
- `core/roster.ts`, `parseRoster(…, photo)`: girada → se dice («La foto estaba girada 2°: se enderezó antes de leerla.»); borrosa (umbral > 80) → ninguna casilla vacía es segura; ampliada → ninguna casilla es segura. Los avisos salen en la revisión.
- Guía y guía del chat: lo explican (caso nuevo del chat `cuadrante_torcido`).

## Medidas

Batería de cuadrantes (R01–R15), por intento:

| Intento | Vistos como tabla | Exactos | Inventos |
|---|---|---|---|
| 0.61.0/0.62.0 | 8 | 3 | 0 |
| Enderezar + umbrales (filas al 50 %) | 14 | 3 | **3** (R03 personas de más; R06 «vacía» segura que era LIBRE; R07 fechas) |
| Filas al 85 % | 14 | 4 | **3** (R06, R07, R11) |
| + borrosa/ampliada nunca seguras + columnas regulares | 12 | 4 | **1** (R07: faltaban las dos últimas columnas) |
| + columnas hasta el final de las filas (versión entregada) | **12** | **4** | **0** |

Se descartaron los tres primeros intentos por crear inventos (garantía INVENTO = 0).

Versión entregada:
- Batería completa: 87 imágenes, **0 inventos**, **73 en su ideal** (0.61.0: 72). reports/bateria-imagenes-v0630.json.
- Ahora se leen como tabla: girada 2° (R03, **exacta**), desenfoque leve (R06), reducida al 50 % y JPG 35 (R07), dibujada girada 2° con ruido (R15). Siguen sin leerse, y se dice: girada 5° (R09: al girarla, la propia foto pierde los bordes de la tabla), 700 px de ancho (R11: casillas de 12 píxeles; ampliada, ninguna cuadrícula pasa las comprobaciones), JPG reducido al 70 % (R02), tabla sin líneas (R05).
- Cuadrantes sintéticos (scripts/evaluate-roster.cjs): sin cambios (45/0/11/0 y 56/0/0/0).
- Cuadrante real del usuario (work/cuadrante-real.png, va por el camino de siempre: recto, umbral 80): 46 seguras bien, 9 a revisar bien, 1 a revisar mal, **0 mal y seguras**. reports/cuadrantes-v0630.json.
- Fotos del Calendario: 8/12 y 0 inventos (igual).

## Corrección de un documento

El informe de 0.61.0 decía «tu cuadrante real: 56 seguras bien, 0 mal y seguras». No se reproduce: con las lecturas guardadas el 2026-10-05 (work/cuadrante-real.png.lecturas.json, sin volver a leer) y las reglas de 0.61.0, salen 46 seguras bien y 10 a revisar (work/score-real-cache.cjs); 56 es el total de casillas. Lo que sí se mantiene es la garantía: 0 mal y seguras. Las 10 a revisar son horas con dos lecturas distintas (11:00-15:00 / 11:00-16:00, 18:00 / 19:00) y una casilla con tinta sin leer.

## Pruebas

- `npm test`: 290/290 (nueva: foto enderezada, borrosa o ampliada en tests/roster.test.cjs).
- Chat: 63/63. reports/ai-chat-v0630.json.
- Prueba de escritorio: 24 PASS con el ejecutable 0.63.0 (reports/desktop-smoke-2026-10-06-v0630.txt).

## Límites

- Todo es sintético. Una foto real torcida de verdad puede tener perspectiva (no solo giro): eso no se corrige.
- El rescate tarda más (hasta unos 40 s en un cuadrante borroso).
