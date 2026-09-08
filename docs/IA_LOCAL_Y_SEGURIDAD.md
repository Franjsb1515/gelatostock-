# IA integrada: alcance y revisión técnica · 0.8

## Función actual
Qwen3 0.6B en variante ONNX Q4, ejecutado con Transformers.js y ONNX Runtime en CPU. Es un modelo real incluido en el paquete Windows. No necesita cuenta, claves, Ollama ni servicios externos. No se cobran tokens; sí consume tiempo, CPU y RAM. El modelo y tokenizador ocupan aproximadamente 933 MB decimales. No es un asistente general ni aprende automáticamente de cada uso.

La pantalla IA local permite pegar texto. Fotos con OCR guardado, mensajes de demostración y textos importados de WhatsApp tienen un acceso que copia únicamente el texto seleccionado al editor. El usuario revisa el texto y pulsa Analizar. Propone factura, proforma, abono, albarán, lista de precios, oferta, mensaje u otro. La app muestra directamente los primeros 500 caracteres del original. El campo de explicación generado por el modelo se descarta: nunca se muestra como cita ni se utiliza para importes. Un encabezado incoherente, clasificación contradictoria o respuesta inválida exige revisión. Mostrar el original no demuestra que la etiqueta sea correcta.

No procesa aún PDF como imagen, no extrae facturas completas para contabilización ni cantidades para inventario y no clasifica automáticamente los adjuntos entrantes. No cambia proveedor, registra facturas, aprende equivalencias, compra o envía mensajes. El OCR y las reglas de identificación existentes siguen separados del modelo. Los pedidos continúan siendo simulados.

## Controles implementados
- API local autenticada: cookie de sesión aleatoria, verificación de origen/Host y JSON. Validación estricta: texto de 3–4.000 caracteres y modo standard/careful, cuerpo máximo 20.000 bytes.
- Un trabajo a la vez, 2 hilos CPU para inferencia, 1 para coordinación; máximo 180 tokens por lectura y 240 segundos por trabajo, cancelación y cierre del trabajador tras cada lectura. El límite de heap JavaScript es 512 MB; NO limita toda la memoria nativa de ONNX.
- Modelo de revisión fija y manifiesto SHA-256. Verificación de archivos antes de la primera lectura por proceso; no se descargan modelos durante el uso. Las huellas detectan corrupción/cambios respecto del manifiesto, no sustituyen una firma de distribución.
- Trabajador sin funciones para acceder al dominio, SQLite, WhatsApp o ejecutar acciones. Recibe solo el texto y el modo de lectura. Carga remota desactivada; fetch, conexiones de red y ejecución de procesos deshabilitadas dentro del trabajador como defensa adicional.
- Respuestas tratadas como datos, JSON con campos/valores permitidos y longitud limitada; texto escapado en la interfaz, sin ejecutar HTML, enlaces, SQL ni código generado.
- No se registran prompts ni respuestas del negocio en disco. Los scripts de evaluación guardan resultados de fixtures sintéticos, nunca de la base real. Editor/resultado quedan en memoria hasta sustituirlos o cerrar la app. No equivale a borrado forense: sistema operativo, memoria virtual y volcados están fuera de esa garantía.
- El modelo se carga bajo demanda y se libera tras cada lectura. Favorece memoria disponible frente a la velocidad de conversaciones continuas. La carga inicial se repite; no hay consumo periódico en segundo plano.

## Límites de seguridad reales
Es una primera función asistida, no una certificación de ausencia de fugas. Un worker de Node NO es un sandbox del sistema operativo; dependencias nativas se ejecutan con permisos del usuario. Malware local, cuenta Windows comprometida, paquetes alterados y vulnerabilidades desconocidas siguen siendo riesgos. No hay cifrado propio de la base ni controles multiusuario. Antes de uso de producción: revisión independiente, instaladores firmados, actualización verificada, permisos/retención y pruebas en el hardware objetivo.

WhatsApp es un canal separado que sí requiere internet y transmite datos a WhatsApp. El filtro de importación de proveedores no reduce los permisos del perfil vinculado de WhatsApp Web; sus credenciales se guardan en data/whatsapp/sessions. La IA no recibe ese perfil ni conversaciones completas. Las copias para Claude excluyen datos y sesiones.

## Calidad y adversarios
Se probaron documentos sintéticos, no una evaluación representativa de facturas españolas. Una primera versión generaba resúmenes y llegó a inventar contenido ante instrucciones incrustadas. Se eliminó ese resumen libre y se muestra únicamente un fragmento copiado del original por la propia app. Las instrucciones incrustadas siguen siendo contenido no fiable; pueden confundir la etiqueta. Por eso no existe un camino de salida del modelo hacia acciones y siempre se presenta como propuesta.

No se afirma funcionamiento probado en Mac, 8 GB ni una arquitectura específica del Mac del usuario. Este Windows tiene unos 16 GB. Falta medir carga/memoria y calidad con documentos autorizados reales y validar distribución nativa Mac.

## Reproducir
Instalar dependencias bloqueadas con npm ci siguiendo configuración en D; modelo excluido de Git y ZIP de fuentes. Ejecutar node scripts/setup-ai-model.cjs para descargar la revisión fijada en runtime/ai-model.json y verificar sus huellas; este paso de desarrollo requiere internet. npm run package:win incluye runtime/models y los binarios nativos. El usuario final copia el paquete completo y no descarga nada para utilizar la IA.

Dependencias fijadas: Transformers.js 4.2.0; overrides sharp 0.35.0 y adm-zip 0.6.0 corrigen avisos detectados al instalar. Verificar compatibilidad/auditoría antes de cambiar versiones.

## Fuentes
- Modelo convertido: https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX
- Modelo original y licencia Apache 2.0: https://huggingface.co/Qwen/Qwen3-0.6B
- Carga local sin modelos remotos: https://huggingface.co/docs/transformers.js/custom_usage
- Implementación efectiva contrastada con los paquetes instalados, no solo con documentación web.

## Revisión reforzada incorporada en 0.8
Por defecto realiza dos lecturas del mismo texto con instrucciones diferentes, sin mostrar a la segunda la primera respuesta. Coincidencia NO significa independencia estadística ni certeza: comparten modelo y pueden compartir errores. Si discrepan, la etiqueta pasa a Por revisar. Lectura simple reduce trabajo, conserva controles y sigue siendo propuesta.

Reglas separadas del modelo contrastan títulos en las primeras 12 líneas y detectan posibles instrucciones incrustadas por patrones limitados (no detector universal). Factura/proforma/abono/albarán/tarifa requieren encabezado reconocible para mantener esa etiqueta. Se evita tomar una mera mención de factura como documento de cobro. Esto reduce automatización en OCR defectuoso; no identifica automáticamente documentos sin encabezado.

Comprobación aritmética determinista en céntimos: requiere una base, una cuota de IVA y un total etiquetados en líneas separadas. Se abstiene con varias bases/cuotas, porcentajes sin importe, formatos ambiguos u otros conceptos detectados como portes/retenciones. Compara base + cuota con total; no valida tipos fiscales, precios, autenticidad ni toda la contabilidad. No guarda ni contabiliza importes.

Al editar el texto o cambiar el modo se retira el resultado anterior, evitando confundirlo con el documento nuevo.

## Elección del modelo y resultados reales
Se compararon Qwen3 0.6B Q8/Q4, Qwen3 1.7B Q8, Qwen2.5 1.5B Q8 y un clasificador MiniLM en pruebas aisladas. El tamaño mayor no justificó su adopción. La variante Q4 del modelo original produjo mejores etiquetas en el conjunto sintético de desarrollo con el mismo prompt (9/10 tras normalizar mayúsculas, antes de aplicar seguridad). No es una precisión estimada sobre documentos reales. Contratos de salida demasiado restrictivos también empeoraron la clasificación; se descartaron. No se atribuye una causa única universal a los errores numéricos sin más mediciones.

Evaluación reforzada rápida final: 2/3 clasificaciones esperadas; la tercera, una proforma, quedó explícitamente por revisar al discrepar las lecturas. El descuadre de total se detectó. Reporte ai-evaluation-v08-quick.json conserva esa limitación con pass:false; no se modificó la expectativa para ocultarla. Pico del proceso en esa prueba: ~2.257 MiB; latencias ~25–30 s. Falta corpus independiente, documentos reales autorizados y medición en Mac/8 GB.

El razonamiento general avanzado no está resuelto ni se garantiza cero errores. Esta entrega refuerza una tarea específica con modelo, contraste y reglas. Mantener revisión humana antes de cualquier futura acción.

## Ajustes 0.8.1
La comprobación aritmética reconoce además "IVA 21%", "IVA (21 %)", "Cuota IVA 10%", "Total a pagar" e "Importe a pagar" como etiquetas. Sigue exigiendo una sola base, una sola cuota y un total con importe; "IVA: 21%" sin importe o dos cuotas siguen sin comprobarse. El trabajador bloquea también tls, http2, dgram y dns dentro de Node; la dependencia nativa de ONNX sigue fuera de ese control y no existe sandbox del sistema operativo. Evaluación rápida repetida con el mismo modelo: ver reports/ai-evaluation-v081-quick.json.

## Chat de dudas 0.8.2
Mismo modelo, mismo trabajador y mismos bloqueos. Entrada validada: 1 a 6 mensajes con rol user/assistant de hasta 1.500 caracteres, el último del usuario, documento opcional de hasta 4.000 caracteres, sin campos extra. El sistema recibe una guía fija escrita a mano (src/ai-help.cjs) y el texto del editor como contenido no fiable. No recibe inventario, pedidos, mensajes guardados ni rutas. La salida se reduce a texto plano: se eliminan bloques de razonamiento y etiquetas, se limita a 1.200 caracteres y, si queda vacía, se muestra una frase fija de no respuesta. La interfaz vuelve a escapar el texto. El historial vive solo en memoria de la ventana.

Límites: un modelo de 0,6B parámetros puede responder de forma incompleta, genérica o incorrecta aunque la guía sea correcta; puede repetir instrucciones incrustadas en el texto del editor como si fueran contenido. Nada de lo que diga cambia datos. No sustituye la documentación ni la revisión humana. La calidad del chat no se ha medido con preguntas reales del usuario; la prueba de escritorio solo comprueba que responde texto plano no vacío sin tocar el stock.

## Respuestas de proveedores 0.9.0
La lectura principal es determinista (core/messages.ts): categoría por precedencia (falta de producto > cancelación > cambio > pregunta > fecha de entrega > confirmación > sin interpretar), fecha resuelta a partir de la fecha del mensaje (día de la semana, mañana, día del mes, dd/mm, en N días) y marca «debes leer» para todo lo que no sea confirmación o fecha sin retraso. Las promociones no exigen lectura. Es una regla: puede equivocarse con ironía, abreviaturas o mensajes largos; por eso lo no reconocido queda marcado para leer, nunca se descarta.

La segunda lectura con IA usa el mismo trabajador con dos prompts y un contrato cerrado {categoria}. Si discrepan o la salida no es válida, se anota «sin interpretar». La anotación (categoría, estado, modelo, hora) se guarda en el mensaje mediante la acción aiNote, que no toca pedidos ni stock. Evaluación sintética de 12 respuestas con modelo y reglas: ver reports/ai-replies-v090.json; no mide precisión con proveedores reales.

## Precisión en mensajes rutinarios (0.9.0)
La lectura fiable es la de reglas. Se afinó con 60 respuestas típicas y se comprobó con 20 escritas después: 15/20 en la primera pasada (los 5 fallos quedaron marcados «debes leer», ninguno aceptado en silencio) y 20/20 tras incorporar esos patrones. Ambos conjuntos son prueba de regresión; no son mensajes reales del negocio. Regla de diseño: cuando las reglas no reconocen la intención, el mensaje se marca para leer; nunca se descarta ni se actúa. La segunda lectura del modelo se compara en reports/ y se mantiene opcional.

## Auditoría 0.9.0
Sonda local work/attack.cjs (26 comprobaciones de autenticación, origen, tamaños, rutas, revisiones, CORS y CSP): 26/26. Cambios: la clave inicial ya no permanece en la URL (cookie + redirección), comparación de clave en tiempo constante, nosniff en JSON. Persistencia: copia validada en memoria con comprobación de revisión; el resto de conexiones sigue detectando conflictos. Los mensajes importados de WhatsApp se muestran con la lectura por reglas; la IA local sigue siendo opcional y solo anota.
