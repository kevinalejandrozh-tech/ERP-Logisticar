"use client";
import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";

// Página PÚBLICA (se abre con el código QR). La persona elige su nombre y se registra la hora.
// Primer escaneo del día = entrada; siguiente = salida. La hora la pone el servidor.

type Persona = { id: number; nombre: string };
type Resultado = { accion: "entrada" | "salida" | "duplicado"; nombre: string; hora: string; retardo?: boolean };

const CLAVE_LOCAL = "asistencia_ultimo_nombre";

function leerGuardado(): Persona | null {
  try {
    const v = localStorage.getItem(CLAVE_LOCAL);
    return v ? (JSON.parse(v) as Persona) : null;
  } catch {
    return null;
  }
}

function sinAcentos(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function RegistroAsistenciaPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Persona | null>(null);
  const [recordado, setRecordado] = useState<Persona | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [reloj, setReloj] = useState("");

  useEffect(() => {
    const actualizar = () => setReloj(new Date().toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" }));
    const t = setInterval(actualizar, 15000);
    fetch("/api/asistencia/registro", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        const lista: Persona[] = d.personas || [];
        setPersonas(lista);
        const g = leerGuardado();
        setRecordado(g && lista.some((p) => p.id === g.id) ? g : null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar la lista."))
      .finally(() => {
        setCargando(false);
        actualizar();
      });
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!resultado) return;
    const t = setTimeout(() => {
      setResultado(null);
      setSeleccion(null);
      setBusqueda("");
    }, 6000);
    return () => clearTimeout(t);
  }, [resultado]);

  const filtradas = useMemo(() => {
    const q = sinAcentos(busqueda.trim());
    return q ? personas.filter((p) => sinAcentos(p.nombre).includes(q)) : personas;
  }, [personas, busqueda]);

  const registrar = async (p: Persona) => {
    setEnviando(true);
    try {
      const res = await fetch("/api/asistencia/registro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expediente_id: p.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo registrar.");
      try {
        localStorage.setItem(CLAVE_LOCAL, JSON.stringify(p));
      } catch {
        // sin almacenamiento local: no pasa nada
      }
      setRecordado(p);
      setResultado(d as Resultado);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo registrar.");
    } finally {
      setEnviando(false);
    }
  };

  const tarjeta = "bg-white border border-[var(--gray-200)] rounded-lg shadow-[0_4px_20px_rgba(22,33,92,0.06)]";

  return (
    <div className="min-h-screen bg-[var(--gray-50)] px-4 py-8">
      <div className="max-w-[440px] mx-auto">
        <div className="flex flex-col items-center mb-5">
          <Logo size={48} enlace={false} />
          <p className="font-medium text-[var(--red)] text-[12px] tracking-[0.12em] mt-3 mb-0">TRANSPORTES LOGISTICAR</p>
          <h1 className="font-medium text-[var(--navy)] text-[21px] mt-1 mb-0">Registro de asistencia</h1>
          {reloj && <p className="text-[13px] text-[var(--gray-500)] mt-1 mb-0">Hora actual: {reloj}</p>}
        </div>

        {resultado ? (
          <div className={`${tarjeta} p-7 text-center`}>
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${resultado.accion === "duplicado" ? "bg-[#fff4dc]" : "bg-[#e7f6ee]"}`}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={resultado.accion === "duplicado" ? "#8a5a00" : "#21a866"} strokeWidth="2.5" strokeLinecap="round"><path d="M5 12l5 5L20 7" /></svg>
            </div>
            <p className="text-[13px] text-[var(--gray-500)] m-0">{resultado.nombre}</p>
            <h2 className="text-[20px] font-medium text-[var(--navy)] mt-1 mb-1">
              {resultado.accion === "entrada" ? "Entrada registrada" : resultado.accion === "salida" ? "Salida registrada" : "Ya estabas registrado"}
            </h2>
            <p className="text-[30px] font-bold text-[var(--navy)] m-0">{resultado.hora}</p>
            {resultado.accion === "entrada" && resultado.retardo && <p className="text-[13px] text-[#8a5a00] mt-2 mb-0">Registrado con retardo.</p>}
            {resultado.accion === "duplicado" && <p className="text-[12.5px] text-[var(--gray-500)] mt-2 mb-0">Espera unos minutos para registrar tu salida.</p>}
            <button type="button" className="btn btn-secundario mt-5" onClick={() => { setResultado(null); setSeleccion(null); }}>Listo</button>
          </div>
        ) : seleccion ? (
          <div className={`${tarjeta} p-6 text-center`}>
            <p className="text-[13px] text-[var(--gray-500)] m-0">Confirma que eres:</p>
            <h2 className="text-[19px] font-medium text-[var(--navy)] mt-1 mb-5">{seleccion.nombre}</h2>
            <button type="button" className="btn btn-primario w-full py-3 text-[15px]" disabled={enviando} onClick={() => registrar(seleccion)}>
              {enviando ? "Registrando…" : "Registrar asistencia"}
            </button>
            <button type="button" className="btn-enlace text-[13px] mt-4" onClick={() => setSeleccion(null)}>No soy yo, volver</button>
          </div>
        ) : (
          <div className={`${tarjeta} p-4`}>
            {recordado && (
              <button type="button" onClick={() => setSeleccion(recordado)} className="w-full text-left rounded-md bg-[#eef3fd] border border-[#c9d8fa] px-4 py-3 mb-3">
                <span className="block text-[11.5px] text-[var(--gray-500)]">¿Eres tú?</span>
                <span className="block text-[15px] font-medium text-[var(--navy)]">{recordado.nombre}</span>
              </button>
            )}
            <label className="block text-[12.5px] font-medium text-[var(--text)] mb-1.5">Busca y selecciona tu nombre</label>
            <input type="search" autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Escribe tu nombre" className="w-full border border-[var(--gray-300)] rounded-md px-3 py-3 text-[15px]" />
            {error && <p className="text-[13px] text-[var(--red)] mt-3">{error}</p>}
            {cargando ? (
              <p className="text-[13px] text-[var(--gray-500)] mt-4">Cargando…</p>
            ) : (
              <ul className="mt-3 max-h-[52vh] overflow-y-auto divide-y divide-[var(--gray-200)] border border-[var(--gray-200)] rounded-md list-none p-0 m-0">
                {filtradas.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setSeleccion(p)} className="w-full text-left px-4 py-3 text-[14.5px] text-[var(--navy)] hover:bg-[var(--gray-50)]">{p.nombre}</button>
                  </li>
                ))}
                {filtradas.length === 0 && <li className="px-4 py-4 text-[13px] text-[var(--gray-500)]">No se encontró ese nombre.</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
