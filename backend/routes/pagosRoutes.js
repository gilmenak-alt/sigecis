const express = require("express");
const { requireRole } = require("../auth");

const router = express.Router();

// Pagos pendientes: citas sin pago registrado
router.get("/pendientes", requireRole(["Administrador"]), async (req, res) => {
  const [rows] = await req.pool.query(
    `SELECT c.id_cita,
            DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha_cita,
            TIME_FORMAT(c.hora, '%H:%i:%s') AS hora,
            c.estado,
            cl.nombre AS cliente,
            s.nombre AS servicio,
            s.precio AS monto_sugerido
     FROM citas c
     JOIN clientes cl ON cl.id_cliente = c.id_cliente
     JOIN servicios s ON s.id_servicio = c.id_servicio
     LEFT JOIN pagos p ON p.id_cita = c.id_cita
     WHERE p.id_pago IS NULL
       AND c.estado <> 'Cancelada'
     ORDER BY c.fecha ASC, c.hora ASC`
  );
  res.json(rows);
});

// (Opcional) historial de pagos (si se requiere)
router.get("/historial", requireRole(["Administrador"]), async (req, res) => {
  const [rows] = await req.pool.query(
    `SELECT p.id_pago, p.monto, p.metodo_pago,
            DATE_FORMAT(p.fecha_pago, '%Y-%m-%d') AS fecha_pago,
            c.id_cita, DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha_cita, TIME_FORMAT(c.hora, '%H:%i:%s') AS hora,
            cl.nombre AS cliente, s.nombre AS servicio
     FROM pagos p
     JOIN citas c ON c.id_cita = p.id_cita
     JOIN clientes cl ON cl.id_cliente = c.id_cliente
     JOIN servicios s ON s.id_servicio = c.id_servicio
     ORDER BY p.fecha_pago DESC, p.id_pago DESC`
  );
  res.json(rows);
});

router.post("/", requireRole(["Administrador"]), async (req, res) => {
  const { id_cita, monto, metodo_pago, fecha_pago } = req.body || {};
  const idCita = Number(id_cita);
  const m = Number(monto);
  if (!idCita || !Number.isFinite(m) || !metodo_pago || !fecha_pago) {
    return res.status(400).json({ error: "Datos de pago inválidos" });
  }

  const [ya] = await req.pool.query("SELECT 1 FROM pagos WHERE id_cita = ? LIMIT 1", [idCita]);
  if (ya.length > 0) return res.status(409).json({ error: "Esa cita ya tiene un pago registrado" });

  await req.pool.query(
    "INSERT INTO pagos (id_cita, monto, metodo_pago, fecha_pago) VALUES (?, ?, ?, ?)",
    [idCita, m, metodo_pago, fecha_pago]
  );
  res.json({ ok: true });
});

module.exports = router;

