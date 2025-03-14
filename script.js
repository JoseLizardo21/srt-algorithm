let procesos = [];
let tablaResultados = [];
let listListos = [];
let listFinalizados = [];
let isLoading = false;
let tiempo = 0;
let isPause = false;

function ingresarProcesos() {
  let numProcesos = parseInt(document.getElementById("numProcesos").value);
  if (isNaN(numProcesos) || numProcesos < 1) {
    return;
  }

  let formProcesos = document.getElementById("formProcesos");
  formProcesos.innerHTML = "";

  for (let i = 0; i < numProcesos; i++) {
    // Generar valores aleatorios para el tiempo de llegada y duración
    let llegada = Math.floor(Math.random() * 10); // Tiempo de llegada entre 0 y 9
    let duracion = Math.floor(Math.random() * 10) + 1; // Duración entre 1 y 10

    formProcesos.innerHTML += `
      <div class="mb-2">
        Proceso ${i + 1}:
        <div class="d-flex flex-row">
          <label>Llegada:</label>
          <input type="number" id="llegada${i}" required style="width: 80px" value="${llegada}">
          <label class="ms-2">Duración:</label>
          <input type="number" id="duracion${i}" required style="width: 80px" value="${duracion}">
        </div>
      </div>`;
  }

  document.getElementById("iniciarSimulacion").style.display = "block";
}

function simularSRTF() {
  tiempo = 0;
  isPause = false;
  document.getElementById("btn-controls").style.display = "block";
  if (isLoading) return;
  isLoading = true;
  listListos = [];
  listFinalizados = [];
  let numProcesos = parseInt(document.getElementById("numProcesos").value);
  procesos = [];
  tablaResultados = [];
  mostrarTablaResultados([]);
  let colores = generarColores(numProcesos);
  for (let i = 0; i < numProcesos; i++) {
    let llegada = parseInt(document.getElementById(`llegada${i}`).value);
    let duracion = parseInt(document.getElementById(`duracion${i}`).value);
    procesos.push({
      id: i + 1,
      llegada,
      duracion,
      restante: duracion,
      color: colores[i],
    });
  }
  procesos.sort((a, b) => a.llegada - b.llegada);
  ejecutarSRTF();
}

function ejecutarSRTF() {
  let tiempoActual = 0;
  let finalizados = 0;
  let ganttChart = {};

  while (finalizados < procesos.length) {
    let listaEjecutable = procesos.filter(
      (p) => p.llegada <= tiempoActual && p.restante > 0
    );
    let procesoActual =
      listaEjecutable.length > 0
        ? listaEjecutable.reduce(
            (min, p) => (p.restante < min.restante ? p : min),
            listaEjecutable[0]
          )
        : null;

    procesos.forEach((p) => {
      if (!ganttChart[p.id]) ganttChart[p.id] = [];
      if (p === procesoActual) {
        ganttChart[p.id].push({ t: tiempoActual, tipo: "ejecucion" });
      } else if (p.restante > 0 && p.llegada <= tiempoActual) {
        ganttChart[p.id].push({ t: tiempoActual, tipo: "espera" });
      }
    });

    if (procesoActual) {
      procesoActual.restante--;
      if (procesoActual.restante === 0) finalizados++;
    }
    tiempoActual++;
  }
  generarDatosTabla(ganttChart);
  animarGantt(ganttChart, tiempoActual);
}

function generarDatosTabla(ganttChart) {
  let procesosCopy = [...procesos];
  procesosCopy.forEach((p) => {
    let ejecuciones = ganttChart[p.id].filter((e) => e.tipo === "ejecucion");

    p.arranque = ejecuciones.length > 0 ? ejecuciones[0].t : null; // Primer instante de ejecución
    p.finalizacion =
      ejecuciones.length > 0 ? ejecuciones[ejecuciones.length - 1].t + 1 : null; // Último instante de ejecución +1

    p.T = p.finalizacion - p.llegada;
    p.W = p.T - p.duracion;
    p.P = p.duracion > 0 ? (p.T / p.duracion).toFixed(2) : 0;

    tablaResultados.push(p);
  });
}

function actualizarLeyenda(tiempo, ganttChart) {
  // Filtramos primero los listos
  listListos = [];
  procesos
    .filter(
      (p) =>
        ganttChart[p.id] &&
        ganttChart[p.id].some((e) => e.t == tiempo && e.tipo === "espera")
    )
    .map((p) => {
      if (!listListos.includes(p.id)) {
        listListos.push(p.id);
      }
    });
  // Después filtramos de listListos los finalizados
  procesos
    .filter((p) => p.finalizacion == tiempo)
    .map((p) => {
      listListos = listListos.filter((e) => e !== p.id);
      if (!listFinalizados.includes(p.id)) {
        listFinalizados.push(p.id);
      }
    });

  // Actualizar la leyenda
  document.getElementById(
    "listos"
  ).innerHTML = `<strong>Listos:</strong> ${listListos
    .map((id) => `P${id}`)
    .join(", ")}`;
  document.getElementById(
    "finalizados"
  ).innerHTML = `<strong>Finalizados:</strong> ${listFinalizados
    .map((id) => `P${id}`)
    .join(", ")}`;
}

function animarGantt(ganttChart, tiempoMax) {
  let canvas = document.getElementById("ganttCanvas");
  let ctx = canvas.getContext("2d");
  tiempo = 0;
  let altura = 60; // Altura de cada proceso en el eje Y
  let escalaTiempo = (canvas.width / tiempoMax) * 0.9;
  let procesosOrdenados = Object.keys(ganttChart).sort((a, b) => a - b);

  function dibujarFrame() {
    if (isPause) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Actualizar el tiempo de sistema
    document.getElementById(
      "tiempoSistema"
    ).textContent = `Tiempo de Sistema: ${tiempo} segundos`;

    // Dibujar ejes
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 20);
    ctx.lineTo(50, canvas.height - 50);
    ctx.lineTo(canvas.width - 20, canvas.height - 50);
    ctx.stroke();

    // Etiquetas de tiempo en el eje X
    ctx.fillStyle = "black";
    for (let t = 0; t <= tiempoMax; t++) {
      let x = 50 + t * escalaTiempo;
      ctx.fillText(t, x, canvas.height - 30);
    }

    // Dibujar procesos
    procesosOrdenados.forEach((proceso, index) => {
      let y = canvas.height - 50 - (index + 1) * altura;
      let ejecucion = ganttChart[proceso].filter(
        (e) => e.t <= tiempo && e.tipo === "ejecucion"
      );
      let espera = ganttChart[proceso].filter(
        (e) => e.t <= tiempo && e.tipo === "espera"
      );

      // Dibujar ejecuciones
      ctx.fillStyle = procesos.find((p) => p.id == proceso).color;
      ctx.strokeStyle = "black";
      ctx.setLineDash([]);
      ejecucion.forEach((e) => {
        ctx.fillRect(50 + e.t * escalaTiempo, y, escalaTiempo, 10); // Altura de 10
      });

      // Dibujar tiempos de espera en línea punteada
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "gray";
      ctx.beginPath();
      let enEspera = false;

      espera.forEach((e, i) => {
        let xInicio = 50 + e.t * escalaTiempo;
        let yCentro = y + 5; // Centro del rectángulo de altura 10

        if (!enEspera) {
          ctx.moveTo(xInicio, yCentro);
          enEspera = true;
        }

        let siguiente = espera[i + 1];
        if (!siguiente || siguiente.t !== e.t + 1) {
          ctx.lineTo(xInicio + escalaTiempo, yCentro);
          enEspera = false;
        }
      });

      ctx.stroke();
      ctx.setLineDash([]); // Restablecer línea normal

      // Dibujar círculo en el tiempo de llegada
      let procesoData = procesos.find((p) => p.id == proceso);
      if (tiempo >= procesoData.llegada) {
        ctx.fillStyle = procesoData.color;
        ctx.beginPath();
        ctx.arc(
          50 + procesoData.llegada * escalaTiempo,
          y + 5,
          10,
          0,
          2 * Math.PI
        ); // Radio de 5
        ctx.fill();
        ctx.stroke();
      }

      // Actualizar la leyenda dinámica
      actualizarLeyenda(tiempo, ganttChart);

      // Etiqueta de proceso
      ctx.fillStyle = "black";
      ctx.fillText(`P${proceso}`, 10, y + 20);
    });

    tiempo++;
    if (tiempo <= tiempoMax) {
      setTimeout(dibujarFrame, 1000); // Actualizar cada segundo
    } else {
      isLoading = false;
      mostrarTablaResultados(tablaResultados);
    }
  }

  dibujarFrame();
}

function mostrarTablaResultados(tablaResultados) {
  let container = document.getElementById("containerTable");
  container.innerHTML = `<table class="table table-bordered">
      <thead>
          <tr>
              <th>Proceso</th>
              <th>Tiempo de llegada</th>
              <th>t</th>
              <th>Tiempo de arranque</th>
              <th>Tiempo de finalización</th>
              <th>T</th>
              <th>W</th>
              <th>P</th>
          </tr>
      </thead>
      <tbody>
          ${tablaResultados
            .map(
              (p) => `
              <tr>
                  <td>P${p.id}</td>
                  <td>${p.llegada}</td>
                  <td>${p.duracion}</td>
                  <td>${p.arranque}</td>
                  <td>${p.finalizacion}</td>
                  <td>${p.T}</td>
                  <td>${p.W}</td>
                  <td>${p.P}</td>
              </tr>`
            )
            .join("")}
      </tbody>
  </table>`;
}

function validarEntero(input) {
  input.value = input.value.replace(/[^0-9]/g, ""); // Elimina caracteres no numéricos
}

function generarColores(cantidad) {
  return [
    "#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#A133FF",
    "#33FFF5", "#FF8C33", "#8CFF33", "#338CFF", "#FF338C",
    "#8C33FF", "#33FF8C", "#FF5733", "#33FF57", "#3357FF",
    "#FF33A1", "#A133FF", "#33FFF5", "#FF8C33", "#8CFF33"
  ];
}

function pausarSimulacion() {
  isPause = true;
  isLoading = false;
}
