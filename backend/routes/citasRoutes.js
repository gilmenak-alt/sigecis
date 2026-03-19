const express = require("express");
const { requireRole } = require("../auth");

const router = express.Router();

function diaSemanaES(dateStr) {
  // dateStr: YYYY-MM-DD
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return days[d.getDay()];
}

function timeToMinutes(t) {
  // "HH:MM" o "HH:MM:SS"
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}

async function validarDisponibilidad(pool, idEmpleado, idServicio, fecha, hora) {
  // Horario general del salón:
  // Lunes a viernes: 08:00 a 20:00 (última cita a las 19:00)
  // Fines de semana: 09:00 a 18:00 (última cita a las 17:00)
  const d = new Date(fecha + "T00:00:00");
  const day = d.getDay(); // 0 domingo, 6 sábado
  let inicio, fin;
  if (day === 0 || day === 6) {
    inicio = 9 * 60;
    fin = 18 * 60;
  } else {
    inicio = 8 * 60;
    fin = 20 * 60;
  }

  const h = timeToMinutes(hora);
  // Última cita una hora antes del cierre
  if (h < inicio || h > fin - 60) {
    return { ok: false, error: "La hora debe estar dentro del horario del salón" };
  }

  const [[svc]] = await pool.query(
    "SELECT duracion_max FROM servicios WHERE id_servicio = ? LIMIT 1",
    [Number(idServicio)]
  );
  const durNueva = Number(svc?.duracion_max || 60);

  // Validar choques por solapamiento en el día
  const [citasDia] = await pool.query(
    `SELECT c.id_cita,
            TIME_FORMAT(c.hora, '%H:%i:%s') AS hora,
            c.estado,
            s.duracion_max
     FROM citas c
     JOIN servicios s ON s.id_servicio = c.id_servicio
     WHERE c.id_empleado = ? AND c.fecha = ? AND c.estado <> 'Cancelada'`,
    [idEmpleado, fecha]
  );

  const startNew = timeToMinutes(hora);
  const endNew = startNew + durNueva;
  for (const c of citasDia) {
    const startOld = timeToMinutes(c.hora);
    const endOld = startOld + Number(c.duracion_max || 60);
    const overlap = startNew < endOld && endNew > startOld;
    if (overlap) return { ok: false, error: "El empleado ya tiene una cita que se cruza con ese horario" };
  }

  return { ok: true };
}

// Convierte una fila de cita a evento FullCalendar (title según rol)
function citaToEvent(row, rol) {
  const fecha = String(row.fecha || "").slice(0, 10);
  const hora = String(row.hora || "").replace(/^(\d{1,2}:\d{2})(:\d{2})?$/, "$1");
  const startStr = fecha + "T" + (hora.length === 5 ? hora + ":00" : hora);
  const start = new Date(startStr);
  const dur = Number(row.duracion_max || 60);
  const end = new Date(start.getTime() + dur * 60 * 1000);

  let title;
  if (rol === "Cliente") {
    title = (row.servicio || "") + " – " + (row.empleado || "");
  } else {
    title = (row.cliente || "") + " – " + (row.servicio || "");
  }

  return {
    id: String(row.id_cita),
    title: title || "Cita",
    start: start.toISOString(),
    end: end.toISOString(),
    extendedProps: {
      id_cita: row.id_cita,
      estado: row.estado,
      id_cliente: row.id_cliente,
      id_empleado: row.id_empleado,
      id_servicio: row.id_servicio,
      cliente: row.cliente,
      servicio: row.servicio,
      empleado: row.empleado,
      fecha,
      hora: hora.slice(0, 5),
      precio_servicio: row.precio_servicio
    }
  };
}

// Listado de citas según rol (soporta ?from=YYYY-MM-DD&to=YYYY-MM-DD y ?format=fullcalendar)
router.get("/", requireRole(["Administrador", "Empleado", "Cliente"]), async (req, res) => {
  const rol = req.session.user.rol;
  const pool = req.pool;
  const from = (req.query.from || "").trim();
  const to = (req.query.to || "").trim();
  const formatFullCalendar = (req.query.format || "").toLowerCase() === "fullcalendar";

  // Auto-terminar citas pasadas (Agendada o Reprogramada) una vez cumplido el horario
  await pool.query(
    `UPDATE citas
     SET estado = 'Terminada'
     WHERE estado IN ('Agendada', 'Reprogramada')
       AND TIMESTAMP(fecha, hora) < NOW()`
  );

  let rows;
  let baseSql = "";
  let params = [];

  if (rol === "Administrador") {
    baseSql = `SELECT c.id_cita,
              DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
              TIME_FORMAT(c.hora, '%H:%i:%s') AS hora,
              c.estado,
              c.id_cliente, c.id_servicio, c.id_empleado,
              cl.nombre AS cliente, s.nombre AS servicio, s.precio AS precio_servicio, s.duracion_max,
              e.nombre AS empleado
       FROM citas c
       JOIN clientes cl ON cl.id_cliente = c.id_cliente
       JOIN servicios s ON s.id_servicio = c.id_servicio
       JOIN empleados e ON e.id_empleado = c.id_empleado`;
    if (from && to) {
      baseSql += " WHERE c.fecha BETWEEN ? AND ?";
      params = [from, to];
    }
    baseSql += " ORDER BY c.fecha ASC, c.hora ASC";
    const [r] = await pool.query(baseSql, params);
    rows = r;
  } else if (rol === "Empleado") {
    const idUsuario = req.session.user.id_usuario;
    const [emp] = await pool.query(
      "SELECT id_empleado FROM empleados WHERE id_usuario = ? LIMIT 1",
      [idUsuario]
    );
    if (emp.length === 0) {
      return res.json(formatFullCalendar ? [] : []);
    }
    baseSql = `SELECT c.id_cita,
              DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
              TIME_FORMAT(c.hora, '%H:%i:%s') AS hora,
              c.estado,
              c.id_cliente, c.id_servicio, c.id_empleado,
              cl.nombre AS cliente, s.nombre AS servicio, s.duracion_max,
              e.nombre AS empleado
       FROM citas c
       JOIN clientes cl ON cl.id_cliente = c.id_cliente
       JOIN servicios s ON s.id_servicio = c.id_servicio
       JOIN empleados e ON e.id_empleado = c.id_empleado
       WHERE c.id_empleado = ?`;
    params = [emp[0].id_empleado];
    if (from && to) {
      baseSql += " AND c.fecha BETWEEN ? AND ?";
      params.push(from, to);
    }
    baseSql += " ORDER BY c.fecha ASC, c.hora ASC";
    const [r] = await pool.query(baseSql, params);
    rows = r;
  } else {
    const idUsuario = req.session.user.id_usuario;
    const [cl] = await pool.query(
      "SELECT id_cliente FROM clientes WHERE id_usuario = ? LIMIT 1",
      [idUsuario]
    );
    if (cl.length === 0) return res.json(formatFullCalendar ? [] : []);

    baseSql = `SELECT c.id_cita,
              DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
              TIME_FORMAT(c.hora, '%H:%i:%s') AS hora,
              c.estado,
              c.id_cliente, c.id_servicio, c.id_empleado,
              s.nombre AS servicio, s.duracion_max, e.nombre AS empleado
       FROM citas c
       JOIN servicios s ON s.id_servicio = c.id_servicio
       JOIN empleados e ON e.id_empleado = c.id_empleado
       WHERE c.id_cliente = ?`;
    params = [cl[0].id_cliente];
    if (from && to) {
      baseSql += " AND c.fecha BETWEEN ? AND ?";
      params.push(from, to);
    }
    baseSql += " ORDER BY c.fecha ASC, c.hora ASC";
    const [r] = await pool.query(baseSql, params);
    rows = r;
  }

  if (formatFullCalendar) {
    const events = rows.map((row) => citaToEvent(row, rol));
    return res.json(events);
  }
  res.json(rows);
});

// Crear cita (Cliente o Admin)
router.post("/", requireRole(["Administrador", "Cliente"]), async (req, res) => {
  const { id_servicio, id_empleado, fecha, hora, id_cliente } = req.body || {};
  const pool = req.pool;

  const servicio = Number(id_servicio);
  const empleado = Number(id_empleado);
  if (!servicio || !empleado || !fecha || !hora) {
    return res.status(400).json({ error: "Servicio, empleado, fecha y hora son obligatorios" });
  }

  // No permitir agendar en fechas pasadas
  const fechaStr = String(fecha).slice(0, 10);
  const hoyStr = new Date().toISOString().slice(0, 10);
  if (fechaStr < hoyStr) {
    return res.status(400).json({ error: "No se pueden agendar citas en fechas pasadas" });
  }

  let clienteId = null;
  if (req.session.user.rol === "Administrador") {
    clienteId = Number(id_cliente);
    if (!clienteId) return res.status(400).json({ error: "Debe seleccionar cliente" });
  } else {
    const [cl] = await pool.query(
      "SELECT id_cliente FROM clientes WHERE id_usuario = ? LIMIT 1",
      [req.session.user.id_usuario]
    );
    if (cl.length === 0) return res.status(400).json({ error: "No se encontró perfil de cliente" });
    clienteId = cl[0].id_cliente;
  }

  // Validar que el empleado ofrezca el servicio
  const [rel] = await pool.query(
    "SELECT 1 FROM empleado_servicio WHERE id_empleado = ? AND id_servicio = ? LIMIT 1",
    [empleado, servicio]
  );
  if (rel.length === 0) {
    return res.status(400).json({ error: "El empleado no ofrece ese servicio" });
  }

  const disp = await validarDisponibilidad(pool, empleado, servicio, fecha, hora);
  if (!disp.ok) return res.status(400).json({ error: disp.error });

  const [ins] = await pool.query(
    "INSERT INTO citas (id_cliente, id_servicio, id_empleado, fecha, hora, estado) VALUES (?, ?, ?, ?, ?, 'Agendada')",
    [clienteId, servicio, empleado, fecha, hora]
  );
  res.json({ ok: true, id_cita: ins.insertId });
});

// Comprueba que la cita sea al menos 24h en el futuro (para cliente)
async function puedeClienteModificarCita(pool, idCita, idCliente) {
  const [rows] = await pool.query(
    "SELECT id_cliente, fecha, hora FROM citas WHERE id_cita = ? LIMIT 1",
    [idCita]
  );
  if (rows.length === 0) return { ok: false, error: "Cita no encontrada" };
  if (Number(rows[0].id_cliente) !== Number(idCliente)) return { ok: false, error: "No puede modificar esta cita" };
  const f = String(rows[0].fecha).slice(0, 10);
  const h = String(rows[0].hora).replace(/(\d{1,2}:\d{2})(:\d{2})?/, "$1");
  const dt = new Date(f + "T" + (h.length === 5 ? h + ":00" : h));
  const min24h = Date.now() + 24 * 60 * 60 * 1000;
  if (dt.getTime() < min24h) return { ok: false, error: "Solo puede reprogramar o cancelar con al menos 24 horas de anticipación" };
  return { ok: true };
}

// Reprogramar (Admin, Empleado o Cliente; Cliente con 24h de anticipación)
router.put("/:id/reprogramar", requireRole(["Administrador", "Empleado", "Cliente"]), async (req, res) => {
  const idCita = Number(req.params.id);
  const { fecha, hora, id_empleado } = req.body || {};
  if (!idCita || !fecha || !hora) return res.status(400).json({ error: "Datos inválidos" });

  const pool = req.pool;
  const rol = req.session.user.rol;

  // No permitir reprogramar a fechas pasadas
  const fechaStr = String(fecha).slice(0, 10);
  const hoyStr = new Date().toISOString().slice(0, 10);
  if (fechaStr < hoyStr) {
    return res.status(400).json({ error: "No se pueden reprogramar citas a fechas pasadas" });
  }

  const [citaRows] = await pool.query(
    "SELECT id_servicio, id_empleado, id_cliente FROM citas WHERE id_cita = ? LIMIT 1",
    [idCita]
  );
  if (citaRows.length === 0) return res.status(404).json({ error: "Cita no encontrada" });

  if (rol === "Cliente") {
    const [cl] = await pool.query("SELECT id_cliente FROM clientes WHERE id_usuario = ? LIMIT 1", [req.session.user.id_usuario]);
    if (cl.length === 0) return res.status(403).json({ error: "Perfil no encontrado" });
    const check = await puedeClienteModificarCita(pool, idCita, cl[0].id_cliente);
    if (!check.ok) return res.status(400).json({ error: check.error });
  }

  const servicio = citaRows[0].id_servicio;
  const empleadoNuevo = Number(id_empleado) || citaRows[0].id_empleado;

  const [rel] = await pool.query(
    "SELECT 1 FROM empleado_servicio WHERE id_empleado = ? AND id_servicio = ? LIMIT 1",
    [empleadoNuevo, servicio]
  );
  if (rel.length === 0) return res.status(400).json({ error: "El empleado no ofrece ese servicio" });

  const disp = await validarDisponibilidad(pool, empleadoNuevo, servicio, fecha, hora);
  if (!disp.ok) return res.status(400).json({ error: disp.error });

  await pool.query(
    "UPDATE citas SET fecha = ?, hora = ?, id_empleado = ?, estado = 'Reprogramada' WHERE id_cita = ?",
    [fecha, hora, empleadoNuevo, idCita]
  );
  res.json({ ok: true });
});

// Cancelar (Admin, Empleado o Cliente; Cliente con 24h de anticipación)
router.put("/:id/cancelar", requireRole(["Administrador", "Empleado", "Cliente"]), async (req, res) => {
  const idCita = Number(req.params.id);
  if (!idCita) return res.status(400).json({ error: "ID inválido" });
  const pool = req.pool;
  if (req.session.user.rol === "Cliente") {
    const [cl] = await pool.query("SELECT id_cliente FROM clientes WHERE id_usuario = ? LIMIT 1", [req.session.user.id_usuario]);
    if (cl.length === 0) return res.status(403).json({ error: "Perfil no encontrado" });
    const check = await puedeClienteModificarCita(pool, idCita, cl[0].id_cliente);
    if (!check.ok) return res.status(400).json({ error: check.error });
  }
  await pool.query("UPDATE citas SET estado = 'Cancelada' WHERE id_cita = ?", [idCita]);
  res.json({ ok: true });
});

// Marcar como terminada (Admin o Empleado)
router.put("/:id/terminar", requireRole(["Administrador", "Empleado"]), async (req, res) => {
  const idCita = Number(req.params.id);
  if (!idCita) return res.status(400).json({ error: "ID inválido" });
  await req.pool.query("UPDATE citas SET estado = 'Terminada' WHERE id_cita = ?", [idCita]);
  res.json({ ok: true });
});

module.exports = router;

