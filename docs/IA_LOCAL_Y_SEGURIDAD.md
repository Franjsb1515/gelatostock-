# IA integrada: alcance y revisión técnica · 0.7

## Función actual
Qwen3 0.6B cuantizado Q8, ejecutado con Transformers.js y ONNX Runtime en CPU. Es un modelo real incluido en el paquete Windows. No necesita cuenta, claves, Ollama ni servicios externos. No se cobran tokens; sí consume tiempo, CPU y RAM. El modelo y tokenizador ocupan aproximadamente 632 MB decimales. No es un asistente general ni aprende automáticamente de cada uso.

La pantalla IA local permite pegar texto. Fotos con OCR guardado, mensajes de demostración y textos importados de WhatsApp tienen un acceso que copia únicamente el texto seleccionado al editor. El usuario revisa el texto y pulsa Analizar. Propone factura, albarán, lista de precios, oferta, mensaje u otro, acompañados de un fragmento literal contrastado con el original. Si la estructura o la cita no son válidas, queda por revisar. Esa comprobación evita citas inventadas, pero no demuestra que el tipo propuesto sea correcto.

No procesa aún PDF como imagen, no extrae importes contables ni cantidades para inventario y no clasifica automáticamente los adjuntos entrantes. No cambia proveedor, registra facturas, aprende equivalencias, compra o envía mensajes. El OCR y las reglas de identificación existentes siguen separados del modelo. Los pedidos continúan siendo simulados.

## Controles implementados
- API local autenticada: cookie de sesión aleatoria, verificación de origen/Host y JSON. Validación estricta: solo texto, 3–4.000 caracteres, cuerpo máximo 20.000 bytes.
- Un trabajo a la vez, 2 hilos CPU para inferencia, 1 para coordinación; máximo 160 tokens de salida y 120 segundos de inferencia, cancelación y cierre del trabajador tras cada lectura. El límite de heap JavaScript es 512 MB; NO limita toda la memoria nativa de ONNX.
- Modelo de revisión fija y manifiesto SHA-256. Verificación de archivos antes de la primera lectura por proceso; no se descargan modelos durante el uso. Las huellas detectan corrupción/cambios respecto del manifiesto, no sustituyen una firma de distribución.
- Trabajador sin funciones para acceder al dominio, SQLite, WhatsApp o ejecutar acciones. Recibe solo el texto. Carga remota desactivada; fetch, conexiones de red y ejecución de procesos deshabilitadas dentro del trabajador como defensa adicional.
- Respuestas tratadas como datos, JSON con campos/valores permitidos y longitud limitada; texto escapado en la interfaz, sin ejecutar HTML, enlaces, SQL ni código generado.
- No se registran prompts ni respuestas en disco. Editor/resultado quedan en memoria hasta sustituirlos o cerrar la app. No equivale a borrado forense: sistema operativo, memoria virtual y volcados están fuera de esa garantía.
- El modelo se carga bajo demanda y se libera tras cada lectura. Favorece memoria disponible frente a la velocidad de conversaciones continuas. La carga inicial se repite; no hay consumo periódico en segundo plano.

## Límites de seguridad reales
Es una primera función asistida, no una certificación de ausencia de fugas. Un worker de Node NO es un sandbox del sistema operativo; dependencias nativas se ejecutan con permisos del usuario. Malware local, cuenta Windows comprometida, paquetes alterados y vulnerabilidades desconocidas siguen siendo riesgos. No hay cifrado propio de la base ni controles multiusuario. Antes de uso de producción: revisión independiente, instaladores firmados, actualización verificada, permisos/retención y pruebas en el hardware objetivo.

WhatsApp es un canal separado que sí requiere internet y transmite datos a WhatsApp. El filtro de importación de proveedores no reduce los permisos del perfil vinculado de WhatsApp Web; sus credenciales se guardan en data/whatsapp/sessions. La IA no recibe ese perfil ni conversaciones completas. Las copias para Claude excluyen datos y sesiones.

## Calidad y adversarios
Se probaron documentos sintéticos, no una evaluación representativa de facturas españolas. Una primera versión generaba resúmenes y llegó a inventar contenido ante instrucciones incrustadas. Se eliminó ese resumen libre y se exige un fragmento literal comprobable. Las instrucciones incrustadas siguen siendo contenido no fiable; pueden confundir la etiqueta. Por eso no existe un camino de salida del modelo hacia acciones y siempre se presenta como propuesta.

No se afirma funcionamiento probado en Mac, 8 GB ni una arquitectura específica del Mac del usuario. Este Windows tiene unos 16 GB. Falta medir carga/memoria y calidad con documentos autorizados reales y validar distribución nativa Mac.

## Reproducir
Instalar dependencias bloqueadas con npm ci siguiendo configuración en D; modelo excluido de Git y ZIP de fuentes. Ejecutar node scripts/setup-ai-model.cjs para descargar la revisión fijada en runtime/ai-model.json y verificar sus huellas; este paso de desarrollo requiere internet. npm run package:win incluye runtime/models y los binarios nativos. El usuario final copia el paquete completo y no descarga nada para utilizar la IA.

Dependencias fijadas: Transformers.js 4.2.0; overrides sharp 0.35.0 y adm-zip 0.6.0 corrigen avisos detectados al instalar. Verificar compatibilidad/auditoría antes de cambiar versiones.

## Fuentes
- Modelo convertido: https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX
- Modelo original y licencia Apache 2.0: https://huggingface.co/Qwen/Qwen3-0.6B
- Carga local sin modelos remotos: https://huggingface.co/docs/transformers.js/custom_usage
- Implementación efectiva contrastada con los paquetes instalados, no solo con documentación web.
