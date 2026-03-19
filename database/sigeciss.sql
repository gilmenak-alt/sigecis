-- Copia del esquema base solicitado por el proyecto.
-- Importa este archivo en MySQL para crear la base de datos y tablas.

CREATE DATABASE sigeciss;
USE sigeciss;

CREATE TABLE roles(
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre_rol VARCHAR(30)
);

INSERT INTO roles(nombre_rol) VALUES
('Administrador'),
('Empleado'),
('Cliente');

CREATE TABLE usuarios(
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100),
  correo VARCHAR(100),
  password VARCHAR(100),
  id_rol INT,
  FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
);

INSERT INTO usuarios(nombre,correo,password,id_rol) VALUES
('Administrador','admin@salon.com','1234',1),
('Laura Martinez','laura@salon.com','1234',2),
('Carlos Gomez','carlos@salon.com','1234',2),
('Ana Torres','ana@salon.com','1234',2),
('Cliente Demo','cliente@correo.com','1234',3);

CREATE TABLE clientes(
  id_cliente INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100),
  telefono VARCHAR(20),
  correo VARCHAR(100)
);

INSERT INTO clientes(nombre,telefono,correo) VALUES
('María Pérez','300111111','maria@email.com'),
('Juan López','300222222','juan@email.com'),
('Camila Torres','300333333','camila@email.com');

CREATE TABLE servicios(
  id_servicio INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100),
  precio INT
);

INSERT INTO servicios(nombre,precio) VALUES
('Corte de cabello',15000),
('Coloración',50000),
('Peinados',30000),
('Brushing',25000),
('Tratamiento capilar',40000),
('Manicura',20000),
('Pedicura',25000),
('Depilación',18000),
('Diseño de cejas',15000),
('Extensión de pestañas',35000),
('Maquillaje profesional',45000),
('Afeitado',15000),
('Corte de barba',20000);

CREATE TABLE empleados(
  id_empleado INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100),
  especialidad VARCHAR(100)
);

INSERT INTO empleados(nombre,especialidad) VALUES
('Laura Martínez','Coloración'),
('Carlos Gómez','Barbería'),
('Ana Torres','Manicura'),
('María López','Peinados'),
('Sofía Ramírez','Maquillaje');

CREATE TABLE disponibilidad(
  id_disponibilidad INT AUTO_INCREMENT PRIMARY KEY,
  id_empleado INT,
  dia_semana VARCHAR(20),
  hora_inicio TIME,
  hora_fin TIME,
  FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado)
);

INSERT INTO disponibilidad(id_empleado,dia_semana,hora_inicio,hora_fin) VALUES
(1,'Lunes','08:00','16:00'),
(2,'Martes','09:00','17:00'),
(3,'Miércoles','10:00','18:00'),
(4,'Jueves','08:00','15:00'),
(5,'Viernes','12:00','20:00');

CREATE TABLE citas(
  id_cita INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente INT,
  id_servicio INT,
  id_empleado INT,
  fecha DATE,
  hora TIME,
  estado VARCHAR(30),
  FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
  FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio),
  FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado)
);

INSERT INTO citas(id_cliente,id_servicio,id_empleado,fecha,hora,estado) VALUES
(1,1,1,'2025-03-15','10:00','Agendada'),
(2,3,4,'2025-03-16','14:00','Agendada');

CREATE TABLE pagos(
  id_pago INT AUTO_INCREMENT PRIMARY KEY,
  id_cita INT,
  monto INT,
  metodo_pago VARCHAR(50),
  fecha_pago DATE,
  FOREIGN KEY (id_cita) REFERENCES citas(id_cita)
);

INSERT INTO pagos(id_cita,monto,metodo_pago,fecha_pago) VALUES
(1,15000,'Efectivo','2025-03-15');

CREATE TABLE reportes(
  id_reporte INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATE,
  total_ingresos INT
);

