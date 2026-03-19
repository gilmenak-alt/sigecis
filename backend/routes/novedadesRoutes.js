const express = require("express");
const { requireRole } = require("../auth");
const router = express.Router();

router.get("/", requireRole(["Administrador", "Empleado", "Cliente"]), async (req, res) => {
  const rol = req.session.user.rol;
  const where = rol === "Administrador" ? "" : "WHERE activo = 1";
  const [rows] = await req.pool.query(
    `SELECT id_novedad, titulo, contenido, tipo, activo,
            DATE_FORMAT(fecha_publicacion, '%Y-%m-%d') AS fecha_publicacion
     FROM novedades
     ${where}
     ORDER BY fecha_publicacion DESC, id_novedad DESC`
  );
  res.json(rows);
});

router.post("/", requireRole(["Administrador"]), async (req, res) => {
  const { titulo, contenido, tipo, fecha_publicacion, activo } = req.body || {};
  if (!titulo || !fecha_publicacion) return res.status(400).json({ error: "Título y fecha son obligatorios" });
  const [ins] = await req.pool.query(
    "INSERT INTO novedades (titulo, contenido, tipo, fecha_publicacion, activo) VALUES (?, ?, ?, ?, ?)",
    [String(titulo).trim(), String(contenido || "").trim(), String(tipo || "aviso").trim(), fecha_publicacion, activo === false ? 0 : 1]
  );
  res.json({ ok: true, id_novedad: ins.insertId });
});

router.put("/:id", requireRole(["Administrador"]), async (req, res) => {
  const id = Number(req.params.id);
  const { titulo, contenido, tipo, fecha_publicacion, activo } = req.body || {};
  if (!id || !titulo || !fecha_publicacion) return res.status(400).json({ error: "Datos inválidos" });
  await req.pool.query(
    "UPDATE novedades SET titulo = ?, contenido = ?, tipo = ?, fecha_publicacion = ?, activo = ? WHERE id_novedad = ?",
    [String(titulo).trim(), String(contenido || "").trim(), String(tipo || "aviso").trim(), fecha_publicacion, activo === false ? 0 : 1, id]
  );
  res.json({ ok: true });
});

router.delete("/:id", requireRole(["Administrador"]), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  await req.pool.query("DELETE FROM novedades WHERE id_novedad = ?", [id]);
  res.json({ ok: true });
});

module.exports = router;
