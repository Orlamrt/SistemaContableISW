# RUNBOOK — SistemaContableISW

## Prerrequisitos
- Node.js 22+
- MySQL/MariaDB 10+
- npm 10+

## Configuración inicial
1. Copia `Backend/.env.example` a `Backend/.env` y ajusta credenciales de base de datos y SMTP.
2. Instala dependencias del backend:
   ```bash
   cd Backend
   npm install
   ```
3. Ejecuta migraciones y seeds:
   ```bash
   npm run migrate
   npm run seed
   ```

## Ejecución en desarrollo
```bash
cd Backend
npm run dev
```
- Backend disponible en `http://localhost:4000`.
- El frontend está servido por Express en las rutas protegidas (`/dashboard`, `/roles/*`).

## Usuarios de prueba (RBAC)
| Rol | Email | Password |
| --- | --- | --- |
| ADMIN | admin@example.com | ChangeMe123! |
| AUDITOR | auditor@example.com | Auditor123! |
| CLIENTE | cliente@example.com | Cliente123! |
| SOPORTE | soporte@example.com | Soporte123! |

## Smoke tests manuales
1. **Login** con cada usuario y validación de menú según rol.
2. **Protección RBAC**: intentar abrir un dashboard de otro rol y confirmar 403.
3. **Auditorías**: CLIENTE crea solicitud desde `/roles/cliente`, AUDITOR ve registro en `/roles/auditor`.
4. **Concurrencia**: realizar `PATCH /api/audits/{id}/status` con `version` desactualizado y esperar 409.

## Pruebas automatizadas
```bash
cd Backend
npm test
```

## Despliegue (resumen)
1. Crear `.env` con secretos productivos.
2. Ejecutar `npm run migrate` y `npm run seed` en el servidor (o pipeline CI/CD).
3. Levantar servicio con `npm start` o un proceso manager (PM2/systemd).
4. Servir activos estáticos tras un reverse proxy (Nginx) apuntando a `http://localhost:4000`.
