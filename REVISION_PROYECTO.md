# Revisión de La Tuba — 11 de noviembre de 2026

Revisión de código público/admin, compilación, análisis estático y pruebas directas de Supabase. No equivale a una validación visual de todas las pantallas ni a una compra real en un teléfono.

## Comprobado en Supabase

- 264 contactos: 1 cliente y 263 prospectos. 2 pedidos de La Tuba; ninguno de otro negocio.
- 38 productos de carta disponibles, todos con archivo de imagen local existente. No se comprobó visualmente la correspondencia foto/plato.
- Actualización del 13 de noviembre de 2026: se cargaron desde la carta proporcionada 24 presentaciones de productos tradicionales y 43 licores, cervezas y bebidas. Las presentaciones nuevas no tienen fotografías asignadas.
- Cero insumos y asociaciones de inventario; cero menús activos para hoy.
- Reservas: todos los días, 19:00, duración 120 minutos, seis personas por mesa y decoración de $50.000. Estos son los valores existentes, no nuevos valores propuestos.
- Probado con rol anónimo: catálogo, búsqueda por celular con prefijo 57, configuración y disponibilidad de reservas, creación de pedido y vinculación al contacto.
- Probado: un pedido convierte al prospecto en cliente; cancelar su único pedido lo devuelve a prospecto.
- Probado: reservar el lugar completo retira ese horario de la oferta pública.
- Las pruebas usaron una transacción con ROLLBACK. No quedaron pedidos, contactos, reservas ni cambios de configuración de prueba.

## Correcciones realizadas

- Contacto de La Tuba y pagos por Nequi: se configuró el número +57 311 373 1844, previa confirmación del negocio. Se conservaron los enlaces de contacto propios de Akora.
- Notificaciones del panel: Realtime quedó habilitado para pedidos y reservas, con consulta de respaldo cada 15 segundos. Falta una prueba visual del sonido y de la llegada de eventos con una sesión real.

- Registrar venta: búsqueda de productos por nombre, y selección de servicio en mesa (con número), para llevar o domicilio (con dirección y barrio). El domicilio se cotiza con la tarifa vigente de Supabase. La prueba transaccional de venta mixta y los tres servicios termina con `ROLLBACK`.

- Estadísticas administrativas: agregados por día, semana o mes con pedidos, montos, cobros, devoluciones, saldo, servicios, productos y reservas; los movimientos se cuentan por fecha de cobro y el acceso requiere administrador. Filtros de pedidos por fecha de creación en hora de Colombia. La prueba `node scripts/test-admin-statistics.mjs` revierte sus datos.

- Búsqueda de clientes: un nombre sin dígitos ya no coincide con todos los celulares.
- Descuentos: el descuento fijo se limita al valor base de los productos incluidos, evitando cobrar totales negativos o descontar el envío.
- Detalle administrativo del pedido: actualización de respaldo cada 30 segundos si Realtime no entrega eventos.
- Menú diario: editar su fecha actualiza el registro por ID; crear otro para una fecha ocupada produce un error en vez de sobrescribir silenciosamente.
- Menú público: comunica los errores de conexión, admite grupos de opciones omitidos y tolera un carrito almacenado que no sea una lista.
- Editor de menú: mensaje de error al cargar y corrección de textos con acentos dañados.
- Pedidos: Supabase recalcula catálogo, menú diario, domicilio y promociones; rechaza importes manipulados y obliga a refrescar el resumen si cambian.
- Inventario: las ventas descuentan insumos de forma atómica y la cancelación los devuelve.
- Promociones: el uso se incrementa dentro de la misma transacción del pedido y respeta el límite aun con solicitudes simultáneas.
- Ubicación: cada pedido a domicilio recibe un token temporal que solo permite actualizar sus coordenadas, sin exponer la tabla de pedidos.
- Pagos: los cobros y devoluciones quedan en un libro separado; “Ingresos” usa el importe efectivamente cobrado.
- Duplicados: pedidos, reservas y cobros tienen claves de idempotencia para que un reintento no cree registros dobles.
- Clientes: cédula, notas y etiquetas se guardan; la fusión reasigna pedidos y reservas, combina datos y recalcula estadísticas.
- Eventos y reseñas: hay agenda pública, formulario de reseña moderada y gestión administrativa para publicar, ocultar, aprobar y eliminar.
- Rendimiento: las páginas públicas y administrativas se cargan por demanda; el archivo inicial bajó de unos 829 kB a unos 360 kB sin comprimir.
- Validación visual: la nueva pantalla de eventos/reseñas se comprobó en 1440×1000 y 390×844; se corrigió el desbordamiento móvil detectado.
- Calidad estática: se corrigieron los 73 errores heredados sin desactivar reglas; `npm run lint -- --quiet` termina limpio.
- Administración: se validaron con la identidad administradora real los permisos y flujos de pedidos, clientes, inventario, reservas, catálogo, menús, eventos y reseñas. La prueba terminó con `ROLLBACK`.
- Toma de pedidos en administración: requiere nombre y celular válidos, crea o reutiliza el cliente por celular y permite guardar el pedido pendiente de pago o cobrarlo en ese momento. Ambos aparecen en Pedidos, vinculados al cliente y clasificados por menú, carta, bebida u otro producto.
- Toma de pedidos: búsqueda administrativa por nombre o celular en Clientes y Prospectos. Al seleccionar una persona se completan sus datos; también se puede registrar una nueva. La consulta se probó con la identidad administradora y datos revertidos con `ROLLBACK`.
- Catálogo: viche, curao, tomaseca, crema de viche, crema de naidí y arrechón están en Productos, con sus presentaciones y precios; la carta restante se cargó en Licores.
- Cobro posterior en caja: admite abonos y pago completo desde el detalle del pedido. El pago completo actualiza saldo y estado en una sola transacción; una devolución vuelve a dejarlo pendiente si corresponde. Los reintentos del mismo cobro no duplican movimientos.
- Edición de pedidos: se retiró del editor el configurador heredado de gomitas. Ahora permite cambiar cantidades, añadir otro menú del día, un producto disponible de carta/bebidas o un cargo fuera de carta con detalle e importe. El total y saldo se recalculan; si aumenta un pedido pagado vuelve a pendiente. La base impide guardar un total inferior a lo ya cobrado.

## Pendientes funcionales prioritarios

1. **WhatsApp real.** Hace falta configurar Meta WhatsApp Cloud API: identificador del número, token almacenado como secreto y nombres/idiomas de plantillas aprobadas. Los enlaces actuales siguen disponibles como respaldo.
2. **Activación operativa futura.** Cuando el negocio decida usar inventario, el administrador puede registrar insumos, existencia inicial, entradas/salidas y consumo por producto. El menú del día se carga cuando el negocio lo defina.
3. **Validación visual restante.** El backend administrativo quedó validado con la identidad real. Sigue pendiente comprobar el formulario de login y recorrer el panel en un navegador con la contraseña real, además de compra, reserva y geolocalización completas en un teléfono.

## Calidad y límites de esta revisión

- `npm run build` volvió a pasar después de las correcciones. El archivo inicial bajó a unos 360 kB sin comprimir mediante carga diferida de rutas.
- `npm run lint -- --quiet` pasa sin errores ni advertencias. No se desactivaron reglas para ocultarlos.
- Persisten utilidades de Firebase (`Timestamp`, `deleteField`) y recursos heredados de gomitas en el bundle; los servicios revisados de datos usan Supabase. No hay importaciones activas de `lib/firebase` desde otras partes de `src`.
- Ningún paquete JS generado supera ahora el aviso de 500 kB.
- Pendiente probar en navegador móvil y escritorio: login con credenciales reales, navegación completa, carrito, formularios, barras de tablas y permisos de geolocalización. No se verificó un despliegue público ni las redirecciones de recuperación de acceso.
- La recuperación pública por celular sin SMS sigue la decisión del usuario; conocer un número permite consultar los datos que devuelve ese RPC.

Pruebas repetibles: `node scripts/audit-project.mjs`, `node scripts/test-operations.mjs`, `node scripts/test-admin-flows.mjs`, `node scripts/test-register-sale.mjs` y `node scripts/test-edit-order.mjs`. Requieren la conexión local de base de datos, usan `ROLLBACK` para los datos de prueba y no imprimen secretos ni datos de clientes.
