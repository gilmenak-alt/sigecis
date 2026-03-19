async function login(correo, password) {
  return await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ correo, password })
  });
}

async function registerCliente({ nombre, correo, password, telefono }) {
  return await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ nombre, correo, password, telefono })
  });
}

async function logout() {
  return await apiFetch("/api/auth/logout", { method: "POST" });
}

function redirectByRole(rol) {
  if (rol === "Administrador") window.location = "/pages/admin.html";
  else if (rol === "Empleado") window.location = "/pages/empleado.html";
  else window.location = "/pages/cliente.html";
}

