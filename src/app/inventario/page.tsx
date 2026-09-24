"use client";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import {
  CAMPOS_GENERALES,
  CATEGORIAS_INVENTARIO,
  ESTADOS_INVENTARIO,
  obtenerCategoria,
  type CampoInventario,
  type EquipoInventario,
  type EstadoInventario,
} from "@/lib/inventarioData";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    QRious: any;
  }
}

function cargarQRiousLib(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.QRious) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el generador de código QR."));
    document.body.appendChild(script);
  });
}

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

// ⚠️ TEMPORAL: datos de ejemplo mientras se construye el backend (/api/inventario).
const EQUIPOS_EJEMPLO: EquipoInventario[] = [
  {
    id: 1,
    folio: "LAP-0001",
    categoria: "laptop",
    estado: "Activo",
    datos: { nombre: "Laptop Tráfico", marca: "Dell", modelo: "Latitude 5420", numero_serie: "8H2KXY3", area: "Operaciones", ubicacion: "Oficina planta alta", responsable: "Juan Pérez", procesador: "Intel Core i7-1185G7", ram_gb: "16", almacenamiento_gb: "512", tipo_almacenamiento: "SSD", sistema_operativo: "Windows 11 Pro", pantalla_pulgadas: "14" },
    created_at: "2026-09-20",
  },
  {
    id: 2,
    folio: "ESC-0001",
    categoria: "escritorio",
    estado: "Activo",
    datos: { nombre: "Escritorio Gerencia", marca: "Offiho", area: "Administración", ubicacion: "Gerencia", responsable: "María López", material: "Melamina", medidas: "150 x 70 x 75", color: "Nogal", cajones: "3" },
    created_at: "2026-09-21",
  },
  {
    id: 3,
    folio: "IMP-0001",
    categoria: "impresora",
    estado: "En reparación",
    datos: { nombre: "Impresora Recepción", marca: "HP", modelo: "LaserJet M428", area: "Recepción", ubicacion: "Planta baja", tipo_impresion: "Multifuncional", a_color: "No", conexion: "Red / Ethernet" },
    created_at: "2026-09-22",
  },
];

const COLOR_ESTADO: Record<EstadoInventario, { bg: string; fg: string }> = {
  Activo: { bg: "#e6f6ee", fg: "var(--green)" },
  "En reparación": { bg: "#fdf4e1", fg: "#b7800f" },
  "En almacén": { bg: "var(--blue-light)", fg: "var(--blue)" },
  Baja: { bg: "#fdeaea", fg: "var(--red)" },
};

function Campo({ campo, valor, onChange }: { campo: CampoInventario; valor: string; onChange: (v: string) => void }) {
  const clases = "w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-[var(--blue)]";
  return (
    <label className="block">
      <span className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">
        {campo.etiqueta}
        {campo.requerido && <span className="text-[var(--red)]"> *</span>}
      </span>
      {campo.tipo === "select" ? (
        <select value={valor} onChange={(e) => onChange(e.target.value)} className={clases}>
          <option value="">Selecciona…</option>
          {campo.opciones?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={campo.tipo === "numero" ? "number" : campo.tipo === "fecha" ? "date" : "text"}
          value={valor}
          placeholder={campo.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={clases}
        />
      )}
    </label>
  );
}

export default function InventarioPage() {
  const [equipos, setEquipos] = useState<EquipoInventario[]>(EQUIPOS_EJEMPLO);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Modal agregar
  const [modalAgregar, setModalAgregar] = useState(false);
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [estadoNuevo, setEstadoNuevo] = useState<EstadoInventario>("Activo");
  const [datosNuevos, setDatosNuevos] = useState<Record<string, string>>({});
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Modal detalle / QR
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<EquipoInventario | null>(null);

  const equiposFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return equipos.filter((e) => {
      if (filtroCategoria && e.categoria !== filtroCategoria) return false;
      if (filtroEstado && e.estado !== filtroEstado) return false;
      if (!q) return true;
      const texto = [e.folio, ...Object.values(e.datos)].join(" ").toLowerCase();
      return texto.includes(q);
    });
  }, [equipos, busqueda, filtroCategoria, filtroEstado]);

  const totalesPorEstado = useMemo(() => {
    const t: Record<string, number> = {};
    ESTADOS_INVENTARIO.forEach((s) => (t[s] = 0));
    equipos.forEach((e) => (t[e.estado] = (t[e.estado] || 0) + 1));
    return t;
  }, [equipos]);

  // Pinta los QR pequeños de cada tarjeta
  useEffect(() => {
    if (equiposFiltrados.length === 0) return;
    cargarQRiousLib()
      .then(() => {
        const origen = window.location.origin;
        equiposFiltrados.forEach((e) => {
          const canvas = document.getElementById(`qr-inv-${e.id}`) as HTMLCanvasElement | null;
          if (canvas) new window.QRious({ element: canvas, value: `${origen}/inventario/detalle?folio=${e.folio}`, size: 64, level: "M" });
        });
      })
      .catch(() => {});
  }, [equiposFiltrados]);

  // Pinta el QR grande del modal de detalle
  useEffect(() => {
    if (!equipoSeleccionado) return;
    cargarQRiousLib()
      .then(() => {
        const canvas = document.getElementById("qr-inv-detalle") as HTMLCanvasElement | null;
        if (canvas) new window.QRious({ element: canvas, value: `${window.location.origin}/inventario/detalle?folio=${equipoSeleccionado.folio}`, size: 180, level: "M" });
      })
      .catch(() => {});
  }, [equipoSeleccionado]);

  const abrirAgregar = () => {
    setCategoriaNueva("");
    setEstadoNuevo("Activo");
    setDatosNuevos({});
    setErrorForm(null);
    setModalAgregar(true);
  };

  const cambiarCategoria = (clave: string) => {
    // Al cambiar de categoría se descartan los campos específicos de la anterior (congruencia).
    const generales: Record<string, string> = {};
    CAMPOS_GENERALES.forEach((c) => {
      if (datosNuevos[c.clave]) generales[c.clave] = datosNuevos[c.clave];
    });
    setDatosNuevos(generales);
    setCategoriaNueva(clave);
  };

  const guardarEquipo = () => {
    const categoria = obtenerCategoria(categoriaNueva);
    if (!categoria) return setErrorForm("Selecciona una categoría.");
    const faltantes = [...CAMPOS_GENERALES, ...categoria.campos].filter((c) => c.requerido && !datosNuevos[c.clave]?.trim());
    if (faltantes.length > 0) return setErrorForm(`Completa: ${faltantes.map((c) => c.etiqueta).join(", ")}.`);

    // TEMPORAL: el folio y el id los generará el backend.
    const consecutivo = equipos.filter((e) => e.categoria === categoria.clave).length + 1;
    const nuevo: EquipoInventario = {
      id: Date.now(),
      folio: `${categoria.prefijo}-${String(consecutivo).padStart(4, "0")}`,
      categoria: categoria.clave,
      estado: estadoNuevo,
      datos: datosNuevos,
      created_at: new Date().toISOString().slice(0, 10),
    };
    setEquipos((prev) => [nuevo, ...prev]);
    setModalAgregar(false);
    setEquipoSeleccionado(nuevo);
  };

  const imprimirEtiqueta = (equipo: EquipoInventario) => {
    const canvas = document.getElementById("qr-inv-detalle") as HTMLCanvasElement | null;
    if (!canvas) return;
    const img = canvas.toDataURL("image/png");
    const cat = obtenerCategoria(equipo.categoria)?.nombre || "";
    const w = window.open("", "_blank", "width=420,height=520");
    if (!w) return alert("Permite las ventanas emergentes para imprimir la etiqueta.");
    w.document.write(`<!doctype html><html><head><title>Etiqueta ${equipo.folio}</title>
      <style>body{font-family:Segoe UI,sans-serif;display:flex;justify-content:center;padding:20px}
      .et{border:2px solid #16215c;border-radius:10px;padding:14px 18px;text-align:center;width:240px}
      h1{font-size:18px;margin:8px 0 2px;color:#16215c}p{margin:2px 0;font-size:12px;color:#444}
      small{display:block;margin-top:6px;font-size:10px;color:#888}</style></head>
      <body><div class="et"><img src="${img}" width="180" height="180"/>
      <h1>${equipo.folio}</h1><p><b>${equipo.datos.nombre || ""}</b></p><p>${cat}</p>
      <small>Transportes Logisticar · Control de inventario</small></div>
      <script>window.onload=()=>{window.print();}</script></body></html>`);
    w.document.close();
  };

  const categoriaSeleccionada = obtenerCategoria(categoriaNueva);

  return (
    <div className="min-h-screen bg-[#eef1f6] flex flex-col">
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10 flex-1">
        <PageHeader
          titulo="Control de inventario"
          subtitulo="Registra equipos y mobiliario, genera su código QR y consulta su información."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>}
        />

        {/* Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="bg-[var(--navy)] rounded-2xl p-4 text-white">
            <p className="text-[11px] uppercase tracking-wide opacity-80 m-0">Total de equipos</p>
            <p className="text-[26px] font-bold m-0">{equipos.length}</p>
          </div>
          {ESTADOS_INVENTARIO.map((s) => (
            <div key={s} className="bg-white rounded-2xl p-4 border border-[var(--gray-200)]">
              <p className="text-[11px] uppercase tracking-wide text-[var(--gray-400)] m-0">{s}</p>
              <p className="text-[26px] font-bold m-0" style={{ color: COLOR_ESTADO[s].fg }}>{totalesPorEstado[s]}</p>
            </div>
          ))}
        </div>

        {/* Barra de filtros */}
        <div className="bg-white rounded-[18px] p-4 sm:p-5 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-5 flex flex-col md:flex-row gap-3 md:items-center">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por folio, nombre, marca, serie, responsable…"
            className="flex-1 border border-[var(--gray-200)] rounded-lg px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-[var(--blue)]"
          />
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13px] bg-white">
            <option value="">Todas las categorías</option>
            {CATEGORIAS_INVENTARIO.map((c) => (
              <option key={c.clave} value={c.clave}>{c.nombre}</option>
            ))}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13px] bg-white">
            <option value="">Todos los estados</option>
            {ESTADOS_INVENTARIO.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="button" onClick={abrirAgregar} className="flex items-center justify-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold whitespace-nowrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
            Agregar equipo
          </button>
        </div>

        {/* Tarjetas de equipos */}
        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-4">Equipos registrados ({equiposFiltrados.length})</h3>
          {equiposFiltrados.length === 0 ? (
            <p className="text-[13px] text-[var(--gray-400)] py-8 text-center">No hay equipos que coincidan. Usa &quot;Agregar equipo&quot; para registrar el primero.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 md:gap-5">
              {equiposFiltrados.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEquipoSeleccionado(e)}
                  className="text-left bg-white border border-[var(--gray-200)] rounded-2xl p-4 hover:border-[var(--blue)] transition-colors flex gap-3.5"
                >
                  <div className="w-[76px] h-[76px] shrink-0 rounded-xl border border-[var(--gray-200)] flex items-center justify-center p-1.5">
                    <canvas id={`qr-inv-${e.id}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-bold text-[var(--blue)] m-0">{e.folio} · {obtenerCategoria(e.categoria)?.nombre}</p>
                    <h4 className="text-[13.5px] font-bold text-[var(--navy)] m-0 mb-1 truncate">{e.datos.nombre}</h4>
                    <p className="text-[11.5px] text-[var(--gray-400)] m-0 truncate">{[e.datos.marca, e.datos.modelo].filter(Boolean).join(" ") || "—"}</p>
                    <p className="text-[11.5px] text-[var(--gray-400)] m-0 truncate">{e.datos.responsable || "Sin responsable"}</p>
                    <span className="inline-block mt-1.5 text-[10.5px] font-bold rounded-full px-2 py-0.5" style={{ backgroundColor: COLOR_ESTADO[e.estado].bg, color: COLOR_ESTADO[e.estado].fg }}>
                      {e.estado}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: agregar equipo */}
      {modalAgregar && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={() => setModalAgregar(false)}>
          <div className="bg-white rounded-2xl w-full max-w-[760px] max-h-[92vh] overflow-y-auto p-5 md:p-7" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="text-[17px] font-bold text-[var(--navy)] m-0 mb-1">Agregar equipo al inventario</h3>
            <p className="text-[12px] text-[var(--gray-400)] m-0 mb-5">Elige la categoría: solo se mostrarán los campos que le corresponden.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
              <label className="block">
                <span className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Categoría <span className="text-[var(--red)]">*</span></span>
                <select value={categoriaNueva} onChange={(e) => cambiarCategoria(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] bg-white">
                  <option value="">Selecciona…</option>
                  {CATEGORIAS_INVENTARIO.map((c) => (
                    <option key={c.clave} value={c.clave}>{c.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Estado</span>
                <select value={estadoNuevo} onChange={(e) => setEstadoNuevo(e.target.value as EstadoInventario)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] bg-white">
                  {ESTADOS_INVENTARIO.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>

            {categoriaSeleccionada && (
              <>
                <p className="text-[11px] uppercase tracking-wide font-bold text-[var(--gray-400)] mb-2">Datos generales</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                  {CAMPOS_GENERALES.map((c) => (
                    <Campo key={c.clave} campo={c} valor={datosNuevos[c.clave] || ""} onChange={(v) => setDatosNuevos((p) => ({ ...p, [c.clave]: v }))} />
                  ))}
                </div>
                {categoriaSeleccionada.campos.length > 0 && (
                  <>
                    <p className="text-[11px] uppercase tracking-wide font-bold text-[var(--gray-400)] mb-2">Especificaciones de {categoriaSeleccionada.nombre}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                      {categoriaSeleccionada.campos.map((c) => (
                        <Campo key={c.clave} campo={c} valor={datosNuevos[c.clave] || ""} onChange={(v) => setDatosNuevos((p) => ({ ...p, [c.clave]: v }))} />
                      ))}
                    </div>
                  </>
                )}
                <label className="block mb-5">
                  <span className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Notas</span>
                  <textarea value={datosNuevos.notas || ""} onChange={(e) => setDatosNuevos((p) => ({ ...p, notas: e.target.value }))} rows={2} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
                </label>
              </>
            )}

            {errorForm && <p className="text-[12.5px] text-[var(--red)] font-semibold mb-3">{errorForm}</p>}

            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={() => setModalAgregar(false)} className="px-4 py-2 rounded-lg text-[13px] font-bold text-[var(--navy)] bg-[var(--gray-100)]">Cancelar</button>
              <button type="button" onClick={guardarEquipo} className="px-5 py-2 rounded-lg text-[13px] font-bold text-white bg-[var(--navy)]">Guardar y generar QR</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: detalle + QR */}
      {equipoSeleccionado && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={() => setEquipoSeleccionado(null)}>
          <div className="bg-white rounded-2xl w-full max-w-[720px] max-h-[92vh] overflow-y-auto p-5 md:p-7" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="flex flex-col items-center shrink-0">
                <div className="border border-[var(--gray-200)] rounded-xl p-2.5">
                  <canvas id="qr-inv-detalle" />
                </div>
                <p className="text-[15px] font-bold text-[var(--navy)] mt-2 mb-3">{equipoSeleccionado.folio}</p>
                <button type="button" onClick={() => imprimirEtiqueta(equipoSeleccionado)} className="flex items-center gap-2 bg-[var(--blue)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                  Imprimir etiqueta
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[var(--blue)] m-0">{obtenerCategoria(equipoSeleccionado.categoria)?.nombre}</p>
                <h3 className="text-[18px] font-bold text-[var(--navy)] m-0 mb-1">{equipoSeleccionado.datos.nombre}</h3>
                <span className="inline-block text-[11px] font-bold rounded-full px-2.5 py-0.5 mb-4" style={{ backgroundColor: COLOR_ESTADO[equipoSeleccionado.estado].bg, color: COLOR_ESTADO[equipoSeleccionado.estado].fg }}>
                  {equipoSeleccionado.estado}
                </span>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 m-0">
                  {[...CAMPOS_GENERALES.filter((c) => c.clave !== "nombre"), ...(obtenerCategoria(equipoSeleccionado.categoria)?.campos || [])].map((c) => (
                    <div key={c.clave}>
                      <dt className="text-[10.5px] uppercase tracking-wide text-[var(--gray-400)]">{c.etiqueta}</dt>
                      <dd className="text-[13px] font-semibold text-[var(--navy)] m-0 break-words">{equipoSeleccionado.datos[c.clave] || "—"}</dd>
                    </div>
                  ))}
                </dl>
                {equipoSeleccionado.datos.notas && <p className="text-[12.5px] text-[var(--text)] mt-3 bg-[var(--gray-100)] rounded-lg p-2.5">{equipoSeleccionado.datos.notas}</p>}
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => setEquipoSeleccionado(null)} className="px-4 py-2 rounded-lg text-[13px] font-bold text-[var(--navy)] bg-[var(--gray-100)]">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
}