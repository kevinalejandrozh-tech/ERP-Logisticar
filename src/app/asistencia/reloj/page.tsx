"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

type Dispositivo = { ip: string; modelo: string | null; serie: string | null; firmware: string | null; ultimo_error: string | null };
type Fila = {
  id: number;
  nombre: string;
  puesto: string | null;
  estatus: string;
  employee_no: string;
  en_reloj?: boolean;
  nombre_reloj?: string | null;
  rostros?: number;
  huellas?: number;
};
type UsuarioSuelto = { employeeNo: string; name: string; numOfFace?: number; numOfFP?: number };
type Estado = {
  configurado: boolean;
  conectado?: boolean;
  error?: string;
  dispositivo?: Dispositivo;
  personal: Fila[];
  sin_expediente?: UsuarioSuelto[];
  total_reloj?: number;
};
type Resultado = { hechos: number; fallidos: { nombre: string; error: string }[] };

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
type Filtro = "todos" | "pendientes" | "sin_biometrico" | "listos" | "bajas";

function Marca({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] ${ok ? "text-[#0f7a4a]" : "text-[var(--gray-500)]"}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-[var(--green)]" : "bg-[var(--gray-300)]"}`} />
      {texto}
    </span>
  );
}

export default function RelojChecadorPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setEstado(await pedir<Estado>("/api/asistencia/reloj"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const accion = async (cuerpo: Record<string, unknown>, confirmar?: string) => {
    if (confirmar && !window.confirm(confirmar)) return;
    setTrabajando(true);
    setError("");
    setAviso("");
    try {
      const r = await pedir<Resultado>("/api/asistencia/reloj", { method: "POST", body: JSON.stringify(cuerpo) });
      const partes = [`${r.hechos} registro(s) procesado(s).`];
      if (r.fallidos.length) partes.push(`Con error: ${r.fallidos.map((f) => `${f.nombre} (${f.error})`).join("; ")}`);
      setAviso(partes.join(" "));
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error.");
    } finally {
      setTrabajando(false);
    }
  };

  const personal = useMemo(() => estado?.personal || [], [estado]);
  const conteo = useMemo(() => {
    const activos = personal.filter((p) => p.estatus !== "Baja");
    return {
      activos: activos.length,
      enReloj: activos.filter((p) => p.en_reloj).length,
      pendientes: activos.filter((p) => !p.en_reloj).length,
      sinBiometrico: activos.filter((p) => p.en_reloj && !p.rostros && !p.huellas).length,
      bajas: personal.filter((p) => p.estatus === "Baja" && p.en_reloj).length,
    };
  }, [personal]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return personal.filter((p) => {
      if (q && !p.nombre.toLowerCase().includes(q) && p.employee_no !== q) return false;
      if (filtro === "pendientes") return p.estatus !== "Baja" && !p.en_reloj;
      if (filtro === "sin_biometrico") return p.estatus !== "Baja" && p.en_reloj && !p.rostros && !p.huellas;
      if (filtro === "listos") return p.en_reloj && (p.rostros || p.huellas);
      if (filtro === "bajas") return p.estatus === "Baja";
      return true;
    });
  }, [personal, busqueda, filtro]);

  const conectado = !!estado?.configurado && !!estado?.conectado;
  const disp = estado?.dispositivo;

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
        <PageHeader titulo="Reloj checador" subtitulo="Alta del personal en el reloj biométrico (rostro, huella y tarjeta)." backHref="/asistencia" backLabel="Asistencia" />

        {/* Estado del dispositivo */}
        <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-4 p-4 flex flex-wrap items-center gap-x-8 gap-y-2">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${cargando ? "bg-[var(--gray-300)]" : conectado ? "bg-[var(--green)]" : "bg-[var(--red)]"}`} />
            <span className="text-[13.5px] font-medium text-[var(--navy)]">
              {cargando ? "Consultando reloj…" : !estado?.configurado ? "Reloj no configurado en el servidor" : conectado ? "Reloj en línea" : "Reloj sin conexión"}
            </span>
          </div>
          {disp && (
            <div className="text-[12.5px] text-[var(--gray-500)] flex flex-wrap gap-x-6 gap-y-1">
              <span>IP {disp.ip}</span>
              {disp.modelo && <span>{disp.modelo}</span>}
              {disp.firmware && <span>Firmware {disp.firmware}</span>}
              {conectado && <span>{estado?.total_reloj ?? 0} usuario(s) en el reloj</span>}
            </div>
          )}
          <button type="button" className="btn btn-secundario ml-auto" onClick={cargar} disabled={cargando || trabajando}>Actualizar</button>
          {estado?.error && <p className="w-full m-0 text-[12.5px] text-[var(--red)]">{estado.error}</p>}
          {estado && !estado.configurado && (
            <p className="w-full m-0 text-[12.5px] text-[var(--gray-500)]">Agrega BIOMETRICO_IP y BIOMETRICO_PASSWORD al archivo .env del servidor y reinicia la aplicación.</p>
          )}
        </div>

        {/* Indicadores */}
        {conectado && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { t: "Personal activo", v: conteo.activos, f: "todos" as Filtro },
              { t: "Pendientes de alta", v: conteo.pendientes, f: "pendientes" as Filtro, alerta: conteo.pendientes > 0 },
              { t: "Sin rostro ni huella", v: conteo.sinBiometrico, f: "sin_biometrico" as Filtro, alerta: conteo.sinBiometrico > 0 },
              { t: "Bajas aún en el reloj", v: conteo.bajas, f: "bajas" as Filtro, alerta: conteo.bajas > 0 },
            ].map((k) => (
              <button
                key={k.t}
                type="button"
                onClick={() => setFiltro(filtro === k.f ? "todos" : k.f)}
                className={`text-left bg-white border rounded-lg p-3.5 ${filtro === k.f ? "border-[var(--navy)]" : "border-[var(--gray-200)]"}`}
              >
                <p className="m-0 text-[11.5px] uppercase tracking-wide text-[var(--gray-500)]">{k.t}</p>
                <p className={`m-0 mt-1 text-[22px] font-semibold ${k.alerta ? "text-[#b42318]" : "text-[var(--navy)]"}`}>{k.v}</p>
              </button>
            ))}
          </div>
        )}

        {/* Acciones */}
        {conectado && (
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            <button
              type="button"
              className="btn btn-primario"
              disabled={trabajando || !conteo.pendientes}
              onClick={() => accion({ accion: "alta_pendientes" }, `Se darán de alta ${conteo.pendientes} persona(s) en el reloj. ¿Continuar?`)}
            >
              Dar de alta pendientes ({conteo.pendientes})
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              disabled={trabajando || !conteo.bajas}
              onClick={() => accion({ accion: "quitar_bajas" }, `Se eliminarán del reloj ${conteo.bajas} persona(s) dadas de baja, con su rostro y huellas. ¿Continuar?`)}
            >
              Quitar bajas del reloj ({conteo.bajas})
            </button>
            {trabajando && <span className="text-[12.5px] text-[var(--gray-500)]">Trabajando con el reloj…</span>}
          </div>
        )}

        {aviso && <p className="mb-3 text-[13px] text-[#0f7a4a]">{aviso}</p>}
        {error && <p className="mb-3 text-[13px] text-[var(--red)]">{error}</p>}

        {/* Personal */}
        <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-4">
          <div className="p-3 border-b border-[var(--gray-200)] flex flex-wrap gap-2.5 items-center">
            <input type="search" placeholder="Buscar por nombre o número" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${inputCls} max-w-[300px]`} />
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className={`${inputCls} max-w-[220px]`}>
              <option value="todos">Todos</option>
              <option value="pendientes">Pendientes de alta</option>
              <option value="sin_biometrico">Sin rostro ni huella</option>
              <option value="listos">Listos para checar</option>
              <option value="bajas">Bajas</option>
            </select>
          </div>
          {cargando ? (
            <p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[860px]">
                <thead>
                  <tr className="text-left text-[11.5px] text-[var(--gray-500)] uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">No. reloj</th>
                    <th className="px-3 py-3 font-medium">Nombre</th>
                    <th className="px-3 py-3 font-medium">En reloj</th>
                    <th className="px-3 py-3 font-medium">Rostro</th>
                    <th className="px-3 py-3 font-medium">Huella</th>
                    <th className="px-3 py-3 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((p) => {
                    const nombreDistinto = p.en_reloj && p.nombre_reloj && p.nombre_reloj.trim().toLowerCase() !== p.nombre.slice(0, 64).trim().toLowerCase();
                    return (
                      <tr key={p.id} className="border-t border-[var(--gray-200)] hover:bg-[var(--gray-50)]">
                        <td className="px-4 py-2.5 font-mono text-[12.5px]">{p.employee_no}</td>
                        <td className="px-3 py-2.5">
                          <Link href={`/personas/expedientes/detalle?id=${p.id}`} className="font-medium text-[var(--navy)] hover:underline">{p.nombre}</Link>
                          <p className="m-0 text-[11.5px] text-[var(--gray-500)]">
                            {p.puesto || "—"}
                            {p.estatus === "Baja" && <span className="text-[#b42318]"> · Baja</span>}
                            {nombreDistinto && <span className="text-[#8a5a00]"> · En el reloj aparece como “{p.nombre_reloj}”</span>}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">{conectado ? <Marca ok={!!p.en_reloj} texto={p.en_reloj ? "Registrado" : "Pendiente"} /> : "—"}</td>
                        <td className="px-3 py-2.5">{p.en_reloj ? <Marca ok={!!p.rostros} texto={p.rostros ? "Sí" : "No"} /> : "—"}</td>
                        <td className="px-3 py-2.5">{p.en_reloj ? <Marca ok={!!p.huellas} texto={p.huellas ? `${p.huellas}` : "No"} /> : "—"}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {conectado && p.estatus !== "Baja" && (!p.en_reloj || nombreDistinto) && (
                            <button type="button" className="btn btn-secundario py-1 px-2.5 text-[12.5px]" disabled={trabajando} onClick={() => accion({ accion: "alta", ids: [p.id] })}>
                              {p.en_reloj ? "Actualizar nombre" : "Dar de alta"}
                            </button>
                          )}
                          {conectado && p.en_reloj && (
                            <button
                              type="button"
                              className="btn btn-secundario py-1 px-2.5 text-[12.5px] ml-2"
                              disabled={trabajando}
                              onClick={() => accion({ accion: "quitar", employee_nos: [p.employee_no] }, `¿Quitar a ${p.nombre} del reloj? Se borran su rostro y huellas.`)}
                            >
                              Quitar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!visibles.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-[var(--gray-500)]">Sin resultados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Usuarios del reloj que no corresponden a ningún expediente */}
        {conectado && !!estado?.sin_expediente?.length && (
          <div className="bg-white border border-[#f3d79a] rounded-lg mb-4 p-4">
            <p className="m-0 mb-2 text-[13px] font-medium text-[#8a5a00]">Usuarios en el reloj sin expediente en el ERP</p>
            <ul className="m-0 p-0 list-none grid gap-1.5">
              {estado.sin_expediente.map((u) => (
                <li key={u.employeeNo} className="flex items-center justify-between gap-3 text-[13px]">
                  <span>
                    <span className="font-mono text-[12.5px]">{u.employeeNo}</span> · {u.name || "Sin nombre"}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secundario py-1 px-2.5 text-[12.5px]"
                    disabled={trabajando}
                    onClick={() => accion({ accion: "quitar", employee_nos: [u.employeeNo] }, `¿Quitar al usuario ${u.employeeNo} del reloj?`)}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cómo registrar rostro y huella */}
        <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-8 p-4 text-[12.5px] text-[var(--gray-500)] grid gap-1">
          <p className="m-0"><b className="text-[var(--navy)] font-medium">Registrar rostro y huella:</b> con la persona presente, entra a la página del reloj ({disp?.ip ? `http://${disp.ip}` : "IP del reloj"}) → Person Management → edita a la persona → agrega rostro y huella.</p>
          <p className="m-0"><b className="text-[var(--navy)] font-medium">No. reloj:</b> es el número del expediente en el ERP; así cada checada se asigna automáticamente a la persona correcta.</p>
          <p className="m-0"><b className="text-[var(--navy)] font-medium">Bajas:</b> al dar de baja a alguien en el ERP, quítalo del reloj con el botón “Quitar bajas del reloj”.</p>
        </div>
      </div>
    </div>
  );
}
