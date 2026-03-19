const express = require("express");
const { requireRole } = require("../auth");

const router = express.Router();

router.get("/stats", requireRole(["Administrador", "Empleado", "Cliente"]), async (req, res) => {
  const pool = req.pool;
  const rol = req.session.user.rol;

  const [[{ totalCitas }]] = await pool.query("SELECT COUNT(*) AS totalCitas FROM citas");
  const [[{ totalServicios }]] = await pool.query("SELECT COUNT(*) AS totalServicios FROM servicios");
  const [[{ totalEmpleados }]] = await pool.query("SELECT COUNT(*) AS totalEmpleados FROM empleados");

  // Citas del día
  const [[{ citasHoy }]] = await pool.query(
    "SELECT COUNT(*) AS citasHoy FROM citas WHERE fecha = CURDATE() AND estado <> 'Cancelada'"
  );

  // Ingresos (suma pagos)
  const [[{ ingresosTotal }]] = await pool.query("SELECT COALESCE(SUM(monto),0) AS ingresosTotal FROM pagos");

  // Top servicios
  const [topServicios] = await pool.query(
    `SELECT s.nombre, COUNT(*) AS cantidad
     FROM citas c
     JOIN servicios s ON s.id_servicio = c.id_servicio
     WHERE c.estado <> 'Cancelada'
     GROUP BY s.id_servicio
     ORDER BY cantidad DESC
     LIMIT 5`
  );

  // Top empleados
  const [topEmpleados] = await pool.query(
    `SELECT e.nombre, COUNT(*) AS cantidad
     FROM citas c
     JOIN empleados e ON e.id_empleado = c.id_empleado
     WHERE c.estado <> 'Cancelada'
     GROUP BY e.id_empleado
     ORDER BY cantidad DESC
     LIMIT 5`
  );

  res.json({
    rol,
    totalCitas,
    citasHoy,
    ingresosTotal,
    totalServicios,
    totalEmpleados,
    topServicios,
    topEmpleados
  });
});

module.exports = router;

