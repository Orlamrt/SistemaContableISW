# Guía RBAC y concurrencia

## Roles disponibles
| Rol      | Descripción breve | Accesos clave |
|----------|-------------------|---------------|
| ADMIN    | Configuración global y supervisión | Todas las rutas y dashboards, cambio de estados |
| AUDITOR  | Gestión documental y validaciones | Solicitudes, cumplimiento, informes (pendiente) |
| CLIENTE  | Portal del cliente | Crear solicitudes, ver estado, agenda, cumplimiento resumido |
| SOPORTE  | Atención postventa | Agenda y notificaciones (tickets pendiente) |

## Semilla de usuarios
Ejecuta `npm run seed` dentro de `Backend/` tras configurar `.env` con credenciales de MySQL. Se crearán usuarios:
- `admin@example.com` / `ChangeMe123!`
- `auditor@example.com` / `Auditor123!`
- `cliente@example.com` / `Cliente123!`
- `soporte@example.com` / `Soporte123!`

## Flujos destacados
1. **Autenticación**
   - Login y registro (CLIENTE) generan JWT con roles.
   - `/api/auth/me` refresca sesión en frontend.
2. **Solicitudes**
   - CLIENTE/AUDITOR crean solicitudes con archivo obligatorio (`Idempotency-Key` requerido).
   - ADMIN/AUDITOR pueden actualizar el estado con control optimista (`version`).
3. **Notificaciones**
   - Se crean al registrar o actualizar solicitudes.
   - Lectura disponible via `PATCH /api/notifications/{id}/read`.
4. **Agenda**
   - Todos los roles autenticados planifican reuniones; se evita solape de 30 minutos.
5. **Cumplimiento**
   - ADMIN/AUDITOR reciben lista completa; CLIENTE obtiene resumen.

## Concurrencia y resiliencia
- Transacciones con reintento automático (`withRetry`) para operaciones críticas.
- Tabla `audit_log` registra cambios relevantes (ej. actualización de estado de auditorías).
- `idempotency_keys` previene duplicados cuando el cliente reintenta.
- Considerar tareas pendientes de hash/antivirus antes de pasar a producción.

## Cómo probar
```bash
cd Backend
npm install
npm run seed  # Opcional, crea usuarios de prueba
npm start
```

Para ejecutar pruebas unitarias RBAC:
```bash
cd Backend
npm test
```

El frontend está compuesto por páginas estáticas. Abrir `dashboard.html` en un servidor estático (por ejemplo, `npm install -g serve && serve .`).
