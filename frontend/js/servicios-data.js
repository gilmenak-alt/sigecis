(function() {
  window.SERVICIOS_DESCRIPCIONES = {
    "Afeitado": "Servicio de afeitado profesional con técnicas precisas que dejan la piel suave y libre de irritaciones, brindando un acabado limpio y elegante.",
    "Brushing": "Secado y peinado profesional con cepillo para dar forma, volumen y brillo al cabello, logrando un look pulido y duradero.",
    "Coloración": "Aplicación profesional de color para renovar tu estilo, cubrir canas o transformar tu look con tonos modernos y de alta calidad.",
    "Corte de barba": "Perfilado y recorte de barba para definir el estilo, mantener una apariencia ordenada y resaltar los rasgos del rostro.",
    "Corte de cabello": "Corte personalizado según tu estilo y tipo de cabello, realizado por profesionales para lograr un look moderno y favorecedor.",
    "Depilación": "Eliminación de vello no deseado con técnicas seguras y eficaces que dejan la piel suave y limpia por más tiempo.",
    "Diseño de cejas": "Definición y perfilado de cejas para armonizar el rostro y resaltar la mirada con un acabado natural y preciso.",
    "Extensión de pestañas": "Aplicación de extensiones que aportan mayor volumen y longitud a las pestañas, logrando una mirada más intensa y atractiva.",
    "Manicura": "Cuidado completo de las uñas de las manos que incluye limpieza, corte, limado y esmaltado para lucir manos elegantes y bien cuidadas.",
    "Maquillaje profesional": "Maquillaje realizado por especialistas para resaltar tu belleza natural en eventos, sesiones fotográficas o ocasiones especiales.",
    "Pedicura": "Tratamiento estético para el cuidado de los pies que incluye limpieza, exfoliación y arreglo de uñas para mayor bienestar y estética.",
    "Peinados": "Creación de peinados elegantes o casuales adaptados a tu estilo y ocasión, logrando un acabado profesional y duradero.",
    "Tratamiento capilar": "Terapia de hidratación y nutrición profunda que ayuda a reparar el cabello dañado, devolviéndole brillo, suavidad y vitalidad."
  };

  function slug(str) {
    if (!str) return "servicio";
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  window.getDescripcionServicio = function(nombre) {
    return window.SERVICIOS_DESCRIPCIONES[(nombre || "").trim()] || "";
  };

  window.getImageSlugServicio = function(nombre) {
    return slug(nombre);
  };

  // Mapeo explícito: nombre de servicio -> archivo en /img/
  // (Tus archivos reales: afeitado.jpg, brushing.jpg, coloracion.jpg, cortebarba.jpg, depilacion.jpg, disenocejas.jpg,
  // extensionpestana.jpg, manicura.jpg, maquillaje.jpg, pedicura.jpg, peinado.jpg, tratamiento.jpg)
  var IMAGE_BY_SERVICE = {
    "Afeitado": "afeitado.jpg",
    "Brushing": "brushing.jpg",
    "Coloración": "coloracion.jpg",
    "Corte de cabello": "corte_cabello.jpg",
    "Corte de barba": "cortebarba.jpg",
    "Depilación": "depilacion.jpg",
    "Diseño de cejas": "disenocejas.jpg",
    "Extensión de pestañas": "extensionpestana.jpg",
    "Manicura": "manicura.jpg",
    "Maquillaje profesional": "maquillaje.jpg",
    "Pedicura": "pedicura.jpg",
    "Peinados": "peinado.jpg",
    "Tratamiento capilar": "tratamiento.jpg"
  };

  window.getImageUrlServicio = function(nombre) {
    var n = (nombre || "").trim();
    var explicit = IMAGE_BY_SERVICE[n];
    if (explicit) return "/img/" + explicit;
    var base = "/img/" + getImageSlugServicio(n);
    return base + ".jpg";
  };

  window.getImageUrlServicioWithFallback = function(nombre) {
    var n = (nombre || "").trim();
    var explicit = IMAGE_BY_SERVICE[n];
    if (explicit) return ["/img/" + explicit, "/img/placeholder.svg"];
    var base = "/img/" + getImageSlugServicio(n);
    return [base + ".jpg", base + ".jpeg", base + ".png", "/img/placeholder.svg"];
  };
})();
