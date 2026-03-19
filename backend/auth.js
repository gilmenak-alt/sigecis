const bcrypt = require("bcryptjs");

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "No autenticado" });
  }
  next();
}

function requireRole(roles) {
  const allow = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "No autenticado" });
    }
    if (!allow.includes(req.session.user.rol)) {
      return res.status(403).json({ error: "No autorizado" });
    }
    next();
  };
}

async function verifyPasswordAndMigrateIfNeeded(pool, userRow, plainPassword) {
  const stored = userRow.password || "";

  // Si ya parece hash bcrypt
  const isBcrypt = stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$");
  if (isBcrypt) {
    return await bcrypt.compare(plainPassword, stored);
  }

  // Si estaba en texto plano (como en tu sigeciss.sql), validar igual y migrar a hash.
  if (stored === plainPassword) {
    const hash = await bcrypt.hash(plainPassword, 10);
    await pool.query("UPDATE usuarios SET password = ? WHERE id_usuario = ?", [
      hash,
      userRow.id_usuario
    ]);
    return true;
  }

  return false;
}

module.exports = { requireAuth, requireRole, verifyPasswordAndMigrateIfNeeded };

