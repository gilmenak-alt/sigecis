const express = require("express");
const { requireRole } = require("../auth");

const router = express.Router();

router.get("/", requireRole(["Administrador"]), async (req, res) => {
  const [rows] = await req.pool.query(
    "SELECT id_cliente, nombre, telefono, correo FROM clientes ORDER BY nombre"
  );
  res.json(rows);
});

router.post("/", requireRole(["Administrador"]), async (req, res) => {
  const { nombre, telefono, correo } = req.body || {};
  if (!nombre || !correo) return res.status(400).json({ error: "Nombre y correo son obligatorios" });
  const [ins] = await req.pool.query(
    "INSERT INTO clientes (nombre, telefono, correo) VALUES (?, ?, ?)",
    [nombre, telefono || null, correo]
  );
  res.json({ ok: true, id_cliente: ins.insertId });
});

router.put("/:id", requireRole(["Administrador"]), async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, telefono, correo } = req.body || {};
  if (!id || !nombre || !correo) return res.status(400).json({ error: "Datos inválidos" });
  await req.pool.query(
    "UPDATE clientes SET nombre = ?, telefono = ?, correo = ? WHERE id_cliente = ?",
    [nombre, telefono || null, correo, id]
  );
  res.json({ ok: true });
});

router.delete("/:id", requireRole(["Administrador"]), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  await req.pool.query("DELETE FROM clientes WHERE id_cliente = ?", [id]);
  res.json({ ok: true });
});

// Cliente: ver/editar su perfil
router.get("/me", requireRole(["Cliente"]), async (req, res) => {
  const idUsuario = req.session.user.id_usuario;
  const [rows] = await req.pool.query(
    "SELECT id_cliente, nombre, telefono, correo FROM clientes WHERE id_usuario = ? LIMIT 1",
    [idUsuario]
  );
  res.json(rows[0] || null);
});

router.put("/me", requireRole(["Cliente"]), async (req, res) => {
  const idUsuario = req.session.user.id_usuario;
  const { nombre, telefono } = req.body || {};
  if (!nombre) return res.status(400).json({ error: "Nombre es obligatorio" });
  await req.pool.query(
    "UPDATE clientes SET nombre = ?, telefono = ? WHERE id_usuario = ?",
    [nombre, telefono || null, idUsuario]
  );
  res.json({ ok: true });
});

router.delete("/me", requireRole(["Cliente"]), async (req, res) => {
  const idUsuario = req.session.user.id_usuario;
  // borra cliente y usuario (cascada no está definida; lo hacemos manual)
  await req.pool.query("DELETE FROM clientes WHERE id_usuario = ?", [idUsuario]);
  await req.pool.query("DELETE FROM usuarios WHERE id_usuario = ?", [idUsuario]);
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;

