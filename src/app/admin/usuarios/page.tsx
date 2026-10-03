"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useSesion } from "@/lib/useSesion";

type Usuario = { id: number; nombre: string; correo: string | null; usuario: string | null; rol: string; expediente_id: number | null; created_at: string };
type RolInfo = { rol: string; etiqueta: string; descripcion: string; usuarios: number; secciones: string[] | null; editable: boolean };
type SeccionInfo = { clave: string; titulo: string; descripcion: string };
type EdicionUsuario = { id: number; nombre: string; usuario: string; correo: string; rol: string };

const ETIQUETA_ROL: Record<string, string> = { sysadmin: "Sysadmin", supervisor_tms: "Supervisor TMS", personal: "Personal" };

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

export default function GestionUsuariosPage() {
  const sesion = useSesion();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [rol, setRol] = useState<"sysadmin" | "supervisor_tms" | "personal">("supervisor_tms");
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [usuarioPassword, setUsuarioPassword] = useState<Usuario | null>(null);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [exitoPassword, setExitoPassword] = useState("");
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [miId, setMiId] = useState<number | null>(null);
  const [edicion, setEdicion] = useState<EdicionUsuario | null>(null);
  const [errorEdicion, setErrorEdicion] = useState("");
  const [roles, setRoles] = useState<RolInfo[]>([]);
  const [catalogo, setCatalogo] = useState<SeccionInfo[]>([]);
  const [borradorRoles, setBorradorRoles] = useState<Record<string, string[] | null>>({});
  const [mensajeRol, setMensajeRol] = useState<Record<string, string>>({});

  const cargar = () => {
    fetch("/api/auth/usuarios", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setUsuarios(d.usuarios || []);
        setMiId(d.miId ?? null);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
    fetch("/api/auth/roles", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setRoles(d.roles || []);
        setCatalogo(d.secciones || []);
        setBorradorRoles(Object.fromEntries((d.roles || []).map((r: RolInfo) => [r.rol, r.secciones])));
      })
      .catch(() => {});
  };
  useEffect(cargar, []);

  const guardarEdicion = async () => {
    if (!edicion) return;
    setErrorEdicion("");
    try {
      const res = await fetch("/api/auth/usuarios", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edicion) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setEdicion(null);
      cargar();
    } catch (err: any) {
      setErrorEdicion(err.message || "No se pudo guardar.");
    }
  };

  const alternarSeccion = (rolClave: string, clave: string) => {
    setBorradorRoles((prev) => {
      const actual = prev[rolClave] ?? catalogo.map((c) => c.clave);
      const nueva = actual.includes(clave) ? actual.filter((c) => c !== clave) : [...actual, clave];
      return { ...prev, [rolClave]: nueva };
    });
  };

  const guardarRol = async (rolClave: string) => {
    const secciones = borradorRoles[rolClave];
    const todas = secciones === null || (secciones && secciones.length === catalogo.length);
    try {
      const res = await fetch("/api/auth/roles", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rol: rolClave, secciones: todas ? null : secciones }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setMensajeRol((m) => ({ ...m, [rolClave]: "Guardado. Aplica cuando cada usuario vuelva a iniciar sesión." }));
      cargar();
    } catch (err: any) {
      setMensajeRol((m) => ({ ...m, [rolClave]: err.message || "No se pudo guardar." }));
    }
  };

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

  const abrirCambioPassword = (u: Usuario) => {
    setUsuarioPassword(u);
    setVerPassword(false);
    setNuevaPassword("");
    setErrorPassword("");
    setExitoPassword("");
  };

  const cambiarPassword = async (valor: string) => {
    if (!usuarioPassword) return;
    setErrorPassword("");
    setExitoPassword("");
    setGuardandoPassword(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: usuarioPassword.id, nuevaPassword: valor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cambiar la contraseña.");
      setExitoPassword("Contraseña actualizada.");
      setNuevaPassword("");
    } catch (err: any) {
      setErrorPassword(err.message || "No se pudo cambiar la contraseña.");
    } finally {
      setGuardandoPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10 pb-16">
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
                  <option value="personal">Personal</option>
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
              <table className="w-full border-collapse min-w-[520px]">
                <thead>
                  <tr>
                    {["Nombre", "Usuario / Correo", "Rol", ...(sesion.rol === "sysadmin" ? ["Contraseña", ""] : [])].map((h) => (
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
                      <td className="px-3.5 py-3 text-[13px] text-[var(--gray-400)]">{u.usuario || u.correo}</td>
                      <td className="px-3.5 py-3">
                        <span className={`text-[10.5px] font-bold uppercase px-2.5 py-1 rounded-full ${u.rol === "sysadmin" ? "bg-[var(--navy)] text-white" : u.rol === "personal" ? "bg-[rgba(34,168,90,0.14)] text-[var(--green)]" : "bg-[var(--blue-light)] text-[var(--blue)]"}`}>
                          {ETIQUETA_ROL[u.rol] || u.rol}
                        </span>
                      </td>
                      {sesion.rol === "sysadmin" && (
                        <td className="px-3.5 py-3">
                          <button type="button" onClick={() => abrirCambioPassword(u)} className="text-[12px] font-bold text-[var(--blue)] underline decoration-dotted">
                            Cambiar
                          </button>
                        </td>
                      )}
                      {sesion.rol === "sysadmin" && (
                        <td className="px-3.5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setErrorEdicion("");
                              setEdicion({ id: u.id, nombre: u.nombre, usuario: u.usuario || "", correo: u.correo || "", rol: u.rol });
                            }}
                            className="text-[12px] font-bold text-[var(--navy)] underline decoration-dotted"
                          >
                            Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {sesion.rol === "sysadmin" && roles.length > 0 && (
          <div className="bg-white rounded-[18px] p-5 sm:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mt-6">
            <h3 className="text-[15px] font-bold text-[var(--navy)] mb-1">Roles y permisos</h3>
            <p className="text-[12.5px] text-[var(--gray-400)] mb-4">Marca las secciones que puede ver cada rol. Los cambios aplican cuando el usuario vuelve a iniciar sesión.</p>
            <div className="grid gap-4">
              {roles.map((r) => {
                const sel = borradorRoles[r.rol];
                const marcadas = sel === null || sel === undefined ? catalogo.map((c) => c.clave) : sel;
                return (
                  <div key={r.rol} className="border border-[var(--gray-200)] rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <p className="text-[14px] font-bold text-[var(--navy)] m-0">{r.etiqueta} <span className="text-[12px] font-normal text-[var(--gray-400)]">· {r.usuarios} usuario(s)</span></p>
                        <p className="text-[12px] text-[var(--gray-500)] m-0">{r.descripcion}</p>
                      </div>
                      {r.editable && (
                        <button type="button" onClick={() => guardarRol(r.rol)} className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold">Guardar permisos</button>
                      )}
                    </div>
                    {!r.editable ? (
                      <p className="text-[12.5px] text-[var(--gray-500)] m-0">Acceso total a todas las secciones (no se puede restringir).</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
                        {catalogo.map((c) => (
                          <label key={c.clave} className="flex items-start gap-2 text-[12.5px] text-[var(--text)]" title={c.descripcion}>
                            <input type="checkbox" className="mt-0.5" checked={marcadas.includes(c.clave)} onChange={() => alternarSeccion(r.rol, c.clave)} />
                            <span>{c.titulo}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {mensajeRol[r.rol] && <p className="text-[12px] text-[var(--blue)] font-semibold mt-2 mb-0">{mensajeRol[r.rol]}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {edicion && sesion.rol === "sysadmin" && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-50" onClick={() => setEdicion(null)}>
          <div className="bg-white rounded-2xl p-6 w-[440px] max-w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-[var(--navy)] mb-4">Editar usuario</h3>
            <div className="grid gap-3">
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Nombre</label>
                <input value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Usuario de acceso (opcional)</label>
                <input value={edicion.usuario} onChange={(e) => setEdicion({ ...edicion, usuario: e.target.value })} placeholder="Se guarda en MAYÚSCULAS" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Correo (opcional)</label>
                <input type="email" value={edicion.correo} onChange={(e) => setEdicion({ ...edicion, correo: e.target.value })} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Rol</label>
                <select value={edicion.rol} disabled={edicion.id === miId} onChange={(e) => setEdicion({ ...edicion, rol: e.target.value })} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] bg-white disabled:bg-[var(--gray-100)]">
                  {roles.map((r) => <option key={r.rol} value={r.rol}>{r.etiqueta}</option>)}
                </select>
                {edicion.id === miId && <p className="text-[11px] text-[var(--gray-400)] mt-1 mb-0">No puedes cambiar tu propio rol.</p>}
              </div>
              {errorEdicion && <p className="text-[12px] text-[var(--red)] font-semibold m-0">{errorEdicion}</p>}
              <div className="flex justify-end gap-2.5 pt-1">
                <button type="button" onClick={() => setEdicion(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">Cancelar</button>
                <button type="button" onClick={guardarEdicion} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">Guardar</button>
              </div>
              <p className="text-[11px] text-[var(--gray-400)] m-0">El cambio de rol aplica cuando el usuario vuelva a iniciar sesión.</p>
            </div>
          </div>
        </div>
      )}

      {usuarioPassword && sesion.rol === "sysadmin" && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-50" onClick={() => setUsuarioPassword(null)}>
          <div className="bg-white rounded-2xl p-6 w-[400px] max-w-full shadow-[0_1px_3px_rgba(22,33,92,0.06)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-[var(--navy)] mb-1">Cambiar contraseña</h3>
            <p className="text-[12.5px] text-[var(--gray-400)] mb-4">{usuarioPassword.usuario || usuarioPassword.correo}</p>
            <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1.5">Nueva contraseña</label>
            <input
              type={verPassword ? "text" : "password"}
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder={usuarioPassword.rol === "personal" ? "Mínimo 4 caracteres" : "Mínimo 8 caracteres"}
              className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] mb-1.5"
            />
            <label className="flex items-center gap-2 text-[12px] text-[var(--gray-500)] mb-1.5">
              <input type="checkbox" checked={verPassword} onChange={(e) => setVerPassword(e.target.checked)} /> Mostrar contraseña
            </label>
            <p className="text-[11px] text-[var(--gray-400)] mb-3">Por seguridad las contraseñas se guardan cifradas y no se pueden consultar; aquí puedes asignar una nueva.</p>
            {errorPassword && <p className="text-[12px] text-[var(--red)] font-semibold mb-3">{errorPassword}</p>}
            {exitoPassword && <p className="text-[12px] text-[var(--green)] font-semibold mb-3">{exitoPassword}</p>}
            <div className="flex flex-wrap gap-2.5 justify-between items-center">
              {usuarioPassword.rol === "personal" ? (
                <button type="button" onClick={() => cambiarPassword("1234")} disabled={guardandoPassword} className="text-[12px] font-bold text-[var(--blue)] underline decoration-dotted disabled:opacity-50">
                  Restablecer a 1234
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2.5">
                <button type="button" onClick={() => setUsuarioPassword(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  Cerrar
                </button>
                <button type="button" onClick={() => cambiarPassword(nuevaPassword)} disabled={!nuevaPassword || guardandoPassword} className="bg-[var(--navy)] disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  {guardandoPassword ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
