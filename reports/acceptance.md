# Criterios de aceptación por rol

## ADMIN
- Menú muestra accesos a **Dashboard** y **Panel administrador** (`/roles/admin`).
- Puede consumir `GET /api/audits` y `GET /api/admin/users` con respuesta 200.
- Intento de acceder a `/roles/cliente` devuelve 403.
- KPIs en `dashboard.html` actualizan métricas globales (`GET /api/dashboard/summary`).

## AUDITOR
- Menú muestra accesos a **Dashboard** y **Bandeja auditor** (`/roles/auditor`).
- `GET /api/audits` responde 200 y lista solicitudes filtrables por estado.
- Acceso directo a `/roles/admin` devuelve 403.
- Al consultar `/api/audits/{id}` puede leer solicitudes ajenas (rol autorizado) y ver historial en UI.

## CLIENTE
- Menú muestra accesos a **Dashboard** y **Portal cliente** (`/roles/cliente`).
- `GET /api/audits/mine` devuelve únicamente solicitudes propias.
- Crear solicitud desde el modal envía `POST /api/audits` con encabezado `Idempotency-Key` y obtiene 201.
- Acceso a `/api/audits` sin rol global responde 403.

## SOPORTE
- Menú muestra accesos a **Dashboard** y **Soporte** (`/roles/soporte`).
- Bandeja lista notificaciones tipo ticket (`GET /api/notifications`).
- `GET /api/meetings` devuelve agenda personal; no puede consultar `/api/audits` (403).
- Intento de abrir `/roles/admin` o `/roles/cliente` retorna 403.

## Smoke tests recomendados
1. **Autenticación**: login por cada usuario semilla, validando almacenamiento de token y redirección a `/dashboard`.
2. **Rutas protegidas**: invocar `/roles/*` con token de rol incorrecto y validar respuesta 403.
3. **Ownership**: crear solicitud como CLIENTE, verificar que AUDITOR la ve en `/api/audits` y CLIENTE sólo en `/api/audits/mine`.
4. **Concurrencia**: actualizar estado de una solicitud con `version` obsoleto y esperar 409.
