# Sesión 021 · Aprendizaje por correcciones y reglas ampliadas · versión 0.12.0

## Petición
Que la IA «aprenda» y que haya muchas más reglas de texto para entender más escenarios de mensajes.

## Qué significa aprender aquí
El modelo local no se entrena. La app aprende de la persona: cada corrección de lectura se guarda (frase normalizada + categoría) y se aplica a mensajes iguales o casi iguales (≥ 80 % de palabras en común). Es explicable, reversible (olvidar) y no generaliza a mensajes distintos. Lo aprendido va en el estado y en las copias.

## Reglas ampliadas (core/messages.ts)
- Categorías: falta, cancelación, cierre/vacaciones (nueva), pago o factura pendiente (nueva), cambio, pregunta o petición, documento enviado (nueva), entrega, confirmación, sin interpretar.
- Fechas: «3 de octubre», «mñn», «esta tarde», «antes de las 12» y «a primera hora» (como plazo), además de lo anterior.
- Patrones nuevos: faltas de ortografía («kedan»), «no hay reparto/nadie» ya no cuenta como falta de producto, promociones sin lectura obligatoria, peticiones («devuélveme», «necesito el CIF», «me puedes»), abonos y reclamaciones como cambio, «lo dejo en la puerta» como entrega, adjuntos de factura/albarán/catálogo como documento.
- Medición: corpus nuevo de 40 escenarios escrito antes de afinar: 21/40 con las reglas de 0.11.0, 40/40 después; corpus anterior 80/80 (un caso amplió su lista de aceptación: «Todo enviado, factura adjunta» también vale como documento). Ambos son pruebas de regresión.

## Cambios
- core/messages.ts: reescrito; exporta normalizePhrase, labels y matchLearned interno.
- core/schema.ts, domain.ts, store.ts: estado learned (id, patrón, categoría, ejemplo, fecha), acciones correctReading (remember opcional) y forgetLearned, tabla learned, user_version 3 (las bases 2 se abren sin migración de datos).
- src/ai.cjs y ai-worker.cjs: alias cierre/pago/documento para la segunda lectura del modelo.
- Interfaz: «Corregir lectura» en cada mensaje; distintivos «Corregido por ti» y «Aprendido de ti»; sección «Lo que la app ha aprendido de tus correcciones» en Configuración con olvido.

## Pruebas
- Dominio: corpus 2 completo, fechas nuevas, promoción sin lectura, corrección → recuerdo → aplicación a variante → olvido → sin recuerdo, corrección sin recordar.
- Almacén: persistencia de learned y versión 3.
- 105 pruebas; sonda de seguridad 26/26.

## Límites
- El aprendizaje es literal (frases casi iguales). Un mensaje nuevo con otras palabras sigue dependiendo de las reglas; cuando llegue el lote de mensajes reales del usuario, la cifra bajará y ese será el material para afinar.
- El modelo local sigue siendo opcional y débil; no se ha vuelto a medir tras añadir categorías.
