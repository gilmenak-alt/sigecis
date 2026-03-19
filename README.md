## SIGECIS – Sistema de Gestión de Citas y Servicios

Sistema web para un salón de belleza: **clientes, empleados, servicios, citas, pagos, reportes y dashboard**.

### Requisitos

- **Node.js** (recomendado 18+)
- **MySQL** (o MariaDB)

### 1) Importar la base de datos (`sigeciss.sql`)

El proyecto incluye el SQL en `database/sigeciss.sql` (y también tienes `sigeciss.sql` en la raíz).

En la terminal:

```bash
mysql -u root -p < database/sigeciss.sql
```

> Si tu usuario/host/puerto son diferentes, ajusta el comando.

### 2) Configurar variables de entorno

Copia el ejemplo:

- `backend/.env.example` → `backend/.env`

Edita `backend/.env` con tus credenciales MySQL.

### 3) Instalar y ejecutar

En la carpeta del proyecto:

```bash
npm install
npm start
```

Abre en el navegador:

- `http://localhost:3000`

### Credenciales demo (del SQL)

- **Administrador**: `admin@salon.com` / `1234`

> La primera vez que inicies sesión con un usuario del SQL, el backend migra el password a **bcrypt** automáticamente (seguridad básica).

### Estructura

```text
backend/    API + sesiones + validaciones + conexión MySQL
database/   sigeciss.sql
frontend/   HTML/CSS/JS (vanilla) consumiendo la API
```

### Notas funcionales

- **Roles**:
  - Administrador: CRUD completo + reprogramar/cancelar + pagos + reportes + dashboard.
  - Empleado: ve sus citas (requiere vincular `empleados.id_usuario` para que el filtro sea exacto).
  - Cliente: agenda y ve sus citas; el sistema valida disponibilidad (horario y choques).
- **Disponibilidad**:
  - Se valida contra `disponibilidad` y contra choques en `citas`.
- **Empleados por servicio**:
  - Se usa una tabla `empleado_servicio` creada automáticamente por migración al iniciar el backend.
```
