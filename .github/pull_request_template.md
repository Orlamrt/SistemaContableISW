## Resumen
- [ ] Incluye descripción clara del cambio y alcance por módulo

## Checklist RBAC (API)
- [ ] Middleware `requireAuth` y `requireRole` aplicado a rutas protegidas
- [ ] Validaciones de ownership o permisos específicas cubiertas
- [ ] Se actualizó `docs/openapi/openapi.yaml` con `x-roles`
- [ ] Pruebas unitarias o de integración para los roles afectados

## Checklist RBAC (UI)
- [ ] Menús y rutas condicionadas por rol
- [ ] Acciones no permitidas ocultas o deshabilitadas
- [ ] Comportamiento esperado en caso de 403 documentado

## Checklist Concurrencia
- [ ] Transacciones y/o locks revisados
- [ ] Idempotencia o control de versión documentado
- [ ] Nuevas migraciones probadas (incluye rollback si aplica)
