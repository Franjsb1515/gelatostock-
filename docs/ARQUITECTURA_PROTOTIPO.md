# Decisiones de arquitectura de 0.1.0

## Elegido

Electron 44.2.0 para una ventana de escritorio y runtime incluido. HTML/CSS/JavaScript sin framework ni recursos remotos. Núcleo de reglas en src/domain.cjs. Servidor HTTP integrado, solo loopback, en src/server.cjs. Arranque y aislamiento en src/desktop.cjs.

El navegador no tiene acceso a Node: contextIsolation y sandbox activos, nodeIntegration desactivado. Sesión local autenticada con cookie HttpOnly/SameSite y origen verificado para escrituras. No se abren enlaces externos ni ventanas nuevas. Credenciales de proveedores no existen en esta versión.

La decisión prioriza entregar una experiencia instalable/portable y verificable en Windows con pocos componentes de código. Electron aumenta el tamaño y consumo respecto a otras soluciones nativas: medir en Mac antes de fijar la tecnología de producción. No se ha afirmado que sea la opción definitiva para 8 GB.

## Datos

JSON versionado para el prototipo, con validación previa y reemplazo desde un archivo temporal. Una instancia Electron por perfil. No soporta varios procesos del servidor sobre la misma carpeta. Dinero en céntimos y cantidades redondeadas a tres decimales; presentación copiada al pedido para conservar su contexto.

Operaciones con ID deduplicable, revisión de estado y autorización de una versión del carrito. Recepción no supera lo pendiente. Una compra enviada no suma stock. Mensajes conservan original y no aceptan condiciones comerciales.

Fotografías codificadas dentro de los datos para facilitar una copia completa de demostración; límite total de 24 MB. Migrar a SQLite + archivos adjuntos antes de crecer. La app no sobrescribe un archivo inválido al arrancar.

## Mensajes

Eventos locales de simulación recorren clasificación, almacenamiento y aviso. Se prueban reentregas por identificador. No hay webhook de WhatsApp ni recepción mientras la app está cerrada. El clasificador actual usa expresiones regulares; no es IA y no entiende negaciones complejas ni todo el contexto.

## Distribución y disco

La carpeta portátil Windows incluye Electron; no necesita Node instalado. El acceso de la raíz dirige datos/perfil/temporales a la raíz de este proyecto. El ejecutable directo usa una carpeta data junto al binario. El paquete Mac se debe construir y validar por separado; firmar/notarizar es una fase pendiente.

Los documentos originales describen un instalador final con motor y modelo local incluidos. Esta versión distribuye solo el prototipo de gestión, sin modelo.

## Pruebas

node:test para reglas e integración. Playwright CLI para revisión de interfaz y capturas. Playwright Electron para ejecutar el binario real, modificar stock, cerrar/reabrir y comprobar rutas locales. La prueba offline bloquea recursos externos del renderer y deja loopback disponible; no desconecta físicamente la red del sistema.
