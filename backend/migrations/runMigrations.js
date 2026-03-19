async function columnExists(pool, table, column) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column]
  );
  return rows[0].cnt > 0;
}

async function tableExists(pool, table) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    [table]
  );
  return rows[0].cnt > 0;
}

async function ensureSchema(pool) {
  // Extensiones no destructivas al SQL existente
  // Vincular usuarios con clientes/empleados (para sesiones por rol)
  if (await tableExists(pool, "clientes")) {
    if (!(await columnExists(pool, "clientes", "id_usuario"))) {
      await pool.query("ALTER TABLE clientes ADD COLUMN id_usuario INT NULL");
      await pool.query(
        "ALTER TABLE clientes ADD CONSTRAINT fk_clientes_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)"
      );
    }
  }

  if (await tableExists(pool, "empleados")) {
    if (!(await columnExists(pool, "empleados", "id_usuario"))) {
      await pool.query("ALTER TABLE empleados ADD COLUMN id_usuario INT NULL");
      await pool.query(
        "ALTER TABLE empleados ADD CONSTRAINT fk_empleados_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)"
      );
    }

    if (!(await columnExists(pool, "empleados", "disponible"))) {
      await pool.query(
        "ALTER TABLE empleados ADD COLUMN disponible TINYINT(1) NOT NULL DEFAULT 1"
      );
    }
  }

  // Autovincular registros demo a usuarios (para que agendas por rol funcionen)
  if (await tableExists(pool, "usuarios") && await tableExists(pool, "roles")) {
    if (await tableExists(pool, "clientes") && (await columnExists(pool, "clientes", "id_usuario"))) {
      // Clientes: se puede vincular por correo
      await pool.query(
        `UPDATE clientes c
         JOIN usuarios u ON u.correo = c.correo
         JOIN roles r ON r.id_rol = u.id_rol
         SET c.id_usuario = u.id_usuario
         WHERE c.id_usuario IS NULL AND r.nombre_rol = 'Cliente'`
      );
    }

    if (await tableExists(pool, "empleados") && (await columnExists(pool, "empleados", "id_usuario"))) {
      // Empleados: vincular por nombre (en el SQL demo el nombre coincide)
      await pool.query(
        `UPDATE empleados e
         JOIN usuarios u ON u.nombre = e.nombre
         JOIN roles r ON r.id_rol = u.id_rol
         SET e.id_usuario = u.id_usuario
         WHERE e.id_usuario IS NULL AND r.nombre_rol = 'Empleado'`
      );
    }
  }

  // Relación muchos-a-muchos empleado-servicio para filtrar empleados disponibles por servicio
  if (!(await tableExists(pool, "empleado_servicio"))) {
    await pool.query(`
      CREATE TABLE empleado_servicio (
        id_empleado INT NOT NULL,
        id_servicio INT NOT NULL,
        PRIMARY KEY (id_empleado, id_servicio),
        CONSTRAINT fk_es_empleado FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado),
        CONSTRAINT fk_es_servicio FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
      )
    `);
  }

  // Duración de servicios (min/max en minutos) para agenda y validación de choques
  if (await tableExists(pool, "servicios")) {
    if (!(await columnExists(pool, "servicios", "duracion_min"))) {
      await pool.query("ALTER TABLE servicios ADD COLUMN duracion_min INT NOT NULL DEFAULT 60");
    }
    if (!(await columnExists(pool, "servicios", "duracion_max"))) {
      await pool.query("ALTER TABLE servicios ADD COLUMN duracion_max INT NOT NULL DEFAULT 60");
    }
    // Ajuste heurístico para servicios existentes (solo cuando están en defaults 60/60)
    await pool.query(`
      UPDATE servicios
      SET duracion_min = CASE
        WHEN LOWER(nombre) LIKE '%maquill%' THEN 45
        WHEN LOWER(nombre) LIKE '%color%' THEN 90
        WHEN LOWER(nombre) LIKE '%tratamiento%' THEN 60
        WHEN LOWER(nombre) LIKE '%manic%' THEN 30
        WHEN LOWER(nombre) LIKE '%pedic%' THEN 40
        WHEN LOWER(nombre) LIKE '%peinad%' THEN 45
        WHEN LOWER(nombre) LIKE '%brushing%' THEN 30
        WHEN LOWER(nombre) LIKE '%depil%' THEN 30
        WHEN LOWER(nombre) LIKE '%cejas%' THEN 20
        WHEN LOWER(nombre) LIKE '%pesta%' THEN 60
        WHEN LOWER(nombre) LIKE '%barba%' THEN 25
        WHEN LOWER(nombre) LIKE '%afeitado%' THEN 20
        WHEN LOWER(nombre) LIKE '%corte%' THEN 30
        ELSE duracion_min
      END,
      duracion_max = CASE
        WHEN LOWER(nombre) LIKE '%maquill%' THEN 90
        WHEN LOWER(nombre) LIKE '%color%' THEN 180
        WHEN LOWER(nombre) LIKE '%tratamiento%' THEN 120
        WHEN LOWER(nombre) LIKE '%manic%' THEN 45
        WHEN LOWER(nombre) LIKE '%pedic%' THEN 60
        WHEN LOWER(nombre) LIKE '%peinad%' THEN 90
        WHEN LOWER(nombre) LIKE '%brushing%' THEN 45
        WHEN LOWER(nombre) LIKE '%depil%' THEN 45
        WHEN LOWER(nombre) LIKE '%cejas%' THEN 30
        WHEN LOWER(nombre) LIKE '%pesta%' THEN 120
        WHEN LOWER(nombre) LIKE '%barba%' THEN 40
        WHEN LOWER(nombre) LIKE '%afeitado%' THEN 30
        WHEN LOWER(nombre) LIKE '%corte%' THEN 45
        ELSE duracion_max
      END
      WHERE (duracion_min = 60 AND duracion_max = 60) OR duracion_min IS NULL OR duracion_max IS NULL
    `);
    await pool.query("UPDATE servicios SET duracion_min = 15 WHERE duracion_min < 15 OR duracion_min IS NULL");
    await pool.query("UPDATE servicios SET duracion_max = duracion_min WHERE duracion_max < duracion_min OR duracion_max IS NULL");
  }

  // Si está vacío, intentar sembrar con una heurística simple por especialidad/nombre del servicio
  const [countRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM empleado_servicio"
  );
  if (countRows[0].cnt === 0) {
    const [empleados] = await pool.query(
      "SELECT id_empleado, especialidad FROM empleados"
    );
    const [servicios] = await pool.query(
      "SELECT id_servicio, nombre FROM servicios"
    );

    const inserts = [];
    for (const e of empleados) {
      const esp = (e.especialidad || "").toLowerCase();
      for (const s of servicios) {
        const nom = (s.nombre || "").toLowerCase();
        const match =
          (esp && nom.includes(esp)) ||
          (esp.includes("barber") && (nom.includes("afeitado") || nom.includes("barba"))) ||
          (esp.includes("maquill") && nom.includes("maquill")) ||
          (esp.includes("manic") && (nom.includes("manic") || nom.includes("pedic"))) ||
          (esp.includes("color") && nom.includes("color")) ||
          (esp.includes("peinad") && (nom.includes("peinad") || nom.includes("brushing"))) ||
          (esp.includes("corte") && nom.includes("corte"));

        if (match) inserts.push([e.id_empleado, s.id_servicio]);
      }
    }

    if (inserts.length > 0) {
      await pool.query(
        "INSERT IGNORE INTO empleado_servicio (id_empleado, id_servicio) VALUES ?",
        [inserts]
      );
    }
  }

  // Tabla novedades (cambios, descuentos, avisos del salón)
  if (!(await tableExists(pool, "novedades"))) {
    await pool.query(`
      CREATE TABLE novedades (
        id_novedad INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(200) NOT NULL,
        contenido TEXT,
        tipo VARCHAR(50) DEFAULT 'aviso',
        fecha_publicacion DATE NOT NULL,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Aumentar lista base de empleados si solo existen los de ejemplo
  if (await tableExists(pool, "empleados")) {
    const [empCount] = await pool.query("SELECT COUNT(*) AS cnt FROM empleados");
    if (empCount[0].cnt <= 5) {
      await pool.query(
        `INSERT INTO empleados (nombre, especialidad, disponible) VALUES
         ('Pedro Herrera', 'Corte de cabello y barba', 1),
         ('Lucía Méndez', 'Tratamientos capilares', 1),
         ('Valeria Ruiz', 'Maquillaje y peinados para eventos', 1),
         ('Jorge Álvarez', 'Barbería y afeitado clásico', 1),
         ('Marta Castillo', 'Manicura y pedicura spa', 1),
         ('Equipo limpieza mañana', 'Limpieza y desinfección (turno mañana)', 1),
         ('Equipo limpieza tarde', 'Limpieza y desinfección (turno tarde)', 1)`
      );
    }
  }

  // Asegurar al menos 3 empleados por servicio y su asignación
  if (await tableExists(pool, "servicios") && await tableExists(pool, "empleados") && await tableExists(pool, "empleado_servicio")) {
    const [servicios] = await pool.query("SELECT id_servicio, nombre FROM servicios ORDER BY id_servicio");
    for (const s of servicios) {
      const [[{ cnt }]] = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM empleado_servicio es
         JOIN empleados e ON e.id_empleado = es.id_empleado
         WHERE es.id_servicio = ? AND e.disponible = 1`,
        [s.id_servicio]
      );
      const faltan = Math.max(0, 3 - Number(cnt || 0));
      if (faltan === 0) continue;

      for (let i = 0; i < faltan; i++) {
        const nombreEmp = `${s.nombre} – Especialista ${i + 1}`;
        const [ins] = await pool.query(
          "INSERT INTO empleados (nombre, especialidad, disponible) VALUES (?, ?, 1)",
          [nombreEmp, s.nombre]
        );
        await pool.query(
          "INSERT IGNORE INTO empleado_servicio (id_empleado, id_servicio) VALUES (?, ?)",
          [ins.insertId, s.id_servicio]
        );
      }
    }
  }
}

module.exports = { ensureSchema };

