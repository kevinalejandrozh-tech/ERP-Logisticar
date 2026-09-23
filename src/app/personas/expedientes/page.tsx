"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";
import ExpedienteFormModal from "@/components/ExpedienteFormModal";
import CuadroBasicoModal from "@/components/CuadroBasicoModal";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type ExpedienteResumen = {
  id: number;
  nombre: string;
  puesto: string | null;
  categoria: string | null;
  cuenta: string | null;
  rfc: string | null;
  curp: string | null;
  tipo_personal: string | null;
  area: string | null;
  estatus_laboral: string | null;
  motivo_baja: string | null;
  fotografia: string | null;
};
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

export default function ExpedientesPage() {
  const router = useRouter();
  const [registros, setRegistros] = useState<ExpedienteResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [qrExpediente, setQrExpediente] = useState<ExpedienteResumen | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroAbierto, setFiltroAbierto] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "administrativo" | "operador">("todos");
  const [filtroCuenta, setFiltroCuenta] = useState<"todas" | "TMS" | "KN">("todas");
  const [filtroEstatus, setFiltroEstatus] = useState<"todos" | "activo" | "baja">("todos");
  const [agruparPor, setAgruparPor] = useState<"ninguno" | "puesto" | "area" | "categoria">("area");
  const [bajaExpediente, setBajaExpediente] = useState<ExpedienteResumen | null>(null);
  const [motivoBaja, setMotivoBaja] = useState("");
  const [guardandoBaja, setGuardandoBaja] = useState(false);
  const [cuadroBasicoAbierto, setCuadroBasicoAbierto] = useState(false);
  const [totalCuadroBasico, setTotalCuadroBasico] = useState(0);

  const filtrosActivos = filtroTipo !== "todos" || filtroCuenta !== "todas" || filtroEstatus !== "todos";
  const registrosFiltrados = registros.filter((r) => {
    const esBaja = (r.estatus_laboral || "Activo") === "Baja";
    if (filtroEstatus === "activo" && esBaja) return false;
    if (filtroEstatus === "baja" && !esBaja) return false;
    if (filtroEstatus === "todos" && esBaja && !busqueda.trim()) return false; // ocultas por defecto salvo búsqueda explícita
    if (filtroTipo !== "todos" && (r.tipo_personal || "operador") !== filtroTipo) return false;
    if (filtroCuenta !== "todas" && r.cuenta !== filtroCuenta) return false;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      const coincide = [r.nombre, r.puesto, r.rfc, r.curp].some((v) => v && v.toLowerCase().includes(q));
      if (!coincide) return false;
    }
    return true;
  });

  const totalActivos = registros.filter((r) => (r.estatus_laboral || "Activo") !== "Baja").length;

  const etiquetaCategoria = (r: ExpedienteResumen) => (r.tipo_personal === "administrativo" ? "Administrativo" : "Operador");
  const grupos: { etiqueta: string; items: ExpedienteResumen[] }[] = (() => {
    if (agruparPor === "ninguno") return [{ etiqueta: "", items: registrosFiltrados }];
    const obtenerClave = agruparPor === "puesto" ? (r: ExpedienteResumen) => r.puesto : agruparPor === "area" ? (r: ExpedienteResumen) => r.area : etiquetaCategoria;
    const mapa = new Map<string, ExpedienteResumen[]>();
    registrosFiltrados.forEach((r) => {
      const clave = obtenerClave(r)?.trim() || "Sin asignar";
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(r);
    });
    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([etiqueta, items]) => ({ etiqueta, items }));
  })();
  const porcentajeCumplimiento = totalCuadroBasico > 0 ? Math.round((totalActivos / totalCuadroBasico) * 100) : 0;

  const cargar = async () => {
    try {
      const res = await fetch("/api/expedientes/list?incluirBaja=true", { cache: "no-store" });
      const data = await res.json();
      setRegistros(data.registros || []);
    } catch {
      // se reintenta al volver a la pestaña
    } finally {
      setCargando(false);
    }
  };
  const cargarCuadroBasico = () => {
    fetch("/api/cuadro-basico", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTotalCuadroBasico((d.filas || []).length))
      .catch(() => {});
  };
  useEffect(() => {
    cargar();
    cargarCuadroBasico();
  }, []);
  useRefrescarAlEnfocar(cargar);

  useEffect(() => {
    if (!qrExpediente) return;
    cargarQRiousLib()
      .then(() => {
        const canvas = document.getElementById("qr-expediente-modal") as HTMLCanvasElement | null;
        if (canvas) {
          new window.QRious({ element: canvas, value: `${window.location.origin}/personas/expedientes/detalle?id=${qrExpediente.id}`, size: 190, level: "M" });
        }
      })
      .catch(() => {});
  }, [qrExpediente]);

  const confirmarBaja = async () => {
    if (!bajaExpediente || !motivoBaja.trim()) return;
    setGuardandoBaja(true);
    try {
      const res = await fetch("/api/expedientes/baja", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bajaExpediente.id, motivo_baja: motivoBaja.trim() }) });
      if (!res.ok) throw new Error();
      setRegistros((prev) => prev.map((r) => (r.id === bajaExpediente.id ? { ...r, estatus_laboral: "Baja", motivo_baja: motivoBaja.trim() } : r)));
      setBajaExpediente(null);
      setMotivoBaja("");
    } catch {
      alert("No se pudo dar de baja.");
    } finally {
      setGuardandoBaja(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Expedientes"
          subtitulo="Consulta y administra los expedientes del personal."
          backHref="/personas"
          backLabel="Personas"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
        />

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="bg-white border border-[var(--gray-200)] rounded-xl px-4 py-2.5 flex items-center gap-4">
            <div className="text-center">
              <p className="text-[17px] font-bold text-[var(--navy)] m-0 leading-none">{totalActivos}</p>
              <p className="text-[9px] text-[var(--gray-400)] uppercase tracking-wide m-0 mt-0.5">Laborando</p>
            </div>
            <div className="w-px h-8 bg-[var(--gray-200)]" />
            <div className="text-center">
              <p className={`text-[17px] font-bold m-0 leading-none ${porcentajeCumplimiento >= 90 ? "text-[var(--green)]" : porcentajeCumplimiento >= 70 ? "text-[var(--amber)]" : "text-[var(--red)]"}`}>{porcentajeCumplimiento}%</p>
              <p className="text-[9px] text-[var(--gray-400)] uppercase tracking-wide m-0 mt-0.5">Cumpl. cuadro básico</p>
            </div>
          </div>
          <button type="button" onClick={() => setCuadroBasicoAbierto(true)} className="text-[12px] font-bold text-[var(--blue)] underline decoration-dotted">
            Cuadro Básico
          </button>
        </div>

        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            <button type="button" onClick={() => setModalAbierto(true)} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Agregar / editar registro
            </button>
            <Link href="/personas/expedientes/asistencia" className="flex items-center gap-2 bg-[var(--green)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold no-underline">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 15l2 2 4-4" /></svg>
              Asistencia diaria
            </Link>
            <div className="relative flex-1 min-w-[200px]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2.2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, puesto, RFC o CURP..."
                className="w-full border border-[var(--gray-200)] rounded-lg pl-9 pr-3 py-2.5 text-[13px]"
              />
            </div>
            <select
              value={agruparPor}
              onChange={(e) => setAgruparPor(e.target.value as any)}
              className={`border rounded-lg px-3.5 py-2.5 text-[13px] font-bold bg-white ${agruparPor !== "ninguno" ? "border-[var(--blue)] text-[var(--blue)]" : "border-[var(--gray-200)] text-[var(--navy)]"}`}
            >
              <option value="ninguno">Sin agrupar</option>
              <option value="puesto">Agrupar por Puesto</option>
              <option value="area">Agrupar por Área</option>
              <option value="categoria">Agrupar por Categoría</option>
            </select>
            <div className="relative">
              <button
                type="button"
                onClick={() => setFiltroAbierto((v) => !v)}
                className={`flex items-center gap-2 border rounded-lg px-4 py-2.5 text-[13px] font-bold ${filtrosActivos ? "border-[var(--blue)] text-[var(--blue)] bg-[var(--blue-light)]" : "border-[var(--gray-200)] text-[var(--navy)] bg-white"}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                Filtrar
                {filtrosActivos && <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)]" />}
              </button>
              {filtroAbierto && (
                <>
                  <div onClick={() => setFiltroAbierto(false)} className="fixed inset-0 z-40" />
                  <div className="absolute right-0 top-11 bg-white border border-[var(--gray-200)] rounded-xl shadow-lg w-[220px] z-50 p-4 flex flex-col gap-3.5">
                    <div>
                      <label className="block text-[10.5px] font-bold text-[var(--navy)] uppercase tracking-wide mb-1.5">Estatus</label>
                      <select value={filtroEstatus} onChange={(e) => setFiltroEstatus(e.target.value as any)} className="w-full border border-[var(--gray-200)] rounded-lg px-2.5 py-2 text-[12.5px] bg-white">
                        <option value="todos">Todos</option>
                        <option value="activo">Activo</option>
                        <option value="baja">Baja</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-[var(--navy)] uppercase tracking-wide mb-1.5">Tipo de personal</label>
                      <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as any)} className="w-full border border-[var(--gray-200)] rounded-lg px-2.5 py-2 text-[12.5px] bg-white">
                        <option value="todos">Todos</option>
                        <option value="administrativo">Administrativo</option>
                        <option value="operador">Operador</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-[var(--navy)] uppercase tracking-wide mb-1.5">Cuenta</label>
                      <select value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value as any)} className="w-full border border-[var(--gray-200)] rounded-lg px-2.5 py-2 text-[12.5px] bg-white">
                        <option value="todas">Todas</option>
                        <option value="TMS">TMS</option>
                        <option value="KN">KN</option>
                      </select>
                    </div>
                    {filtrosActivos && (
                      <button
                        type="button"
                        onClick={() => {
                          setFiltroTipo("todos");
                          setFiltroCuenta("todas");
                          setFiltroEstatus("todos");
                        }}
                        className="text-[11.5px] font-bold text-[var(--red)] text-left"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Cargando...</p>}

          {!cargando && registros.length === 0 && (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Aún no hay expedientes. Usa &quot;Agregar / editar registro&quot; para crear el primero.</p>
          )}

          {!cargando && registros.length > 0 && registrosFiltrados.length === 0 && (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Ningún expediente coincide con la búsqueda o el filtro.</p>
          )}

          {!cargando && registrosFiltrados.length > 0 && (
            <div className="flex flex-col gap-6">
              {grupos.map((grupo) => (
                <div key={grupo.etiqueta || "todos"}>
                  {agruparPor !== "ninguno" && (
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-[13px] font-bold text-[var(--navy)] uppercase tracking-wide m-0">{grupo.etiqueta}</h3>
                      <span className="text-[11px] font-bold text-[var(--gray-400)] bg-[var(--gray-100)] rounded-full px-2 py-0.5">{grupo.items.length}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                    {grupo.items.map((r) => {
                      const esBaja = (r.estatus_laboral || "Activo") === "Baja";
                      return (
                        <div key={r.id} className={`relative bg-white border rounded-2xl p-3.5 hover:border-[var(--blue)] transition-colors ${esBaja ? "border-[var(--red)]/30 opacity-70" : "border-[var(--gray-200)]"}`}>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => router.push(`/personas/expedientes/detalle?id=${r.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                              {r.fotografia ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.fotografia} alt={r.nombre} className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[var(--gray-200)]" />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-[var(--blue-light)] flex items-center justify-center shrink-0">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-[12.5px] font-bold text-[var(--navy)] m-0 leading-tight truncate">{r.nombre}</p>
                                {r.puesto && <p className="text-[11px] font-semibold text-[var(--blue)] m-0 truncate">{r.puesto}</p>}
                                {esBaja && <span className="inline-block mt-0.5 text-[8.5px] font-bold uppercase tracking-wide text-white bg-[var(--red)] rounded-full px-1.5 py-0.5">Baja</span>}
                              </div>
                            </button>
                            <div className="flex flex-col items-center gap-1.5 shrink-0">
                              <span
                                onClick={() => setQrExpediente(r)}
                                title="Ver código QR"
                                className="w-7 h-7 rounded-lg bg-[var(--gray-100)] flex items-center justify-center cursor-pointer"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
                                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                                  <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
                                </svg>
                              </span>
                              {!esBaja && (
                                <span
                                  onClick={() => {
                                    setBajaExpediente(r);
                                    setMotivoBaja("");
                                  }}
                                  title="Dar de baja"
                                  className="w-7 h-7 rounded-lg bg-[var(--gray-100)] hover:bg-[rgba(226,65,44,0.12)] flex items-center justify-center cursor-pointer"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e2412c" strokeWidth="2.4"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalAbierto && (
        <ExpedienteFormModal
          onCancelar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      )}

      {qrExpediente && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-50" onClick={() => setQrExpediente(null)}>
          <div className="bg-white rounded-2xl p-6 text-center shadow-[0_1px_3px_rgba(22,33,92,0.06)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-[13.5px] font-bold text-[var(--navy)] mb-1">{qrExpediente.nombre}</p>
            <p className="text-[11.5px] text-[var(--gray-400)] mb-4">Escanea para consultar el expediente</p>
            <div className="w-[210px] h-[210px] rounded-xl bg-white border border-[var(--gray-200)] flex items-center justify-center mx-auto mb-4 p-2.5">
              <canvas id="qr-expediente-modal" />
            </div>
            <button type="button" onClick={() => setQrExpediente(null)} className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {bajaExpediente && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-50" onClick={() => setBajaExpediente(null)}>
          <div className="bg-white rounded-2xl p-6 w-[400px] max-w-full shadow-[0_1px_3px_rgba(22,33,92,0.06)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-[var(--navy)] mb-1">Dar de baja</h3>
            <p className="text-[12.5px] text-[var(--gray-400)] mb-4">{bajaExpediente.nombre}</p>
            <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1.5">Motivo de baja</label>
            <textarea
              value={motivoBaja}
              onChange={(e) => setMotivoBaja(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Escribe el motivo..."
              className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13px] mb-4 resize-none"
            />
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setBajaExpediente(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={confirmarBaja} disabled={!motivoBaja.trim() || guardandoBaja} className="bg-[var(--red)] disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoBaja ? "Guardando..." : "Dar de baja"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cuadroBasicoAbierto && (
        <CuadroBasicoModal
          onCerrar={() => {
            setCuadroBasicoAbierto(false);
            cargarCuadroBasico();
          }}
        />
      )}
    </div>
  );
}
