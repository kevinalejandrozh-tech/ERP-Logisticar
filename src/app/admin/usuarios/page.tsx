"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useSesion } from "@/lib/useSesion";

type Usuario = { id: number; nombre: string; correo: string; rol: string; created_at: string };

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

export default function GestionUsuariosPage() {
  const sesion = useSesion();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [rol, setRol] = useState<"sysadmin" | "supervisor_tms">("supervisor_tms");
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = () => {
    fetch("/api/auth/usuarios", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setUsuarios(d.usuarios || []))
      .catch(() => {})
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setExito("");
    setGuardando(true);
    try {
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, correo, password, confirmarPassword, rol }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo registrar el usuario.");
      setExito(`Usuario "${nombre}" creado correctamente.`);
      setNombre("");
      setCorreo("");
      setPassword("");
      setConfirmarPassword("");
      setRol("supervisor_tms");
      cargar();
    } catch (err: any) {
      setError(err.message || "No se pudo registrar el usuario.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-6 pb-16">
        <PageHeader
          titulo="Gestión de usuarios"
          subtitulo="Cuentas con acceso al sistema, roles y permisos."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><circle cx="9" cy="7" r="4" /><path d="M1 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" /><circle cx="19" cy="8" r="2.5" /><path d="M22 21v-1.5a3 3 0 00-2-2.83" /></svg>}
        />

        {sesion.rol === "sysadmin" && (
          <div className="bg-white rounded-[18px] p-5 sm:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-6">
            <h3 className="text-[15px] font-bold text-[var(--navy)] mb-4">Registrar nuevo usuario</h3>
            <form onSubmit={registrar} className="flex flex-col gap-3.5 max-w-[420px]">
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Nombre</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Correo</label>
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Rol</label>
                <select value={rol} onChange={(e) => setRol(e.target.value as any)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] bg-white">
                  <option value="sysadmin">Sysadmin (acceso total: ver, editar y consultar todo)</option>
                  <option value="supervisor_tms">Supervisor TMS (solo consulta)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Contraseña</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
                </div>
                <div>
                  <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Confirmar contraseña</label>
                  <input type="password" value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)} required minLength={8} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
                </div>
              </div>
              {error && <p className="text-[12px] text-[var(--red)] font-semibold">{error}</p>}
              {exito && <p className="text-[12px] text-[var(--green)] font-semibold">{exito}</p>}
              <button type="submit" disabled={guardando} className="self-start bg-[var(--navy)] disabled:opacity-60 text-white font-bold text-[12.5px] rounded-lg px-5 py-2.5">
                {guardando ? "Registrando..." : "Registrar usuario"}
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-[18px] p-5 sm:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <h3 className="text-[15px] font-bold text-[var(--navy)] mb-4">Usuarios registrados</h3>
          {cargando ? (
            <p className="text-[13px] text-[var(--gray-400)]">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[440px]">
                <thead>
                  <tr>
                    {["Nombre", "Correo", "Rol"].map((h) => (
                      <th key={h} className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3 first:rounded-l-lg last:rounded-r-lg">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--gray-200)] last:border-0">
                      <td className="px-3.5 py-3 text-[13.5px] font-semibold text-[var(--navy)]">{u.nombre}</td>
                      <td className="px-3.5 py-3 text-[13px] text-[var(--gray-400)]">{u.correo}</td>
                      <td className="px-3.5 py-3">
                        <span className={`text-[10.5px] font-bold uppercase px-2.5 py-1 rounded-full ${u.rol === "sysadmin" ? "bg-[var(--navy)] text-white" : "bg-[var(--blue-light)] text-[var(--blue)]"}`}>
                          {u.rol === "sysadmin" ? "Sysadmin" : "Supervisor TMS"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
