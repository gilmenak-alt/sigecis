require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const cors = require("cors");

const { createPoolFromEnv } = require("./db");
const { ensureSchema } = require("./migrations/runMigrations");

const authRoutes = require("./routes/authRoutes");
const serviciosRoutes = require("./routes/serviciosRoutes");
const empleadosRoutes = require("./routes/empleadosRoutes");
const clientesRoutes = require("./routes/clientesRoutes");
const citasRoutes = require("./routes/citasRoutes");
const pagosRoutes = require("./routes/pagosRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportesRoutes = require("./routes/reportesRoutes");
const novedadesRoutes = require("./routes/novedadesRoutes");

async function main() {
  const app = express();
  const pool = createPoolFromEnv();

  await ensureSchema(pool);

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "sigecis-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true }
    })
  );

  // Inyectar pool en cada request
  app.use((req, _res, next) => {
    req.pool = pool;
    next();
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/servicios", serviciosRoutes);
  app.use("/api/empleados", empleadosRoutes);
  app.use("/api/clientes", clientesRoutes);
  app.use("/api/citas", citasRoutes);
  app.use("/api/pagos", pagosRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/reportes", reportesRoutes);
  app.use("/api/novedades", novedadesRoutes);

  // Manejo de errores (para que el frontend no vea "Failed to fetch")
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error("Error API:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  });

  const frontendDir = path.join(__dirname, "..", "frontend");
  const imgDir = path.join(frontendDir, "img");
  app.use("/img", express.static(imgDir, { index: false }));
  app.use("/", express.static(frontendDir));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`SIGECIS corriendo en http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error("Error iniciando servidor:", err);
  process.exit(1);
});

