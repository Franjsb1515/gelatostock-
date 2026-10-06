# Lista de mejoras · abierta el 2026-10-05 (0.56.0)

Sale de dos revisiones con medidas: reports/2026-10-06T03-00-00-000Z-limpieza-textos.md (textos) y reports/2026-10-06T03-10-00-000Z-revision-visual-tablet.md (visual y tablets; cada punto «V…» o «T…» está allí con su cifra y su arreglo). Se marca aquí lo que se va haciendo.

## Hecho en 0.56.0
- [x] Kilos a hacer con − y + de 500 g en la tarjeta de producir.
- [x] «Preparar»: un ingrediente por pantalla, en el orden de la receta; «Hecho» al final.
- [x] «Orden de preparación» por receta en el Recetario.
- [x] Menos texto en 12 pantallas: 6200 → 5301 palabras, sin quitar avisos ni fórmulas.
- [x] «Escanea» en lugar de «Escaneá» en la pantalla de WhatsApp.

## Tabla de ingredientes y precios (de los dos jueces, 0.57.0)
- [x] Añadir al inventario sin nada preelegido; filas imposibles apartadas sin romper la tabla; página sin cabecera dicha; aviso de azúcar contado de dos formas; desbordamiento de la tabla.
- [x] Una lista de precios nueva puede sustituir a la anterior; un precio de «otro proveedor» no tapa la subida del habitual.
- [ ] Usar en el balance los rangos de tu tabla (y rangos de PAC y POD): falta tu decisión de qué fila vale para cada familia.
- [ ] Una sola forma de contar el azúcar: pasar las fichas antiguas a la de la tabla.
- [ ] Emparejar la tabla y la lista de precios con tus productos (hoy solo por nombre igual: 1 de 153 y 1 de 131).
- [x] Que los precios lleguen al carrito y a «Sugerir reposición» (0.58.0).
- [ ] Proponer «posibles iguales» (la leche de tres proveedores) para confirmar.
- [ ] «Usar este precio…»: comprobar la unidad, enseñar cuánto cambia el precio antes de aceptar.
- [ ] Lector de listas con otra forma: nombre en dos líneas, cabecera solo en la primera página, fila «TOTAL».
- [ ] Reimportar la tabla no retira las filas que ya no vienen; «Ver todo» no compara antes de sustituir; la contraseña del recetario no protege la tabla.
- [ ] Agrupar la tabla por tipo (lácteos, azúcares, frutas…): la tabla no lo dice; habría que marcarlo a mano.

## Textos
- [x] Pulido general del 2026-10-06 (reports/2026-10-06T06-00-00-000Z-pulido-de-textos.md): 56 puntos en pantalla y 16 frases de Guía y Ayudante; chat 60/60. Quedan para tu decisión: textos de «simular/demostración», datos de ejemplo en tu inventario, «Información pendiente de sincronización» (Cruceros) y los nombres que busca la prueba de escritorio («Producción a mano», «Corregir relevancia», «Registrar stock»).
- [x] Tarjeta «Recetario protegido» de Configuración («Estado: desbloqueado» → «Ahora mismo: abierto», sin «cifra el disco») y aviso falso «Ninguna receta coincide» del Recetario (2026-10-06).
- [x] Guía y Ayudante cuadran con las pantallas (WhatsApp «Por qué no ha entrado un mensaje», «Simular envío», «texto pegado en el Ayudante», «Exportar a hoja de cálculo»); evaluación del chat repetida: 60/60 (2026-10-06).
- [ ] [tú] Antes de entregar: «Simular mensaje», «Mensaje de demostración», «Envío simulado» siguen por tu decisión del 2026-09-20.
- [ ] Estilos sin uso tras la limpieza (.tip-card, .tracking-example): quitarlos.
- [ ] Actividad: 1264 palabras, casi todo datos; estudiar resumirla por día.

## Visual (con ratón, ordenador)
- [ ] Pestaña activa de Producción: blanco sobre verde claro, contraste 3,12:1 (mínimo 4,5).
- [ ] Texto pequeño: un 32 % de las letras por debajo de 14 px; en los modales, casi todo.
- [ ] Barra lateral a 1024×768: «Guía» y «Configuración» quedan fuera de la vista.
- [ ] 16 casillas de número sin − y + (cierre del día, nuevo producto, hoja de conteo, conteo, receta).
- [ ] Producción: 4,4 pantallas de alto; separar «Producir» de las ventas y la hoja diaria.

## Tablet táctil (primer paso: sirve también para una tablet con Windows)
- [ ] Botones y enlaces de al menos 44 px: hoy el 87 % (765 de 881) mide menos; el menú, 38 px; los enlaces de fila, 24–28 px.
- [ ] Compras a 768 px: cinco botones recortados («Marcar confirmado» no se puede pulsar).
- [ ] Inventario a 768 px: la página se sale de ancho y 52 botones de fila quedan fuera.
- [ ] Barra lateral: ocupa el 28 % a 768 px; plegarla en un botón por debajo de 1100 px.
- [ ] Producción a 768 px: cuatro tablas más anchas que su panel.
- [ ] La ventana no baja de 1000×700: permitir menos cuando lo anterior esté hecho.
- [ ] Probar en una tablet real (lo medido es en este ordenador, sin pantalla táctil).

## iPad o Android (plan propio, grande; necesita tu decisión)
La app no corre en esas tablets. Se podría abrir desde su navegador contra el ordenador de la tienda por la wifi, pero hoy la app solo se deja ver desde el propio ordenador, a propósito. Abrirla exige: un interruptor apagado por defecto, una clave por aparato, permisos recortados (producir, pesar, contar, cerrar; sin WhatsApp, copias ni Configuración) y una wifi que no sea la de clientes.
- [ ] [tú] Decidir: ¿qué tablet (Windows o iPad/Android)? ¿Sustituye al ordenador o lo acompaña? ¿Vertical o apaisada? ¿Hay wifi separada de la de clientes? ¿Qué tareas se harán desde ella?
