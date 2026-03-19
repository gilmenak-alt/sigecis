async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : "Error en la solicitud";
    throw new Error(msg);
  }
  return data;
}

async function getMe() {
  return await apiFetch("/api/auth/me");
}

