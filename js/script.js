/* SERVICIOS */

if (!localStorage.getItem("servicios")) {
  let servicios = [
    { nombre: "Corte de cabello", precio: 15000 },
    { nombre: "Coloración", precio: 50000 },
    { nombre: "Peinados", precio: 30000 },
    { nombre: "Brushing", precio: 25000 },
    { nombre: "Tratamiento capilar", precio: 40000 },
    { nombre: "Manicura", precio: 20000 },
    { nombre: "Pedicura", precio: 25000 },
    { nombre: "Depilación", precio: 18000 },
    { nombre: "Diseño de cejas", precio: 15000 },
    { nombre: "Extensión de pestañas", precio: 35000 },
    { nombre: "Maquillaje profesional", precio: 45000 },
    { nombre: "Afeitado", precio: 15000 },
    { nombre: "Corte de barba", precio: 20000 }
  ];

  localStorage.setItem("servicios", JSON.stringify(servicios));
}

/* EMPLEADOS */

if (!localStorage.getItem("empleados")) {
  let empleados = [
    { nombre: "Laura Martínez", especialidad: "Coloración" },
    { nombre: "Carlos Gómez", especialidad: "Barbería" },
    { nombre: "Ana Torres", especialidad: "Manicura" },
    { nombre: "María López", especialidad: "Peinados" },
    { nombre: "Sofía Ramírez", especialidad: "Maquillaje" },
    { nombre: "Daniel Rojas", especialidad: "Corte de cabello" },
    { nombre: "Paula Díaz", especialidad: "Tratamientos capilares" }
  ];

  localStorage.setItem("empleados", JSON.stringify(empleados));
}

/* CITAS */

if (!localStorage.getItem("citas")) {
  localStorage.setItem("citas", JSON.stringify([]));
}

/* PAGOS */

if (!localStorage.getItem("pagos")) {
  localStorage.setItem("pagos", JSON.stringify([]));
}

/* FUNCIONES DE ACCESO COMUNES */

function obtenerServicios() {
  const datos = localStorage.getItem("servicios");
  return datos ? JSON.parse(datos) : [];
}

function guardarServicios(servicios) {
  localStorage.setItem("servicios", JSON.stringify(servicios));
}

function obtenerEmpleados() {
  const datos = localStorage.getItem("empleados");
  return datos ? JSON.parse(datos) : [];
}

function guardarEmpleados(empleados) {
  localStorage.setItem("empleados", JSON.stringify(empleados));
}

function obtenerCitas() {
  const datos = localStorage.getItem("citas");
  return datos ? JSON.parse(datos) : [];
}

function guardarCitas(citas) {
  localStorage.setItem("citas", JSON.stringify(citas));
}

function obtenerPagos() {
  const datos = localStorage.getItem("pagos");
  return datos ? JSON.parse(datos) : [];
}

function guardarPagos(pagos) {
  localStorage.setItem("pagos", JSON.stringify(pagos));
}