const express = require("express");
const { requireRole } = require("../auth");

const router = express.Router();

router.get("/resumen", requireRole(["Administrador"]), async (req, res) => {
  const { from, to } = req.query || {};
  if (!from || !to) return res.status(400).json({ error: "from y to son obligatorios (YYYY-MM-DD)" });

  const pool = req.pool;

  const [[{ totalCitas }]] = await pool.query(
    "SELECT COUNT(*) AS totalCitas FROM citas WHERE fecha BETWEEN ? AND ?",
    [from, to]
  );

  const [[{ totalIngresos }]] = await pool.query(
    "SELECT COALESCE(SUM(monto),0) AS totalIngresos FROM pagos WHERE fecha_pago BETWEEN ? AND ?",
    [from, to]
  );

  const [serviciosMas] = await pool.query(
    `SELECT s.nombre, COUNT(*) AS cantidad
     FROM citas c
     JOIN servicios s ON s.id_servicio = c.id_servicio
     WHERE c.fecha BETWEEN ? AND ? AND c.estado <> 'Cancelada'
     GROUP BY s.id_servicio
     ORDER BY cantidad DESC
     LIMIT 10`,
    [from, to]
  );

  const [empleadosMas] = await pool.query(
    `SELECT e.nombre, COUNT(*) AS cantidad
     FROM citas c
     JOIN empleados e ON e.id_empleado = c.id_empleado
     WHERE c.fecha BETWEEN ? AND ? AND c.estado <> 'Cancelada'
     GROUP BY e.id_empleado
     ORDER BY cantidad DESC
     LIMIT 10`,
    [from, to]
  );

  res.json({ from, to, totalCitas, totalIngresos, serviciosMas, empleadosMas });
});

// Reportes detallados: mínimo 9 reportes en tablas (3 grupos x 3 tablas)
router.get("/detallados", requireRole(["Administrador"]), async (req, res) => {
  const { from, to } = req.query || {};
  if (!from || !to) return res.status(400).json({ error: "from y to son obligatorios (YYYY-MM-DD)" });
  const pool = req.pool;

  // KPIs
  const [[kpis]] = await pool.query(
    `SELECT
        (SELECT COUNT(*) FROM citas WHERE fecha BETWEEN ? AND ?) AS totalCitas,
        (SELECT COUNT(*) FROM citas WHERE fecha BETWEEN ? AND ? AND estado = 'Terminada') AS citasTerminadas,
        (SELECT COUNT(*) FROM citas WHERE fecha BETWEEN ? AND ? AND estado = 'Cancelada') AS citasCanceladas,
        (SELECT COUNT(*) FROM citas WHERE fecha BETWEEN ? AND ? AND estado = 'Reprogramada') AS citasReprogramadas,
        (SELECT COUNT(*) FROM citas c
           LEFT JOIN pagos p ON p.id_cita = c.id_cita
           WHERE c.fecha BETWEEN ? AND ? AND c.estado <> 'Cancelada' AND p.id_pago IS NULL) AS citasPendientesPago,
        (SELECT COALESCE(SUM(monto),0) FROM pagos WHERE fecha_pago BETWEEN ? AND ?) AS ingresosTotal`,
    [from, to, from, to, from, to, from, to, from, to, from, to]
  );

  // Grupo 1: Citas (3 tablas)
  const [citasPorEstado] = await pool.query(
    `SELECT estado, COUNT(*) AS cantidad
     FROM citas
     WHERE fecha BETWEEN ? AND ?
     GROUP BY estado
     ORDER BY cantidad DESC`,
    [from, to]
  );

  const [citasPorServicio] = await pool.query(
    `SELECT s.nombre AS servicio, COUNT(*) AS cantidad
     FROM citas c
     JOIN servicios s ON s.id_servicio = c.id_servicio
     WHERE c.fecha BETWEEN ? AND ?
     GROUP BY s.id_servicio
     ORDER BY cantidad DESC`,
    [from, to]
  );

  const [citasPorDia] = await pool.query(
    `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS dia, COUNT(*) AS cantidad
     FROM citas
     WHERE fecha BETWEEN ? AND ?
     GROUP BY fecha
     ORDER BY fecha ASC`,
    [from, to]
  );

  // Grupo 2: Ingresos/Pagos (3 tablas)
  const [ingresosPorMetodo] = await pool.query(
    `SELECT metodo_pago, COUNT(*) AS cantidad, COALESCE(SUM(monto),0) AS total
     FROM pagos
     WHERE fecha_pago BETWEEN ? AND ?
     GROUP BY metodo_pago
     ORDER BY total DESC`,
    [from, to]
  );

  const [ingresosPorServicio] = await pool.query(
    `SELECT s.nombre AS servicio, COALESCE(SUM(p.monto),0) AS total, COUNT(*) AS pagos
     FROM pagos p
     JOIN citas c ON c.id_cita = p.id_cita
     JOIN servicios s ON s.id_servicio = c.id_servicio
     WHERE p.fecha_pago BETWEEN ? AND ?
     GROUP BY s.id_servicio
     ORDER BY total DESC`,
    [from, to]
  );

  const [pendientesPagoPorServicio] = await pool.query(
    `SELECT s.nombre AS servicio, COUNT(*) AS pendientes
     FROM citas c
     JOIN servicios s ON s.id_servicio = c.id_servicio
     LEFT JOIN pagos p ON p.id_cita = c.id_cita
     WHERE c.fecha BETWEEN ? AND ?
       AND c.estado <> 'Cancelada'
       AND p.id_pago IS NULL
     GROUP BY s.id_servicio
     ORDER BY pendientes DESC`,
    [from, to]
  );

  // Grupo 3: Desempeño/Clientes (3 tablas)
  const [topEmpleadosPorCitas] = await pool.query(
    `SELECT e.nombre AS empleado,
            COUNT(*) AS total,
            SUM(CASE WHEN c.estado='Terminada' THEN 1 ELSE 0 END) AS terminadas,
            SUM(CASE WHEN c.estado='Cancelada' THEN 1 ELSE 0 END) AS canceladas,
            SUM(CASE WHEN c.estado='Reprogramada' THEN 1 ELSE 0 END) AS reprogramadas
     FROM citas c
     JOIN empleados e ON e.id_empleado = c.id_empleado
     WHERE c.fecha BETWEEN ? AND ?
     GROUP BY e.id_empleado
     ORDER BY total DESC
     LIMIT 20`,
    [from, to]
  );

  const [topClientesPorCitas] = await pool.query(
    `SELECT cl.nombre AS cliente, COUNT(*) AS total
     FROM citas c
     JOIN clientes cl ON cl.id_cliente = c.id_cliente
     WHERE c.fecha BETWEEN ? AND ?
     GROUP BY cl.id_cliente
     ORDER BY total DESC
     LIMIT 20`,
    [from, to]
  );

  const [detalleCitas] = await pool.query(
    `SELECT c.id_cita,
            DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
            TIME_FORMAT(c.hora, '%H:%i:%s') AS hora,
            c.estado,
            cl.nombre AS cliente,
            s.nombre AS servicio,
            e.nombre AS empleado
     FROM citas c
     JOIN clientes cl ON cl.id_cliente = c.id_cliente
     JOIN servicios s ON s.id_servicio = c.id_servicio
     JOIN empleados e ON e.id_empleado = c.id_empleado
     WHERE c.fecha BETWEEN ? AND ?
     ORDER BY c.fecha ASC, c.hora ASC
     LIMIT 500`,
    [from, to]
  );

  res.json({
    from,
    to,
    kpis,
    tablas: {
      // 9+ reportes
      citasPorEstado,
      citasPorServicio,
      citasPorDia,
      ingresosPorMetodo,
      ingresosPorServicio,
      pendientesPagoPorServicio,
      topEmpleadosPorCitas,
      topClientesPorCitas,
      detalleCitas
    }
  });
});

module.exports = router;

