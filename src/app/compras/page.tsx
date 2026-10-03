"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import FavoritoEstrella from "@/components/FavoritoEstrella";
import AltaProveedorModal from "@/components/compras/AltaProveedorModal";
import DetalleOCModal from "@/components/compras/DetalleOCModal";
import { OrdenCompra, Viatico, esAutorizada, moneda, productosDe } from "@/lib/comprasData";

interface FilaProducto {
  id: string;
  cantidad: string;
  articulo: string;
  precio: string;
  referencia: string;
  proveedor: string;
  compraUnica: boolean; // proveedor de una sola compra: no se da de alta en el catálogo
}

const nuevaFila = (): FilaProducto => ({ id: `${Date.now()}-${Math.random()}`, cantidad: "1", articulo: "", precio: "", referencia: "", proveedor: "", compraUnica: false });
const celdaCls = "w-full border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";

export default function ComprasPage() {
  const [tab, setTab] = useState<"agregar" | "consultar">("agregar");
  const [filas, setFilas] = useState<FilaProducto[]>([nuevaFila()]);
  const [rutaOrden, setRutaOrden] = useState<string[]>([]);
  const [vehiculo, setVehiculo] = useState("");
  const [consumoPromedio, setConsumoPromedio] = useState("");
  const [combustible, setCombustible] = useState("");
  const [tiempoRegreso, setTiempoRegreso] = useState("");
  const [viaticos, setViaticos] = useState<{ concepto: string; monto: string }[]>([]);
  const [justificacion, setJustificacion] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [catalogo, setCatalogo] = useState<string[]>([]);
  const [altaProveedor, setAltaProveedor] = useState<string | null>(null);
  const [ecos, setEcos] = useState<string[]>([]);

  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [cargandoConsultas, setCargandoConsultas] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<OrdenCompra | null>(null);
  const [permisos, setPermisos] = useState<{ puedeAutorizar: boolean; esSysadmin: boolean; roles: { rol: string; etiqueta: string; autoriza: boolean }[] }>({ puedeAutorizar: false, esSysadmin: false, roles: [] });
  const [configRoles, setConfigRoles] = useState(false);

  const cargarCatalogo = useCallback(async () => {
    try {
      const r = await fetch("/api/compras/proveedores", { cache: "no-store" }).then((x) => x.json());
      setCatalogo((r.proveedores || []).map((p: { nombre: string }) => p.nombre));
    } catch {
      /* el catálogo es opcional para capturar */
    }
  }, []);

  const cargarOrdenes = useCallback(async () => {
    setCargandoConsultas(true);
    setErrorConsulta(null);
    try {
      const res = await fetch("/api/compras", { cache: "no-store" });
      if (!res.ok) throw new Error("Ocurrió un error al cargar las órdenes de compra.");
      setOrdenes(await res.json());
    } catch (err) {
      setErrorConsulta(err instanceof Error ? err.message : "Error al obtener la información.");
    } finally {
      setCargandoConsultas(false);
    }
  }, []);

  useEffect(() => {
    cargarCatalogo();
    fetch("/api/compras/autorizadores", { cache: "no-store" }).then((r) => r.json()).then((d) => d.ok && setPermisos(d)).catch(() => {});
    fetch("/api/unidades/list", { cache: "no-store" }).then((r) => r.json()).then((d) => setEcos((d.registros || []).map((u: Record<string, string>) => u.ECO).filter(Boolean))).catch(() => {});
  }, [cargarCatalogo]);

  useEffect(() => {
    if (tab === "consultar") cargarOrdenes();
  }, [tab, cargarOrdenes]);

  // Orden de ruta: proveedores distintos de la captura, respetando el orden que el usuario definió.
  const proveedoresCaptura = useMemo(() => [...new Set(filas.map((f) => f.proveedor.trim()).filter(Boolean))], [filas]);
  useEffect(() => {
    setRutaOrden((prev) => [...prev.filter((p) => proveedoresCaptura.includes(p)), ...proveedoresCaptura.filter((p) => !prev.includes(p))]);
  }, [proveedoresCaptura]);
  const moverRuta = (i: number, d: -1 | 1) =>
    setRutaOrden((prev) => {
      const n = [...prev];
      const j = i + d;
      if (j < 0 || j >= n.length) return prev;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const totalArticulos = filas.reduce((a, f) => a + (Number(f.cantidad) || 0) * (Number(f.precio) || 0), 0);
  const totalViaticos = viaticos.reduce((a, v) => a + (Number(v.monto) || 0), 0);
  const granTotal = totalArticulos + (Number(combustible) || 0) + totalViaticos;

  const actualizar = (id: string, campo: keyof FilaProducto, valor: string | boolean) => setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  const eliminarFila = (id: string) => (filas.length === 1 ? alert("Debe existir al menos un producto en la orden.") : setFilas((prev) => prev.filter((f) => f.id !== id)));

  // Clic en el encabezado: copia el valor de la primera fila a todas las filas de la orden.
  const copiarColumna = (campo: "referencia" | "proveedor") => {
    const valor = filas[0]?.[campo] || "";
    if (!valor.trim()) return alert("La primera fila no tiene valor para copiar.");
    setFilas((prev) => prev.map((f) => ({ ...f, [campo]: valor, ...(campo === "proveedor" ? { compraUnica: filas[0].compraUnica } : {}) })));
  };

  // Si el proveedor no está en el catálogo, se ofrece darlo de alta.
  const revisarProveedor = (valor: string, compraUnica: boolean) => {
    const v = valor.trim();
    if (compraUnica) return;
    if (v && !catalogo.some((c) => c.toLowerCase() === v.toLowerCase())) setAltaProveedor(v);
  };

  const reiniciar = () => {
    setFilas([nuevaFila()]);
    setRutaOrden([]);
    setVehiculo("");
    setConsumoPromedio("");
    setCombustible("");
    setTiempoRegreso("");
    setViaticos([]);
    setJustificacion("");
  };

  const solicitarAutorizacion = async () => {
    setErrorMsg(null);
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      if (!f.articulo.trim()) return setErrorMsg(`Fila ${i + 1}: El nombre del artículo es obligatorio.`);
      if (!(Number(f.cantidad) > 0)) return setErrorMsg(`Fila ${i + 1}: La cantidad debe ser mayor a 0.`);
      if (!(Number(f.precio) > 0)) return setErrorMsg(`Fila ${i + 1}: El precio unitario debe ser mayor a 0.`);
      if (!f.proveedor.trim()) return setErrorMsg(`Fila ${i + 1}: Indica el proveedor.`);
    }
    const hoy = new Date();
    const folio = `OC-${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, "0")}${String(hoy.getDate()).padStart(2, "0")}-${Math.floor(100 + Math.random() * 900)}`;
    const vi: Viatico[] = viaticos.filter((v) => v.concepto.trim() || Number(v.monto)).map((v) => ({ concepto: v.concepto.trim(), monto: Number(v.monto) || 0 }));
    setGuardando(true);
    try {
      const res = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folio,
          fecha: hoy.toISOString(),
          productos: filas.map((f) => ({ cantidad: Number(f.cantidad), articulo: f.articulo.trim(), precioUnitario: Number(f.precio), referencia: f.referencia, proveedor: f.proveedor, compraUnica: f.compraUnica })),
          datos: { rutaProveedores: rutaOrden, vehiculo, consumoPromedio, combustible: Number(combustible) || 0, tiempoRegreso, viaticos: vi, justificacion },
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Error al guardar la orden de compra.");
      }
      alert(`Orden ${folio} enviada a autorización.`);
      reiniciar();
      setTab("consultar");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ocurrió un error al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarRoles = async () => {
    try {
      const res = await fetch("/api/compras/autorizadores", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles: permisos.roles.filter((r) => r.autoriza).map((r) => r.rol) }) });
      if (!res.ok) throw new Error((await res.json()).error || "No se pudo guardar.");
      setConfigRoles(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  };

  const fechaCorta = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" }) : "—");

  return (
    <div className="min-h-screen bg-[#eef1f6] flex flex-col">
      <header className="bg-white border-b border-[var(--gray-200)] shadow-sm sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 py-3.5 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div>
              <div className="flex items-center gap-1">
                <h1 className="font-display text-[16px] sm:text-[18px] font-bold text-[var(--navy)] m-0">Gestión de Compras</h1>
                <FavoritoEstrella titulo="Compras" />
              </div>
              <p className="text-[11px] sm:text-[12px] text-[var(--gray-400)] m-0">Transportes Logisticar</p>
            </div>
          </div>
          <Link href="/" className="text-[12.5px] sm:text-[13px] font-semibold text-[var(--blue)] hover:underline flex items-center gap-1">← Volver al menú</Link>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 md:px-10 pt-4 sm:pt-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-5 sm:mb-6">
          {(
            [
              ["agregar", "Opción 1", "Agregar orden de compra", "Captura productos, referencia y proveedores, y solicita la autorización."],
              ["consultar", "Opción 2", "Historial de órdenes de compra", "Estatus, autorización por artículo e impresión de la OC."],
            ] as const
          ).map(([k, op, t, d]) => (
            <button key={k} onClick={() => setTab(k)} className={`p-4 sm:p-5 rounded-xl border text-left transition-all ${tab === k ? "bg-white border-[var(--blue)] shadow-md ring-2 ring-[var(--blue)]/20" : "bg-white/60 border-[var(--gray-200)] hover:bg-white"}`}>
              <span className="text-[11px] sm:text-[12px] font-bold tracking-wider text-[var(--blue)] uppercase block mb-1">{op}</span>
              <h2 className="text-[15px] sm:text-[16px] font-bold text-[var(--navy)] m-0">{t}</h2>
              <p className="text-[11.5px] sm:text-[12px] text-[var(--gray-400)] mt-2 mb-0">{d}</p>
            </button>
          ))}
        </div>

        {tab === "agregar" && (
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-[var(--gray-200)]">
            <h3 className="text-[15px] sm:text-[16px] font-bold text-[var(--navy)] m-0">Captura de Productos y Proveedores</h3>
            <p className="text-[11.5px] sm:text-[12.5px] text-[var(--gray-400)] m-0 mb-4">
              Clic en el encabezado <b>Referencia</b> o <b>Proveedor</b> para copiar el valor de la primera fila a todas.
            </p>

            <datalist id="catalogo-proveedores">{catalogo.map((c) => <option key={c} value={c} />)}</datalist>
            <div className="overflow-x-auto border border-[var(--gray-200)] rounded-lg">
              <table className="w-full text-left text-[12.5px] border-collapse min-w-[900px]">
                <thead className="bg-[#f8fafc] text-[var(--navy)] font-bold border-b border-[var(--gray-200)]">
                  <tr>
                    <th className="p-2.5 w-[80px]">Cant.</th>
                    <th className="p-2.5 min-w-[200px]">Nombre del Artículo</th>
                    <th className="p-2.5 w-[120px]">Precio Unit. ($)</th>
                    <th className="p-2.5 w-[120px] text-right bg-emerald-50/60 text-emerald-900">Total Prod. ($)</th>
                    <th className="p-2.5 min-w-[140px] cursor-pointer hover:text-[var(--blue)]" title="Copiar la primera fila a todas" onClick={() => copiarColumna("referencia")}>Referencia ⇣</th>
                    <th className="p-2.5 min-w-[180px] bg-blue-50/50 cursor-pointer hover:text-[var(--blue)]" title="Copiar la primera fila a todas" onClick={() => copiarColumna("proveedor")}>Proveedor ⇣</th>
                    <th className="p-2.5 w-[50px] text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id} className="border-b border-[var(--gray-200)]">
                      <td className="p-2"><input type="number" min={1} value={f.cantidad} onChange={(e) => actualizar(f.id, "cantidad", e.target.value)} className={celdaCls} /></td>
                      <td className="p-2"><input value={f.articulo} onChange={(e) => actualizar(f.id, "articulo", e.target.value)} placeholder="Artículo" className={celdaCls} /></td>
                      <td className="p-2"><input type="number" min={0} step="0.01" value={f.precio} onChange={(e) => actualizar(f.id, "precio", e.target.value)} placeholder="0.00" className={celdaCls} /></td>
                      <td className="p-2 text-right font-semibold text-emerald-900">{moneda((Number(f.cantidad) || 0) * (Number(f.precio) || 0))}</td>
                      <td className="p-2"><input value={f.referencia} onChange={(e) => actualizar(f.id, "referencia", e.target.value)} placeholder="Referencia" className={celdaCls} /></td>
                      <td className="p-2">
                        <input list="catalogo-proveedores" value={f.proveedor} onChange={(e) => actualizar(f.id, "proveedor", e.target.value)} onBlur={(e) => revisarProveedor(e.target.value, f.compraUnica)} placeholder="Elige o escribe" className={celdaCls} />
                        <label className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--gray-500)] cursor-pointer" title="No pide dar de alta al proveedor">
                          <input type="checkbox" checked={f.compraUnica} onMouseDown={(e) => e.preventDefault()} onChange={(e) => actualizar(f.id, "compraUnica", e.target.checked)} />
                          Compra única
                        </label>
                      </td>
                      <td className="p-2 text-center"><button type="button" onClick={() => eliminarFila(f.id)} className="text-[var(--red)] text-[15px]" aria-label="Eliminar fila">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => setFilas((p) => [...p, nuevaFila()])} className="mt-3 text-[12.5px] font-bold text-[var(--blue)]">+ Agregar producto</button>

            {rutaOrden.length > 1 && (
              <div className="mt-5 border border-[var(--gray-200)] rounded-lg p-3 max-w-[460px]">
                <p className="text-[12.5px] font-bold text-[var(--navy)] m-0 mb-2">Orden de la ruta de proveedores</p>
                {rutaOrden.map((p, i) => (
                  <div key={p} className="flex items-center gap-2 py-1 text-[12.5px]">
                    <span className="w-5 text-[var(--gray-500)]">{i + 1}.</span>
                    <span className="flex-1">{p}</span>
                    <button type="button" className="btn btn-secundario px-2 py-0.5" disabled={i === 0} onClick={() => moverRuta(i, -1)}>↑</button>
                    <button type="button" className="btn btn-secundario px-2 py-0.5" disabled={i === rutaOrden.length - 1} onClick={() => moverRuta(i, 1)}>↓</button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div className="grid grid-cols-2 gap-3 content-start">
                <label className="block">
                  <span className={labelCls}>Vehículo (ECO)</span>
                  <input list="ecos-compras" value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} className={celdaCls} placeholder="Ej. L-25" />
                  <datalist id="ecos-compras">{ecos.map((e) => <option key={e} value={e} />)}</datalist>
                </label>
                <label className="block"><span className={labelCls}>Consumo promedio de ruta</span><input value={consumoPromedio} onChange={(e) => setConsumoPromedio(e.target.value)} className={celdaCls} placeholder="Ej. 12 L" /></label>
                <label className="block"><span className={labelCls}>Monto de combustible ($)</span><input type="number" min={0} value={combustible} onChange={(e) => setCombustible(e.target.value)} className={celdaCls} /></label>
                <label className="block"><span className={labelCls}>Tiempo estimado de regreso</span><input value={tiempoRegreso} onChange={(e) => setTiempoRegreso(e.target.value)} className={celdaCls} placeholder="Ej. 2 h 30 min" /></label>
                <div className="col-span-2">
                  <span className={labelCls}>Viáticos adicionales</span>
                  {viaticos.map((v, i) => (
                    <div key={i} className="grid grid-cols-[1fr_120px_30px] gap-2 mb-1.5">
                      <input value={v.concepto} onChange={(e) => setViaticos((p) => p.map((x, k) => (k === i ? { ...x, concepto: e.target.value } : x)))} placeholder="Concepto" className={celdaCls} />
                      <input type="number" min={0} value={v.monto} onChange={(e) => setViaticos((p) => p.map((x, k) => (k === i ? { ...x, monto: e.target.value } : x)))} placeholder="$" className={celdaCls} />
                      <button type="button" className="text-[var(--red)]" onClick={() => setViaticos((p) => p.filter((_, k) => k !== i))}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="text-[12px] font-bold text-[var(--blue)]" onClick={() => setViaticos((p) => [...p, { concepto: "", monto: "" }])}>+ Agregar viático</button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <label className="block"><span className={labelCls}>Justificación de la compra</span><textarea rows={4} value={justificacion} onChange={(e) => setJustificacion(e.target.value)} className={celdaCls} /></label>
                <div className="border border-[var(--gray-200)] rounded-lg p-3 text-[12.5px]">
                  <div className="flex justify-between"><span>Artículos</span><b>{moneda(totalArticulos)}</b></div>
                  <div className="flex justify-between"><span>Combustible</span><b>{moneda(Number(combustible) || 0)}</b></div>
                  <div className="flex justify-between"><span>Viáticos</span><b>{moneda(totalViaticos)}</b></div>
                  <div className="flex justify-between border-t border-[var(--gray-200)] mt-1.5 pt-1.5 text-[14px] text-[var(--navy)]"><span className="font-bold">Total estimado</span><b>{moneda(granTotal)}</b></div>
                </div>
              </div>
            </div>

            {errorMsg && <p className="text-[12.5px] text-[var(--red)] mt-3 mb-0">{errorMsg}</p>}
            <div className="flex justify-end mt-5">
              <button type="button" onClick={solicitarAutorizacion} disabled={guardando} className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold disabled:opacity-60">
                {guardando ? "Enviando…" : "Solicitar Autorización"}
              </button>
            </div>
          </div>
        )}

        {tab === "consultar" && (
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-[var(--gray-200)]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-[15px] sm:text-[16px] font-bold text-[var(--navy)] m-0">Historial de Órdenes de Compra</h3>
              {permisos.esSysadmin && <button type="button" className="btn btn-secundario py-1.5 text-[12.5px]" onClick={() => setConfigRoles(true)}>Quién autoriza OC</button>}
            </div>
            {cargandoConsultas && <p className="text-[13px] text-[var(--gray-400)]">Cargando…</p>}
            {errorConsulta && <p className="text-[13px] text-[var(--red)]">{errorConsulta}</p>}
            {!cargandoConsultas && !errorConsulta && ordenes.length === 0 && <p className="text-[13px] text-[var(--gray-400)]">Aún no hay órdenes de compra.</p>}
            {!cargandoConsultas && ordenes.length > 0 && (
              <div className="overflow-x-auto border border-[var(--gray-200)] rounded-lg">
                <table className="w-full text-left text-[12.5px] border-collapse min-w-[720px]">
                  <thead className="bg-[#f8fafc] text-[var(--navy)] font-bold border-b border-[var(--gray-200)]">
                    <tr>
                      <th className="p-3">Folio</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Solicitó</th>
                      <th className="p-3 text-center">Artículos</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-center">Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.map((o) => (
                      <tr key={o.id ?? o.folio} className="border-b border-[var(--gray-200)]">
                        <td className="p-3"><button type="button" className="font-bold text-[var(--blue)] hover:underline" onClick={() => setDetalle(o)}>{o.folio}</button></td>
                        <td className="p-3">{fechaCorta(o.fecha || o.created_at)}</td>
                        <td className="p-3">{o.solicitado_por || "—"}</td>
                        <td className="p-3 text-center">{productosDe(o).length}</td>
                        <td className="p-3 text-right font-semibold">{moneda(o.total_general)}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${esAutorizada(o.estado) ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{o.estado || "Pendiente"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {altaProveedor !== null && (
        <AltaProveedorModal
          nombreInicial={altaProveedor}
          onCerrar={() => setAltaProveedor(null)}
          onAlta={(nombre) => {
            setFilas((prev) => prev.map((f) => (f.proveedor.trim().toLowerCase() === altaProveedor.trim().toLowerCase() ? { ...f, proveedor: nombre } : f)));
            setAltaProveedor(null);
            cargarCatalogo();
          }}
        />
      )}
      {detalle && (
        <DetalleOCModal
          orden={detalle}
          puedeAutorizar={permisos.puedeAutorizar}
          onCerrar={() => setDetalle(null)}
          onActualizada={async () => {
            setDetalle(null);
            await cargarOrdenes();
          }}
        />
      )}
      {configRoles && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] flex items-center justify-center p-4 z-50" onClick={() => setConfigRoles(false)}>
          <div className="bg-white rounded-xl w-full max-w-[380px] shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-1">Quién autoriza OC</h3>
            <p className="text-[12px] text-[var(--gray-500)] m-0 mb-3">El sysadmin siempre puede autorizar. Marca los roles adicionales.</p>
            {permisos.roles.map((r) => (
              <label key={r.rol} className="flex items-center gap-2 py-1 text-[13px]">
                <input type="checkbox" checked={r.autoriza} onChange={(e) => setPermisos((p) => ({ ...p, roles: p.roles.map((x) => (x.rol === r.rol ? { ...x, autoriza: e.target.checked } : x)) }))} />
                {r.etiqueta}
              </label>
            ))}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="btn btn-secundario py-1.5" onClick={() => setConfigRoles(false)}>Cancelar</button>
              <button type="button" className="btn btn-primario py-1.5" onClick={guardarRoles}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
