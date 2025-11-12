# Criterios de aceptación por requisito funcional

## RF-01 Autenticación (Login)
- Formularios de login/registro disponibles para usuarios públicos.
- Login válido devuelve JWT con roles y permisos del usuario.
- Endpoint `/auth/me` protegido disponible para recuperar sesión.
- **Pendiente:** bloqueo automático tras intentos fallidos y métricas en CI.

## RF-02 Recuperación de contraseña
- Flujo de recuperación genera token con hash y expiración de 1 hora.
- Reset de contraseña invalida el token y actualiza la versión del usuario.
- **Pendiente:** envío de correo productivo y pruebas de expiración.

## RF-03 Gestión de solicitudes
- Roles CLIENTE/AUDITOR/ADMIN pueden crear solicitudes (con archivo obligatorio) y reciben notificación.
- Listado de solicitudes filtra por estado y respeta ownership del CLIENTE.
- Cambio de estado con control optimista y notificación al solicitante.
- **Pendiente:** detalle enriquecido, paginación y descarga segura del adjunto.

## RF-04 Carga de archivos
- Validación de tipo/tamaño en frontend y backend con soporte para Idempotency-Key.
- Los archivos se almacenan en `/uploads` y quedan ligados a la solicitud.
- **Pendiente:** cálculo de hash, análisis antivirus y política de retención.

## RF-05 Gestión documental
- **Pendiente en esta iteración.** No existe repositorio versionado ni endpoints específicos.

## RF-06 Validación de archivos
- **Pendiente en esta iteración.** Falta motor de validación y registro de resultados.

## RF-07 Panel de seguimiento
- Dashboard consulta `/dashboard/summary` y ajusta KPIs según rol.
- Modal de seguimiento disponible y navegación oculta opciones según permisos.
- **Pendiente:** gráficos interactivos y filtros temporales avanzados.

## RF-08 Informes
- **Pendiente en esta iteración.** No hay generación ni descarga de informes.

## RF-09 Notificaciones
- Listado protegido para cada usuario con marca de leídos vía API.
- Se crean notificaciones en eventos de auditoría.
- **Pendiente:** entrega multicanal y marcación directa desde UI.

## RF-10 Postventa (tickets)
- **Pendiente en esta iteración.** Falta modelo de tickets y UI asociada.

## RF-11 Agenda
- Calendario permite crear reuniones evitando conflictos de 30 minutos mediante locking.
- Roles autorizados: ADMIN, AUDITOR, CLIENTE, SOPORTE.
- **Pendiente:** invitaciones a terceros, recordatorios y edición/cancelación.

## RF-12 Monitoreo IA
- Resumen `/compliance/summary` devuelve vista completa (ADMIN/AUDITOR) o resumida (CLIENTE).
- **Pendiente:** motor de reglas IA y gestión de alertas contextual.

## RF-13 Historial
- Tabla `audit_log` registra cambios clave (estado de auditorías).
- **Pendiente:** exponer API/UI para consulta, firma de registros y exportaciones.
