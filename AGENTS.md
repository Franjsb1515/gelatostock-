# Instrucciones de continuidad

- Este proyecto pertenece a un negocio de gelatería, café y postres en España.
- El usuario solicita guardar el proyecto, dependencias, temporales y entregas en D, evitando C en lo posible. En esta máquina trabajar en D:/APPGELATOSTOCK.
- Leer README.md, TODO.md, CHANGELOG.md y el informe más reciente antes de modificar código.
- Mantener la operación offline y los datos locales. No incorporar APIs de IA pagadas ni llamadas externas ocultas.
- No presentar reglas como IA ni simulaciones como integraciones reales.
- No enviar mensajes reales ni realizar compras durante pruebas sin autorización explícita para esa prueba.
- Implementar solo lo necesario para la tarea. Justificar cambios de arquitectura; no reescribir por preferencia personal.
- Cada cambio debe verificarse con pruebas pertinentes. UI: revisar pantalla; reglas de stock/pedidos: pruebas automáticas; persistencia: prueba de reinicio/recuperación.
- No borrar datos del usuario para hacer pasar pruebas. Usar carpetas de fixtures en work/.
- No modificar pruebas únicamente para ocultar un fallo; explicar cualquier cambio de expectativa.
- Después de cambiar src/, reconstruir el ejecutable si se entrega al usuario. No dejar fuente y binario desfasados sin advertirlo.
- Al final de cada sesión actualizar TODO.md y CHANGELOG.md; crear un informe en reports/ con resumen, archivos, pruebas, limitaciones y siguiente paso. Usar scripts/new-session.cjs como plantilla, completándola manualmente.
- Conservar informes previos. El script crea también un diff de cambios sin commit cuando Git está disponible; no incluye archivos nuevos sin seguimiento ni sustituye un commit.
- No marcar tareas probadas en Mac desde una ejecución en Windows.
