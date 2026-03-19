const express = require("express");
const { verifyPasswordAndMigrateIfNeeded } = require("../auth");
const bcrypt = require("bcryptjs");

const router = express.Router();

function rolNombre(n) {
  const s = String(n || "").toLowerCase();
  if (s.includes("admin")) return "Administrador";
  if (s.includes("emple")) return "Empleado";
  if (s.includes("clien")) return "Cliente";
  return n;
}

router.get("/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

router.post("/login", async (req, res) => {
  const { correo, password } = req.body || {};
  if (!correo || !password) {
    return res.status(400).json({ error: "Correo y contraseña son obligatorios" });
  }

  const pool = req.pool;
  const [rows] = await pool.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.password, r.nombre_rol
     FROM usuarios u
     JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.correo = ? LIMIT 1`,
    [correo]
  );

  if (rows.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });

  const user = rows[0];
  const ok = await verifyPasswordAndMigrateIfNeeded(pool, user, password);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  req.session.user = {
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    correo: user.correo,
    rol: rolNombre(user.nombre_rol)
  };

  res.json({ ok: true, user: req.session.user });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.post("/register", async (req, res) => {
  const { nombre, correo, password, telefono } = req.body || {};
  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios" });
  }
  if (telefono != null && String(telefono).trim() !== "") {
    const tel = String(telefono).trim();
    if (!/^\d{7,15}$/.test(tel)) {
      return res.status(400).json({ error: "Teléfono inválido. Solo números (7 a 15 dígitos)." });
    }
  }

  const pool = req.pool;
  const [exists] = await pool.query("SELECT id_usuario FROM usuarios WHERE correo = ? LIMIT 1", [correo]);
  if (exists.length > 0) return res.status(409).json({ error: "El correo ya está registrado" });

  const hash = await bcrypt.hash(password, 10);
  // rol Cliente = 3 (según sigeciss.sql)
  const [ins] = await pool.query(
    "INSERT INTO usuarios (nombre, correo, password, id_rol) VALUES (?, ?, ?, 3)",
    [nombre, correo, hash]
  );

  const idUsuario = ins.insertId;
  // Crear registro en clientes y vincularlo al usuario
  await pool.query(
    "INSERT INTO clientes (nombre, telefono, correo, id_usuario) VALUES (?, ?, ?, ?)",
    [nombre, (telefono != null && String(telefono).trim() !== "") ? String(telefono).trim() : null, correo, idUsuario]
  );

  res.json({ ok: true });
});

module.exports = router;

