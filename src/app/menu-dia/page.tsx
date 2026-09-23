"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type Pedido = { id: number; nombre: string; pedido: string; fecha: string };

declare global {
  interface Window {
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
function escaparHtml(texto: string) {
  return String(texto || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function MenuDiaPage() {
  const [opciones, setOpciones] = useState<string[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    try {
      const [resOp, resPed] = await Promise.all([fetch("/api/menu-dia/opciones", { cache: "no-store" }), fetch("/api/menu-dia/pedidos", { cache: "no-store" })]);
      const dataOp = await resOp.json();
      const dataPed = await resPed.json();
      setOpciones(dataOp.opciones || []);
      setPedidos(dataPed.registros || []);
    } catch {
      // se reintenta al volver a la pestaña
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => {
    cargar();
  }, []);
  useRefrescarAlEnfocar(cargar);

  // QR hacia la página pública de pedido (siempre visible, no depende de que haya un menú activo)
  useEffect(() => {
    cargarQRiousLib()
      .then(() => {
        const canvas = document.getElementById("qr-menu-dia") as HTMLCanvasElement | null;
        if (canvas) {
          new window.QRious({ element: canvas, value: `${window.location.origin}/menu-dia/pedido`, size: 92, level: "M" });
        }
      })
      .catch(() => {});
  }, [opciones.length]);

  // ---- Modal: Agregar menú del día ----
  const [modalAbierto, setModalAbierto] = useState(false);
  const [opcionesForm, setOpcionesForm] = useState<string[]>(["", ""]);
  const [guardando, setGuardando] = useState(false);

  const abrirModal = () => {
    setOpcionesForm(["", ""]);
    setModalAbierto(true);
  };
  const actualizarOpcionForm = (idx: number, valor: string) => {
    setOpcionesForm((prev) => prev.map((o, i) => (i === idx ? valor : o)));
  };
  const agregarOpcionForm = () => setOpcionesForm((prev) => [...prev, ""]);
  const quitarOpcionForm = (idx: number) => setOpcionesForm((prev) => prev.filter((_, i) => i !== idx));

  const guardarMenu = async () => {
    const limpias = opcionesForm.map((o) => o.trim()).filter(Boolean);
    if (limpias.length === 0) {
      alert("Captura al menos una opción de menú.");
      return;
    }
    if ((opciones.length > 0 || pedidos.length > 0) && !confirm("Esto borrará el menú y los pedidos actuales para dar espacio al nuevo menú del día. ¿Deseas continuar?")) {
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/menu-dia/opciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opciones: limpias }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el menú del día.");
      setModalAbierto(false);
      await cargar();
    } catch (err: any) {
      alert(err.message || "No se pudo guardar el menú del día.");
    } finally {
      setGuardando(false);
    }
  };

  // ---- Imprimir tabla en PDF ----
  const imprimirTabla = () => {
    const ventana = window.open("", "_blank", "width=800,height=650");
    if (!ventana) {
      alert("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.");
      return;
    }
    const filasHtml = pedidos
      .map(
        (p, i) => `<tr>
          <td>${i + 1}</td>
          <td>${escaparHtml(p.nombre)}</td>
          <td>${escaparHtml(p.pedido)}</td>
        </tr>`
      )
      .join("");
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Menú del día — Pedidos</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background: #eef1f6; color: #16215c; }
  .hoja { max-width: 700px; margin: 24px auto; background: #fff; border-radius: 12px; overflow: hidden; }
  .cab { background: #16215c; padding: 18px 24px; }
  .cab h1 { color: #fff; font-size: 18px; margin: 0 0 3px; }
  .cab p { color: #a9c2ee; font-size: 12px; margin: 0; }
  .cuerpo { padding: 20px 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; background: #f4f5f8; color: #9aa1b0; text-transform: uppercase; font-size: 10.5px; padding: 8px 10px; }
  td { padding: 9px 10px; border-bottom: 1px solid #e5e8ee; }
  .total { padding: 12px 24px; font-size: 12.5px; color: #9aa1b0; border-top: 1px solid #e5e8ee; }
  .barra { padding: 14px 24px; text-align: center; }
  button { padding: 10px 26px; font-size: 13px; font-weight: bold; background: #16215c; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
  @media print { body { background: #fff; } .hoja { margin: 0; max-width: none; } .barra { display: none; } }
</style>
</head>
<body>
<div class="hoja">
  <div class="cab">
    <h1>Menú del día — Pedidos</h1>
    <p>${new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
  </div>
  <div class="cuerpo">
    <table>
      <thead><tr><th>#</th><th>Nombre</th><th>Pedido</th></tr></thead>
      <tbody>${filasHtml || `<tr><td colspan="3" style="text-align:center;color:#9aa1b0;">Sin pedidos registrados.</td></tr>`}</tbody>
    </table>
  </div>
  <div class="total">Total de pedidos: ${pedidos.length}</div>
</div>
<div class="barra"><button id="btnImprimir">Imprimir / Guardar PDF</button></div>
<script>
  document.getElementById("btnImprimir").addEventListener("click", function () { window.print(); });
</script>
</body>
</html>`;
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Menú del día"
          subtitulo="Publica el menú del día y recibe los pedidos escaneando el código QR."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M6 2v20M6 2c-2 0-3 1.5-3 3.5S4 9 6 9M18 2v20M18 2a3.5 3.5 0 013.5 3.5v3a3.5 3.5 0 01-3.5 3.5" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3.5 mb-4">
            <div className="flex flex-wrap items-center gap-3.5">
              <button type="button" onClick={abrirModal} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                Agregar menú del día
              </button>
              <div className="flex items-center gap-3 bg-[var(--gray-100)] rounded-xl p-2.5 pr-4">
                <canvas id="qr-menu-dia" className="shrink-0 rounded-lg bg-white" />
                <div>
                  <p className="text-[12px] font-bold text-[var(--navy)] m-0 mb-1">Escanea para pedir</p>
                  {opciones.length > 0 ? (
                    <>
                      <p className="text-[10.5px] text-[var(--gray-400)] m-0 mb-1.5">Nombre y selección de menú.</p>
                      <div className="flex flex-wrap gap-1">
                        {opciones.map((op, i) => (
                          <span key={i} className="text-[10px] font-bold text-[var(--navy)] bg-white rounded-full px-2 py-0.5">
                            {op}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[10.5px] text-[var(--gray-400)] m-0">Aún no hay menú activo para hoy.</p>
                  )}
                </div>
              </div>
            </div>
            {pedidos.length > 0 && (
              <button type="button" onClick={imprimirTabla} className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                Imprimir PDF
              </button>
            )}
          </div>

          {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Cargando...</p>}


          {!cargando && (
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["Nombre", "Pedido"].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-3 py-2 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--gray-200)]">
                      <td className="px-3 py-2 text-[13px] font-semibold text-[var(--navy)] whitespace-nowrap">{p.nombre}</td>
                      <td className="px-3 py-2 text-[13px] whitespace-nowrap">{p.pedido}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pedidos.length === 0 && (
                <p className="text-center text-[var(--gray-400)] text-[13px] py-10">
                  {opciones.length === 0 ? <>Aún no hay un menú del día. Usa &quot;Agregar menú del día&quot; para publicar uno.</> : "Aún no hay pedidos registrados. Comparte el código QR."}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[460px] max-w-[92%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-1">Agregar menú del día</h3>
            {(opciones.length > 0 || pedidos.length > 0) && (
              <p className="text-[12px] text-[var(--red)] mb-4">Al guardar se borrará el menú y los pedidos actuales.</p>
            )}
            <div className="flex flex-col gap-2.5 mb-2">
              {opcionesForm.map((op, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={op}
                    onChange={(e) => actualizarOpcionForm(idx, e.target.value)}
                    placeholder={`Opción ${idx + 1} de menú`}
                    className="flex-1 border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]"
                  />
                  {opcionesForm.length > 1 && (
                    <span onClick={() => quitarOpcionForm(idx)} className="text-[var(--red)] cursor-pointer shrink-0" title="Quitar opción">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={agregarOpcionForm} className="text-[12.5px] font-bold text-[var(--blue)] mb-6">
              + Agregar opción
            </button>

            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setModalAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardarMenu} disabled={guardando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
