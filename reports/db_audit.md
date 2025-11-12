# Auditoría de Base de Datos y Concurrencia

## Resumen del modelo actual
- Motor objetivo: MySQL (mysql2/promise en Backend/server.js).
- Script `auditoria.sql` crea esquema `auditoria_digital` con tablas: `users`, `audit_requests`, `notifications`, `meetings`, `compliance_logs`, `password_resets`.
- Relaciones directas: cada entidad hija referencia a `users(id)` sin cláusulas `ON DELETE/UPDATE` explícitas.
- No existen índices adicionales más allá de PK ni restricciones `CHECK`/`UNIQUE` adicionales.

## Hallazgos de integridad
1. **Claves foráneas sin política ON DELETE/UPDATE**: provoca huérfanos al eliminar usuarios o solicitudes. Recomendado `ON DELETE CASCADE` para dependencias directas y `ON UPDATE CASCADE` para mantener integridad.
2. **Faltan restricciones NOT NULL**: campos como `file_path` en `audit_requests` permiten `NULL` aunque la lógica exige archivo obligatorio; definir `NOT NULL` y valores por defecto consistentes.
3. **Ausencia de columnas de versionado**: no hay control de concurrencia optimista (`version` o `updated_at` con verificación), lo cual impide detectar colisiones de edición concurrente.
4. **Sin índices para consultas comunes**: endpoints filtran por `user_id` y ordenan por fechas; agregar índices compuestos (`user_id`, `created_at`) en `audit_requests`, `notifications`, `meetings`.
5. **Tokens de recuperación almacenados en texto plano**: columna `token` en `password_resets` guarda valores sin hash; se recomienda almacenar hash y agregar índice único.
6. **Campos ENUM limitados**: `audit_requests.status` carece de estados para validación asíncrona (ej. `validando`, `rechazada`) y no se documenta transición.

## Concurrencia y transacciones
- El backend ejecuta operaciones independientes con `pool.query` sin transacciones, aun cuando se insertan registros en múltiples tablas (ej. registrar solicitud y notificación). Debe envolver en transacción con `pool.getConnection()` y `BEGIN/COMMIT/ROLLBACK`.
- Nivel de aislamiento: MySQL por defecto `REPEATABLE READ`; no se fija explícitamente. Mantener `REPEATABLE READ` y evaluar `SERIALIZABLE` en operaciones críticas (asignación de reuniones) para evitar solapes.
- **Bloqueos necesarios**:
  - `SELECT ... FOR UPDATE` al verificar existencia de usuario para recuperación de contraseña y al consumir tokens.
  - Control de agenda: asegurar que al crear reunión se valide disponibilidad con `FOR UPDATE` sobre registros coincidentes en rango.
- **Locking optimista**: agregar columna `version INT DEFAULT 0` en tablas `audit_requests`, `meetings`, `notifications` para detectar actualizaciones simultáneas.
- **Reintentos**: no se implementan reintentos ante `ER_LOCK_DEADLOCK (1213)`; definir estrategia de backoff exponencial.
- **Idempotencia**: endpoints como `/api/audits` deberían aceptar `Idempotency-Key` y registrar hash de archivo para evitar duplicados por reintentos.

## Migraciones recomendadas
Implementar migraciones idempotentes con archivos en `backend/migrations/` (pendiente). Cambios sugeridos:
```sql
ALTER TABLE audit_requests
  MODIFY file_path VARCHAR(255) NOT NULL,
  ADD COLUMN version INT NOT NULL DEFAULT 0,
  ADD INDEX idx_audit_requests_user_created (user_id, created_at);

ALTER TABLE notifications
  ADD COLUMN version INT NOT NULL DEFAULT 0,
  ADD INDEX idx_notifications_user_created (user_id, created_at),
  ADD CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE meetings
  ADD COLUMN version INT NOT NULL DEFAULT 0,
  ADD INDEX idx_meetings_user_schedule (user_id, scheduled_at),
  ADD CONSTRAINT fk_meetings_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE audit_requests
  ADD CONSTRAINT fk_audit_requests_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE password_resets
  ADD COLUMN token_hash VARBINARY(32) NOT NULL AFTER token,
  ADD UNIQUE INDEX uq_password_resets_hash (token_hash);
```
(Definir columnas físicas `token_hash` + trigger o almacenar hash directamente al insertar.)

## Manejo de transacciones propuesto
- **Registro de solicitud**: iniciar transacción, insertar en `audit_requests`, registrar hash de archivo y crear notificación relacionada; confirmar o revertir.
- **Recuperación de contraseña**: transacción que inserte token y marque como usado tras validación, con `FOR UPDATE` sobre fila del token.
- **Agenda**: al crear reunión, `SELECT ... FOR UPDATE` sobre registros que se solapen (`scheduled_at` en rango) para evitar doble reserva.

## Deadlocks y reintentos
- Implementar helper que capture códigos `1213`/`1205` y reintente hasta 3 veces con backoff exponencial (`100ms`, `250ms`, `500ms` + jitter).
- Registrar métricas de reintentos y fallos definitivos en logs estructurados.

## Auditoría y trazabilidad
- Crear tabla `audit_log` con columnas (`id`, `entity`, `entity_id`, `action`, `actor_id`, `before_data`, `after_data`, `created_at`) y disparadores o capa de servicio que inserte registros en cada operación crítica.
- Incluir `request_id` y `user_id` en logs de aplicación y almacenar en tabla para RF-13.

## Observabilidad
- Habilitar métricas de conexión (pool size, timeouts) y logs de SQL lentas.
- Definir `ENV` para `DB_POOL_MAX`, `DB_POOL_MIN`, `DB_CONNECT_TIMEOUT` y validarlos al inicio.

## Próximos pasos
1. Crear migraciones versionadas que apliquen cambios de estructura e índices.
2. Actualizar capa de acceso a datos para usar transacciones y locks adecuados.
3. Implementar control de versiones optimista y manejo de conflictos (HTTP 409).
4. Añadir pruebas de concurrencia (simulación de doble subida de archivo, doble reunión).
5. Documentar en `/docs/openapi/openapi.yaml` los cambios y políticas de idempotencia.
