# Sesión 038 · Cruceros como herramienta de planificación · versión 0.25.0

## Encargo
El usuario entregó un prompt maestro de 50 puntos para el módulo Cruceros y pidió analizarlo antes de programar. Se acordaron seis ajustes (abajo) y una regla por encima de todas: no inventar datos.

## Implementado
- Panel de hoy (cruceros, pasajeros declarados, mayor concentración, impacto potencial, próxima llegada, barcos ahora en puerto) y mañana de un vistazo.
- Próximos 7 y 30 días, calendario mensual navegable hacia el pasado y registro con buscador (barco, naviera, puerto, IMO) y filtro por estado. Filtro «solo impacto alto o muy alto».
- Detalle del día: resumen, línea temporal de cruceros en puerto por hora (barras SVG y lista), máxima coincidencia con su franja y sus pasajeros, tarjetas por barco y escalas retiradas aparte.
- Por escala: «Historial y origen» (identificador oficial, fuente, primera vez vista, última verificación, actualización de la fuente, horario previsto frente al real y cambios con antes/después). Por barco: ficha manual de naviera, capacidad y tripulación, con fuente obligatoria.
- Estado de sincronización siempre visible: Datos actualizados, Actualizando…, Datos posiblemente desactualizados, Error de sincronización, Información pendiente de sincronización. Registro de sincronizaciones consultable.
- Resumen avisa de los cruceros de hoy con su impacto; Semana muestra los cruceros de cada día junto a las ventas (hechos, sin correlación).

## Fuente de datos
- Única fuente: Autoridad Portuaria de Baleares, visor público de previsión de tráfico (ficha de datos abiertos «Previsión de tráfico marítimo» en datos.gob.es). Tres consultas: previsión vigente, hora de actualización de la fuente e histórico de cruceros de Palma. No existe API documentada ni CSV directo: la ficha remite al visor, y la app usa el mismo JSON que el visor pide con sesión anónima.
- Sin fuentes secundarias automáticas: CruiseDig y VesselFinder no ofrecen acceso automatizado gratuito y sus condiciones no lo permiten. Sin fotografías: no hay fuente legal y estable.

## Prioridad de fuentes
- Manda la APB en todo lo portuario. Lo único ajeno a ella es la ficha manual del barco (naviera, capacidad, tripulación), que se guarda con su fuente, se rotula «Dato manual» y no interviene en ningún cálculo.

## Actualización
- 3 h si hay barcos hoy o mañana, 6 h si los hay en 7 días, 12 h en otro caso (la fuente se actualiza aproximadamente una vez al día). El temporizador pregunta cada 10 minutos si toca. Tras fallos: 5 min, 15 min, 1 h, 3 h. Un reintento por consulta, solo ante fallo de red. Tiempo límite 45 s. Cada consulta trae además las 60 escalas finalizadas más recientes para cerrar las de ayer con horas reales. El histórico desde 2014 se importa una sola vez, por páginas de 1000 con pausas de 4 s, y continúa donde se quedó si se interrumpe.

## Base de datos
- Nueva data/cruceros.sqlite, separada del inventario. Tablas: ships (clave IMO; nombre, y datos manuales con su fuente), calls (identificador oficial P-año-número de escala; horas del puerto, horario previsto aparte del real, pasajeros por operación, retirada, procedencia, fuente, url, actualización de la fuente, primera vez vista, última verificación), changes (historial de cambios por escala), syncs (duración, filas, escalas, nuevas, cambiadas, sin cambios, rechazadas, retiradas, restauradas, error; se conservan 200) y meta. Índices por llegada, salida, barco, IMO y estado. Copia coherente cruceros-copia.sqlite junto a la copia diaria y en la carpeta secundaria.
- Ajustes nuevos en la base principal: cruise_thresholds. Se retira cruceros.json de 0.24.0 (queda como cruceros.json.anterior).

## Cálculos
- Pasajeros declarados (DERIVADO) = en tránsito + el mayor entre desembarque y embarque, con las cifras que el barco declara al puerto; null si no declara nada. La fuente llama «trasbordo» al tránsito.
- Impacto potencial = nivel de la mayor suma de pasajeros declarados que coinciden a la vez en puerto ese día. Sin barcos: Sin cruceros. Ninguno declara: No calculable. Menos de 3.000: Bajo; menos de 6.000: Medio; menos de 10.000: Alto; si no, Muy alto. Umbrales editables en Configuración. Sin factores ocultos ni IA.
- Máxima simultaneidad: barrido de los intervalos reales de llegada y salida recortados al día; primera franja continua con el máximo de barcos.
- Tipo de escala: solo de las operaciones declaradas (solo tránsito, solo embarque/desembarque, o mixta); nunca de los horarios.
- Duración de la escala con instantes reales: la noche del cambio de hora de octubre cuenta 9 h entre las 22:00 y las 06:00, y la de marzo 7 h.

## Archivos
- Nuevos: core/cruises.ts, src/cruises/provider-apb.cjs, src/cruises/repository.cjs, src/cruises/service.cjs.
- Reescritos: src/ui/views-cruises.js, tests/cruises.test.cjs. Eliminado: src/cruises.cjs.
- Modificados: src/server.cjs (rutas /api/cruises, /range, /day, /call, /search, /syncs; POST sync, ship, thresholds; informe semanal; copia), src/ui/actions.js, events.js, views.js, views-weekly.js, styles.css, scripts/desktop-smoke.cjs, guía, ayuda del chat y documentos.

## Tests
- tests/cruises.test.cjs, 8 pruebas: hora de Palma con verano, invierno y cambios de hora, y «hoy» con el equipo en otra zona; pasajeros con «cero» distinto de «no disponible» y cifras absurdas descartadas; respuesta externa incorrecta (otro puerto, otro tipo, HTML en el nombre, fecha inexistente, salida anterior a la llegada, estancia de 40 días, fila corta, null) con motivos de rechazo; crucero normal 08–18; nocturno 22–06 presente en sus dos días; tres simultáneos con pico 09–16 y 9.300 pasajeros; datos faltantes (sin pasajeros, muelle, puerto anterior, IMO); estados; integridad con solapes; intervalos y esperas; cambio de horario sin duplicar y con historial; retirada y restauración de la misma fila; mismo IMO con otro nombre = un barco; dato declarado que no se pierde; horas reales del histórico que no cuentan como cambio de horario; previsión vacía o HTML que no retira nada; fuente caída con error visible, datos intactos y espera creciente; datos viejos avisados; ficha manual sin fuente rechazada; histórico por páginas una sola vez; rutas del servidor con permisos, umbrales, interruptor, informe semanal y copia.
- Total del proyecto y evidencia de paquete y prueba de escritorio al pie.

## Validación manual contra la fuente
- 2026-09-18, visor oficial (pestaña «Previsión de tráfico», tabla renderizada) frente a la app. MEIN SCHIFF 6: Barcelona → Ajaccio, 18/09 04:00–22:00, Alin. Norte de la Plataforma, Intercruises, 98.811 GT, escala 741, Malta. SIRENA: Alicante → Malta (Valetta), 07:00–15:00, M. 2ª Alin. Poniente Sur, escala 1083. MSC GRANDIOSA: Civitavecchia → Barcelona, 08:00–21:00, Ampliación Muelle Poniente Norte, escala 1100. Coinciden nombre, fecha, llegada, salida, muelle, consignatario, arqueo, bandera y número de escala. Estado «Concedido» en los tres.
- Histórico: COSTA PACIFICA 15/09 09:16–21:05 y MARELLA DISCOVERY 2 15/09 05:21–22:07, «Finalizado», iguales a la respuesta de la fuente.
- Importación real completa: 5.903 escalas desde el 3 de enero de 2014, 290 barcos, 0 rechazadas, 0 avisos de integridad, 129 s, 3,4 MB. Escalas con pasajeros declarados por año: 139 de 474 en 2014; entre el 81 % y el 98 % desde 2015.

## Limitaciones
- La fuente no publica naviera, capacidad, terminal, retrasos ni cancelaciones. No hay pasajeros realmente desembarcados: solo lo declarado por el barco.
- «Retirada de la previsión» no equivale a cancelación: la fuente no da el motivo.
- En la hora repetida del cambio de octubre se toma la primera; la fuente no las distingue.
- Servicio sin documentación ni garantía de continuidad. Si cambia, las filas se rechazan y se conserva lo guardado.
- La app entera no se adapta a ventanas de menos de unos 700 px (la barra lateral no se pliega); dentro del módulo, tarjetas y calendario sí se adaptan. No hay modo oscuro en la app.
- Filtros reducidos a texto, estado e impacto por acuerdo con el usuario; fecha por calendario.

## Pendientes recomendados
- Comparar ventas por nivel de impacto cuando haya meses de ventas registradas.
- Restaurar cruceros-copia.sqlite desde la interfaz.
- Clima, festivos y eventos de Palma como adaptadores nuevos con la misma forma que el de la APB.

## Evidencia final
- npm test: 142 aprobadas (reports/tests-2026-09-18-v0250.txt). npm run format:check: aprobado.
- npm run package:win: dist/GelatoStock-0.25.0-win32-x64.
- npm run test:desktop: 14 PASS (completa). reports/desktop-smoke-2026-09-18-v0250.txt.
- node scripts/evaluate-ai.cjs --chat: 19/19 (reports/ai-chat-v0250.json).

## Estado de archivos al crear este informe
```text
 M "ABRIR GELATOSTOCK.vbs"
 M CHANGELOG.md
 M CLAUDE.md
 M README.md
 M TODO.md
 M docs/GUIA_USO.md
 M docs/IA_LOCAL_Y_SEGURIDAD.md
 M package-lock.json
 M package.json
 M scripts/desktop-smoke.cjs
 M src/ai-help.cjs
D  src/cruises.cjs
 M src/server.cjs
 M src/styles.css
 M src/ui/actions.js
 M src/ui/events.js
 M src/ui/guide.js
D  src/ui/views-cruises.js
 M src/ui/views-weekly.js
 M src/ui/views.js
 M tests/cruises.test.cjs
?? core/cruises.ts
?? reports/2026-09-17T23-07-26-548Z-cruceros-planificacion.md
?? reports/ai-chat-v0250.json
?? reports/design/0250-cruceros-calendario.png
?? reports/design/0250-cruceros-dia.png
?? reports/design/0250-cruceros-panel.png
?? reports/desktop-smoke-2026-09-18-v0250.txt
?? reports/tests-2026-09-18-v0250.txt
?? src/cruises/
?? src/ui/views-cruises.js
```
