"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

export default function PedidoMenuDiaPage() {
  const [opciones, setOpciones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [nombre, setNombre] = useState("");
  const [pedido, setPedido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    fetch("/api/menu-dia/opciones", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const ops: string[] = data.opciones || [];
        setOpciones(ops);
        setPedido(ops[0] || "");
        if (ops.length === 0) setError("Aún no hay un menú del día publicado. Intenta más tarde.");
      })
      .catch(() => setError("No se pudo cargar el menú del día."))
      .finally(() => setCargando(false));
  }, []);

  const enviarPedido = async () => {
    if (!nombre.trim()) {
      alert("Escribe tu nombre.");
      return;
    }
    if (!pedido) {
      alert("Selecciona tu opción de menú.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/menu-dia/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), pedido }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar el pedido.");
      setEnviado(true);
    } catch (err: any) {
      alert(err.message || "No se pudo enviar el pedido.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center bg-[#dcdfe6] py-8 px-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-xl overflow-hidden h-fit">
        <div className="px-5 pt-5 pb-4 border-b border-[var(--gray-200)] flex items-center gap-2.5">
          <Logo size={30} />
          <div className="leading-tight">
            <p className="font-display font-extrabold text-[var(--red)] text-[12px] m-0">TRANSPORTES</p>
            <p className="font-display font-extrabold text-[var(--red)] text-[12px] m-0">LOGISTICAR</p>
          </div>
        </div>

        <div className="p-5">
          {cargando && <p className="text-center text-[13px] text-[var(--gray-400)] py-10">Cargando menú del día...</p>}

          {!cargando && error && <p className="text-center text-[13px] text-[var(--red)] py-6">{error}</p>}

          {!cargando && !error && !enviado && (
            <>
              <h1 className="font-display font-extrabold text-[var(--navy)] text-[17px] m-0 mb-1">Menú del día</h1>
              <p className="text-[12.5px] text-[var(--gray-400)] mb-5">Escribe tu nombre y elige tu opción para enviar tu pedido.</p>

              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Nombre</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] mb-4"
              />

              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Selecciona tu menú</label>
              <div className="flex flex-col gap-2 mb-6">
                {opciones.map((op, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-2.5 border rounded-lg px-3.5 py-2.5 text-[13.5px] cursor-pointer ${pedido === op ? "border-[var(--blue)] bg-[var(--blue-light)] font-bold text-[var(--navy)]" : "border-[var(--gray-200)] text-[var(--text)]"}`}
                  >
                    <input type="radio" name="pedido" checked={pedido === op} onChange={() => setPedido(op)} className="accent-[var(--blue)]" />
                    {op}
                  </label>
                ))}
              </div>

              <button type="button" onClick={enviarPedido} disabled={enviando} className="w-full bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg py-3 text-[14px] font-bold">
                {enviando ? "Enviando..." : "Enviar pedido"}
              </button>
            </>
          )}

          {enviado && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-[var(--green)] flex items-center justify-center mx-auto mb-4">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <h2 className="font-display font-extrabold text-[var(--navy)] text-[16px] m-0 mb-1.5">¡Pedido enviado!</h2>
              <p className="text-[13px] text-[var(--gray-400)] m-0">
                Gracias {nombre}, tu pedido de &quot;{pedido}&quot; fue registrado.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
