const express = require("express");
const { requireRole } = require("../auth");

const router = express.Router();

router.get("/", async (req, res) => {
  const [rows] = await req.pool.query(
    "SELECT id_servicio, nombre, precio, duracion_min, duracion_max FROM servicios ORDER BY nombre"
  );
  res.json(rows);
});

router.post("/", requireRole(["Administrador"]), async (req, res) => {
  const { nombre, precio, duracion_min, duracion_max } = req.body || {};
  const dmin = Number(duracion_min);
  const dmax = Number(duracion_max);
  if (!nombre || !Number.isFinite(Number(precio))) {
    return res.status(400).json({ error: "Nombre y precio son obligatorios" });
  }
  if (!Number.isFinite(dmin) || !Number.isFinite(dmax) || dmin < 15 || dmax < dmin) {
    return res.status(400).json({ error: "Duración inválida (min >= 15 y max >= min)" });
  }
  const [ins] = await req.pool.query(
    "INSERT INTO servicios (nombre, precio, duracion_min, duracion_max) VALUES (?, ?, ?, ?)",
    [nombre, Number(precio), dmin, dmax]
  );
  res.json({ ok: true, id_servicio: ins.insertId });
});

router.put("/:id", requireRole(["Administrador"]), async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, precio, duracion_min, duracion_max } = req.body || {};
  const dmin = Number(duracion_min);
  const dmax = Number(duracion_max);
  if (!id || !nombre || !Number.isFinite(Number(precio))) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  if (!Number.isFinite(dmin) || !Number.isFinite(dmax) || dmin < 15 || dmax < dmin) {
    return res.status(400).json({ error: "Duración inválida (min >= 15 y max >= min)" });
  }
  await req.pool.query(
    "UPDATE servicios SET nombre = ?, precio = ?, duracion_min = ?, duracion_max = ? WHERE id_servicio = ?",
    [nombre, Number(precio), dmin, dmax, id]
  );
  res.json({ ok: true });
});

router.delete("/:id", requireRole(["Administrador"]), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  await req.pool.query("DELETE FROM servicios WHERE id_servicio = ?", [id]);
  res.json({ ok: true });
});

module.exports = router;

