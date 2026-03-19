const express = require("express");
const { requireRole } = require("../auth");

const router = express.Router();

router.get("/", async (req, res) => {
  const [rows] = await req.pool.query(
    "SELECT id_empleado, nombre, especialidad, disponible FROM empleados ORDER BY nombre"
  );
  const normalizados = rows.map((r) => ({
    ...r,
    disponible: r.disponible === 1 || r.disponible === "1"
  }));
  res.json(normalizados);
});

// Empleados disponibles para un servicio
router.get("/por-servicio/:idServicio", async (req, res) => {
  const idServicio = Number(req.params.idServicio);
  if (!idServicio) return res.status(400).json({ error: "Servicio inválido" });

  // Siempre tomar el nombre del servicio para hacer fallback inteligente
  const [[serv]] = await req.pool.query(
    "SELECT nombre FROM servicios WHERE id_servicio = ? LIMIT 1",
    [idServicio]
  );
  const nombreServicio = (serv?.nombre || "").toLowerCase();

  const [rows] = await req.pool.query(
    `SELECT e.id_empleado, e.nombre, e.especialidad
     FROM empleado_servicio es
     JOIN empleados e ON e.id_empleado = es.id_empleado
     WHERE es.id_servicio = ? AND e.disponible = 1
     ORDER BY e.nombre`,
    [idServicio]
  );

  if (rows.length === 0) {
    // Si no hay mapeo en empleado_servicio, usar heurística por especialidad y excluir limpieza
    const [all] = await req.pool.query(
      "SELECT id_empleado, nombre, especialidad FROM empleados WHERE disponible = 1 ORDER BY nombre"
    );
    const filtrados = all.filter((e) => {
      const esp = String(e.especialidad || "").toLowerCase();
      if (esp.includes("limpieza")) return false;

      if (!nombreServicio) return true;
      return (
        nombreServicio.includes("corte") && (esp.includes("corte") || esp.includes("barber")) ||
        nombreServicio.includes("barba") && esp.includes("barber") ||
        nombreServicio.includes("afeitado") && esp.includes("barber") ||
        nombreServicio.includes("color") && esp.includes("color") ||
        nombreServicio.includes("maquill") && esp.includes("maquill") ||
        (nombreServicio.includes("manic") || nombreServicio.includes("pedic")) && esp.includes("manic") ||
        (nombreServicio.includes("peinad") || nombreServicio.includes("brushing")) && (esp.includes("peinad") || esp.includes("brushing")) ||
        nombreServicio.includes("tratamiento") && esp.includes("trat")
      );
    });

    return res.json(filtrados.length > 0 ? filtrados : all.filter(e => !String(e.especialidad||"").toLowerCase().includes("limpieza")));
  }

  res.json(rows);
});

// Empleado: ver su propio perfil
router.get("/me", requireRole(["Empleado"]), async (req, res) => {
  const idUsuario = req.session.user.id_usuario;
  const [rows] = await req.pool.query(
    "SELECT id_empleado, nombre, especialidad, disponible FROM empleados WHERE id_usuario = ? LIMIT 1",
    [idUsuario]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Perfil de empleado no encontrado" });
  const r = rows[0];
  res.json({
    id_empleado: r.id_empleado,
    nombre: r.nombre,
    especialidad: r.especialidad,
    disponible: r.disponible === 1 || r.disponible === "1"
  });
});

// Empleado: actualizar su propio perfil (nombre, especialidad; disponible solo admin)
router.put("/me", requireRole(["Empleado"]), async (req, res) => {
  const idUsuario = req.session.user.id_usuario;
  const { nombre, especialidad } = req.body || {};
  if (!nombre || !especialidad) return res.status(400).json({ error: "Nombre y especialidad son obligatorios" });
  const [emp] = await req.pool.query("SELECT id_empleado FROM empleados WHERE id_usuario = ? LIMIT 1", [idUsuario]);
  if (emp.length === 0) return res.status(404).json({ error: "Perfil de empleado no encontrado" });
  await req.pool.query(
    "UPDATE empleados SET nombre = ?, especialidad = ? WHERE id_empleado = ?",
    [nombre, especialidad, emp[0].id_empleado]
  );
  res.json({ ok: true });
});

// Empleado: listar servicios que ofrece
router.get("/me/servicios", requireRole(["Empleado"]), async (req, res) => {
  const idUsuario = req.session.user.id_usuario;
  const [emp] = await req.pool.query("SELECT id_empleado FROM empleados WHERE id_usuario = ? LIMIT 1", [idUsuario]);
  if (emp.length === 0) return res.json([]);
  const [rows] = await req.pool.query(
    `SELECT s.id_servicio, s.nombre, s.precio
     FROM empleado_servicio es
     JOIN servicios s ON s.id_servicio = es.id_servicio
     WHERE es.id_empleado = ?
     ORDER BY s.nombre`,
    [emp[0].id_empleado]
  );
  res.json(rows);
});

// Empleado: actualizar servicios que ofrece
router.put("/me/servicios", requireRole(["Empleado"]), async (req, res) => {
  const idUsuario = req.session.user.id_usuario;
  const { servicios } = req.body || {};
  if (!Array.isArray(servicios)) return res.status(400).json({ error: "servicios debe ser un array" });
  const [emp] = await req.pool.query("SELECT id_empleado FROM empleados WHERE id_usuario = ? LIMIT 1", [idUsuario]);
  if (emp.length === 0) return res.status(404).json({ error: "Perfil de empleado no encontrado" });
  const idEmpleado = emp[0].id_empleado;
  await req.pool.query("DELETE FROM empleado_servicio WHERE id_empleado = ?", [idEmpleado]);
  const values = servicios
    .map((id) => [idEmpleado, Number(id)])
    .filter((v) => v[1]);
  if (values.length > 0) {
    await req.pool.query(
      "INSERT INTO empleado_servicio (id_empleado, id_servicio) VALUES ?",
      [values]
    );
  }
  res.json({ ok: true });
});

router.post("/", requireRole(["Administrador"]), async (req, res) => {
  const { nombre, disponible, id_servicio, servicios, especialidad } = req.body || {};
  if (!nombre) return res.status(400).json({ error: "Nombre es obligatorio" });

  const pool = req.pool;

  // Preferimos que especialidad salga de servicios registrados
  let serviciosIds = [];
  if (Array.isArray(servicios)) serviciosIds = servicios.map(Number).filter(Boolean);
  if (Number(id_servicio)) serviciosIds = [Number(id_servicio)];

  let esp = String(especialidad || "").trim();
  if (serviciosIds.length > 0) {
    const [[s]] = await pool.query("SELECT nombre FROM servicios WHERE id_servicio = ? LIMIT 1", [serviciosIds[0]]);
    if (!s) return res.status(400).json({ error: "Servicio inválido" });
    esp = s.nombre;
  }
  if (!esp) return res.status(400).json({ error: "Debe seleccionar una especialidad (servicio)" });

  const [ins] = await pool.query(
    "INSERT INTO empleados (nombre, especialidad, disponible) VALUES (?, ?, ?)",
    [String(nombre).trim(), esp, disponible ? 1 : 0]
  );
  const idEmpleado = ins.insertId;

  if (serviciosIds.length > 0) {
    const values = serviciosIds.map((sid) => [idEmpleado, sid]);
    await pool.query("INSERT IGNORE INTO empleado_servicio (id_empleado, id_servicio) VALUES ?", [values]);
  }

  res.json({ ok: true, id_empleado: idEmpleado });
});

router.put("/:id", requireRole(["Administrador"]), async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, disponible, id_servicio, servicios, especialidad } = req.body || {};
  if (!id || !nombre) return res.status(400).json({ error: "Datos inválidos" });

  const pool = req.pool;
  let serviciosIds = [];
  if (Array.isArray(servicios)) serviciosIds = servicios.map(Number).filter(Boolean);
  if (Number(id_servicio)) serviciosIds = [Number(id_servicio)];

  let esp = String(especialidad || "").trim();
  if (serviciosIds.length > 0) {
    const [[s]] = await pool.query("SELECT nombre FROM servicios WHERE id_servicio = ? LIMIT 1", [serviciosIds[0]]);
    if (!s) return res.status(400).json({ error: "Servicio inválido" });
    esp = s.nombre;
  }
  if (!esp) return res.status(400).json({ error: "Debe seleccionar una especialidad (servicio)" });

  await pool.query(
    "UPDATE empleados SET nombre = ?, especialidad = ?, disponible = ? WHERE id_empleado = ?",
    [String(nombre).trim(), esp, disponible ? 1 : 0, id]
  );

  if (serviciosIds.length > 0) {
    await pool.query("DELETE FROM empleado_servicio WHERE id_empleado = ?", [id]);
    const values = serviciosIds.map((sid) => [id, sid]);
    await pool.query("INSERT IGNORE INTO empleado_servicio (id_empleado, id_servicio) VALUES ?", [values]);
  }

  res.json({ ok: true });
});

router.delete("/:id", requireRole(["Administrador"]), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });
  const pool = req.pool;
  try {
    // Si el empleado tiene citas asociadas, no se puede borrar por FK.
    // En ese caso, lo "desactivamos" (disponible = 0) y devolvemos mensaje claro.
    const [citas] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM citas WHERE id_empleado = ?",
      [id]
    );
    if ((citas[0]?.cnt || 0) > 0) {
      await pool.query("UPDATE empleados SET disponible = 0 WHERE id_empleado = ?", [id]);
      return res.status(409).json({
        error: "No se puede eliminar porque tiene citas asociadas. Se marcó como NO disponible."
      });
    }

    // Borrar dependencias que sí podemos eliminar
    await pool.query("DELETE FROM disponibilidad WHERE id_empleado = ?", [id]);
    await pool.query("DELETE FROM empleado_servicio WHERE id_empleado = ?", [id]);

    await pool.query("DELETE FROM empleados WHERE id_empleado = ?", [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "No se pudo eliminar el empleado" });
  }
});

// Admin puede asignar qué servicios ofrece cada empleado
router.put("/:id/servicios", requireRole(["Administrador"]), async (req, res) => {
  const idEmpleado = Number(req.params.id);
  const { servicios } = req.body || {};
  if (!idEmpleado || !Array.isArray(servicios)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  await req.pool.query("DELETE FROM empleado_servicio WHERE id_empleado = ?", [idEmpleado]);
  const values = servicios
    .map((idServicio) => [idEmpleado, Number(idServicio)])
    .filter((v) => v[1]);

  if (values.length > 0) {
    await req.pool.query(
      "INSERT INTO empleado_servicio (id_empleado, id_servicio) VALUES ?",
      [values]
    );
  }

  res.json({ ok: true });
});

module.exports = router;

