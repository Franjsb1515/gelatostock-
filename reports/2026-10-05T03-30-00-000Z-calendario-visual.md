# Calendario más cómodo · 0.51.0 · 2026-10-05

Encargo: «mejora visualmente el calendario, el orden y el espacio, que no se sienta cuadrado y apretado; ejecuta un solo agente en paralelo que te ayude».

## Cómo se hizo
- Capturas antes y después (work/shot-calendario.cjs, sobre una copia de data/ con un horario, unas vacaciones y una nota apuntados en la copia; vistas año, mes, día y semana a 1440 y a 1000 px, el mínimo de la ventana según src/desktop.cjs). Capturas en work/cal-*-antes.png y work/cal-*-despues.png / -estrecho.png (fuera de git).
- Un agente de solo lectura revisó los estilos en paralelo. Causa principal: ningún recuadro del Calendario tenía margen interior (`.panel` no lo tiene y el resto de la app usa cabecera y cuerpo con margen). Además: casillas de 78 px con hasta 8 líneas de 12 px, marcas de 10 px en mayúsculas, el resumen del mes en una sola frase y siete recuadros de alturas distintas en dos columnas. Aviso importante del agente: **Cruceros reutiliza clases cal-*** (cal-grid, cal-cell, cal-nav, cal-legend, cal-mark). Por eso todo lo nuevo va dentro de `<div class="cal">` y los estilos están bajo `.cal …`; Cruceros no cambia.

## Qué cambia en pantalla (src/ui/views-calendar.js, src/ui/calendar-photo.js, final de src/styles.css)
- Tarjetas con cabecera y cuerpo con margen (`calCard`), listas «nombre … cifra» (`cal-rows`) en lugar de tablas apretadas, secciones con título pequeño.
- Barra de navegación con flechas redondas y el título en la letra de los títulos de la app; ruta «2026 › septiembre › 29».
- Mes: cinco cifras en recuadros (vendido, hecho, merma, cierres, compras); casillas de 112 px, sin borde, con etiquetas de color suave (ventas, no abrió, horario, vacaciones, notas, pedidos, festivo, cruceros); «hoy» con el número en un círculo verde; cierre confirmado ✓ y avisos como insignias; fines de semana con un tono algo distinto; leyenda con muestras. Sin «—» en los días vacíos.
- Día: cabecera con la fecha y las etiquetas del día; «Gelato del día» a todo el ancho (antes la columna «Queda» se cortaba); debajo dos columnas: producción y mermas y compras / horario, notas, stock y fuera de la tienda. Las secciones vacías se resumen en una línea («Sin pedidos, entregas ni mensajes de proveedores este día»). Ingredientes del stock plegados en «Ingredientes y otros (11)».
- Año: tarjetas de mes con su nombre grande y sus cifras en filas.
- Semana: una fila por día (día, cerrado / abre–cierra, turnos con «–» entre horas) en lugar de una tabla; «Guardar la semana» queda fija abajo al desplazarse.
- Avisos: cada aviso en su franja rosa; sin avisos, una sola línea.
- «Subir foto» pasa a ser el botón principal de la cabecera.

## Pruebas
- npm test 232/232, format:check limpio.
- work/check-calendario-fase2.cjs y work/check-calendario-fotos.cjs: mismos resultados, sin errores de página. En el primero se cambió el selector del botón «Semana siguiente» (ahora es una flecha con ese nombre accesible).
- Prueba de escritorio 22 PASS con el ejecutable 0.51.0 (reports/desktop-smoke-2026-10-05-v0510.txt). Dos cambios en scripts/desktop-smoke.cjs, explicados:
  1. El estado «Reabierto» del día se busca en `.cal-day-top` (cabecera nueva) en lugar de `.cal-day-grid`, que ya no existe. Comprueba lo mismo.
  2. Hueco verificado de esta sesión, ajeno al Calendario: la prueba del «Vale desde» del Recetario fallaba entre las 00:00 y las 05:00. Calculaba «ayer» con el reloj y el formulario usa el día de negocio, así que a esa hora «ayer» y «hoy» eran la misma fecha. Ahora «ayer» es el día antes del «hoy» del formulario. La app estaba bien; la prueba no.
