# Criterios de Aceptación por Requisito Funcional

## RF-01 Autenticación (Login)
- Se muestra formulario con campos email y contraseña y validación instantánea.
- Permite iniciar sesión con credenciales válidas y retorna JWT vigente 8h.
- Bloquea tras 5 intentos fallidos con mensaje y desbloqueo tras 15 minutos.
- Registro de intentos fallidos en bitácora y métricas para monitoreo.

## RF-02 Recuperación de contraseña
- Usuario ingresa email y recibe enlace firmado con expiración ≤1h.
- Token se invalida tras un uso o al expirar.
- Flujo notifica éxito/fracaso y registra en bitácora.
- Pruebas cubren escenarios válido, expirado y token inválido.

## RF-03 Gestión de solicitudes
- Listado paginado con filtros por estado, tipo y fecha.
- Creación de nueva solicitud valida campos obligatorios y adjunta archivo.
- Transición de estados controlada por roles con historial auditable.
- UI muestra detalle, comentarios y trazabilidad de cambios.

## RF-04 Carga de archivos
- UI restringe formatos (PDF/CSV) y tamaño configurable.
- Backend valida MIME, extensión, hash y antivirus antes de almacenar.
- Respuestas claras con código y detalle de error.
- Registro de hash y metadatos en base de datos para deduplicación.

## RF-05 Gestión documental
- Repositorio documenta versiones con permisos por rol.
- Visor permite previsualizar PDF/CSV y descargar con tracking.
- Operaciones (crear, actualizar, archivar) requieren confirmación y quedan auditadas.
- Integración con solicitudes para adjuntar/consultar documentos.

## RF-06 Validación de archivos
- Servicio asíncrono procesa archivos y genera resultado (válido, con advertencias, rechazado).
- UI muestra estado en tiempo real con logs de validación.
- Errores críticos notifican al usuario y quedan disponibles para descarga.
- Reintentos configurables con política de backoff.

## RF-07 Panel de seguimiento
- Dashboard dinámico muestra KPIs por rol (solicitudes activas, SLA, alertas).
- Widgets interactivos con filtros por rango de fechas y tipo.
- Datos provenientes de endpoints agregados con caché y control de acceso.
- Registro de eventos de visualización para auditoría.

## RF-08 Informes
- Usuario puede solicitar generación de informe (PDF y CSV) y seguir progreso.
- Generación ocurre en job asíncrono, versiona resultado y almacena metadatos.
- Descarga requiere autorización y registra auditoría.
- Pruebas verifican contenido, firma y checksum del informe.

## RF-09 Notificaciones
- Sistema envía notificaciones in-app y correo en eventos clave (nueva solicitud, validación, informe).
- Centro de notificaciones permite marcar como leído y filtrar por tipo.
- Eventos usan cola con idempotencia y retries en caso de fallo.
- Historial accesible con filtros y exportación.

## RF-10 Postventa (tickets)
- UI permite crear ticket, responder, cerrar y reabrir.
- SLA calculado según prioridad y muestra estado restante.
- Notificaciones automáticas en vencimientos y actualizaciones.
- Reportes disponibles por cliente/agente.

## RF-11 Agenda
- Calendario permite crear, editar, cancelar reuniones con detección de conflictos.
- Recordatorios se envían por correo/notificación según preferencia.
- Integración opcional con calendarios externos (iCal export/import).
- Historial registra cambios y asistentes confirmados.

## RF-12 Monitoreo IA
- Definición de reglas/keywords para monitorear cumplimiento IA.
- Alertas generadas se muestran con severidad y evidencia vinculada.
- Revisiones requieren confirmación de auditor con bitácora de acciones.
- Panel de métricas muestra tendencias y acciones correctivas.

## RF-13 Historial
- Tabla de auditoría captura actor, recurso, acción, antes/después y timestamp.
- UI permite filtrar por fecha, módulo, usuario y exportar CSV/JSON.
- Endpoint soporta paginación, filtros y orden.
- Protección de integridad mediante firma o hash por registro.
