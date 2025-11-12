# Auditoría de Base de Datos y Concurrencia

## Cambios introducidos
- Migración `001_rbac_and_concurrency.sql` agrega columnas `status`, `updated_at` y `version` a tablas principales (`users`, `audit_requests`, `notifications`, `meetings`, `password_resets`).
- Creación de tablas RBAC (`roles`, `permissions`, `user_roles`, `role_permissions`) y tablas de soporte (`idempotency_keys`, `audit_log`).
- FKs actualizadas con `ON DELETE/UPDATE CASCADE` para evitar registros huérfanos.
- Índices por `user_id` y `created_at` en tablas de alto volumen para acelerar listados.

## Controles de concurrencia
- **Optimista:** actualizaciones de estado en `audit_requests` usan comparación de `version`; conflictos devuelven HTTP 409.
- **Pesimista:** agendado de reuniones ejecuta `SELECT ... FOR UPDATE` para detectar solapes de 30 minutos.
- **Idempotencia:** encabezado `Idempotency-Key` persistido en `idempotency_keys` evita duplicados en `/api/audits`.
- **Reintentos:** helper `withRetry` reintenta transacciones ante deadlocks (errores 1205/1213).

## Recomendaciones pendientes
1. Registrar hash SHA-256 del archivo en `audit_requests` y exponer tamaño/MIME para auditoría.
2. Añadir tabla `validation_logs` para RF-06 con columnas (`audit_request_id`, `result`, `details`, `executed_at`).
3. Exponer API de consulta para `audit_log` con filtros por entidad y rango temporal.
4. Implementar job periódico que purgue tokens de `password_resets` expirados y entradas antiguas de `idempotency_keys`.
5. Monitorear métricas de pool (`connectionLimit`, `acquireTimeout`) y configurar alertas en CI.
