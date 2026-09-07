# Sesión 006 — Diseño de WhatsApp de proveedores

## Objetivo y trabajo realizado

Evaluar conexión por QR, recepción en tiempo real y limitación a proveedores/contactos autorizados. Se inspeccionó la app 0.5 y documentación actual de WhatsApp, Meta y una biblioteca de automatización Web. Se guardó docs/WHATSAPP_PROVEEDORES.md con rutas posibles, filtro antes de persistencia/OCR, requisitos offline y criterios de prueba.

Se recomienda evaluar primero WhatsApp Business Platform oficial. El QR de una sesión Web no limita el acceso a determinados chats; GelatoStock debe aplicar la lista autorizada después de recibir el evento. Automatización Web no oficial tiene riesgos de estabilidad y restricciones de cuenta. Coexistencia oficial debe comprobarse para la cuenta concreta; consulta directa a documentación Meta devolvió 429.

## Información pendiente

Se preguntó al usuario si usará WhatsApp Business del negocio, WhatsApp normal del negocio o un número personal compartido. Falta esa respuesta para concretar la ruta de conexión y requisitos. No se han conectado cuentas, instalado bibliotecas WhatsApp, publicado webhooks, contratado servicios ni generado QR.

## Verificación y estado

Solo documentación: revisada contra el estado del código y fuentes citadas. No cambió el código ni el ejecutable 0.5; no se repitieron pruebas de ejecución sin cambios. La recepción real sigue pendiente. El archivo de diseño separa funciones propuestas de implementadas.

## Siguiente paso

Confirmar tipo de número, acordar transporte y preparar configuración real compatible. Implementar lista autorizada y recepción con pruebas de remitentes ajenos, duplicados, adjuntos y desconexión. No prometer recepción con app cerrada sin receptor persistente comprobado.
