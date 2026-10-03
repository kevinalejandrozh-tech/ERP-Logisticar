"use client";
import { useEffect, useState } from "react";
import { SitioContenido } from "@/lib/sitioData";

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(15,24,69,0.55)] px-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-[520px] max-h-[85vh] flex flex-col bg-white rounded-lg shadow-[0_12px_40px_rgba(15,24,69,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gray-200)]">
          <h2 className="font-medium text-[16px] text-[var(--navy)]">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="w-8 h-8 rounded-md hover:bg-[var(--gray-100)] text-[var(--gray-500)] text-[20px] leading-none">
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

const REDES: { clave: keyof SitioContenido["redes"]; nombre: string; ejemplo: string }[] = [
  { clave: "facebook", nombre: "Facebook", ejemplo: "https://www.facebook.com/tu-pagina" },
  { clave: "instagram", nombre: "Instagram", ejemplo: "https://www.instagram.com/tu-cuenta" },
  { clave: "linkedin", nombre: "LinkedIn", ejemplo: "https://www.linkedin.com/company/tu-empresa" },
  { clave: "whatsapp", nombre: "WhatsApp", ejemplo: "https://wa.me/525500000000" },
];

const ACCESOS: { clave: keyof SitioContenido["accesos"]; nombre: string; ejemplo: string }[] = [
  { clave: "facebook", nombre: "Ícono de Facebook (junto al teléfono)", ejemplo: "https://www.facebook.com/tu-pagina" },
  { clave: "maps", nombre: "Ícono de Google Maps (junto al teléfono)", ejemplo: "https://maps.app.goo.gl/..." },
];
const RE_HTTPS = /^https:\/\/\S{3,}$/;

// Enlaces de redes sociales y de los íconos junto al teléfono (el teléfono, correo y dirección se editan directo en la página).
export function PanelRedes({
  redes,
  accesos,
  onAplicar,
  onCerrar,
}: {
  redes: SitioContenido["redes"];
  accesos: SitioContenido["accesos"];
  onAplicar: (redes: SitioContenido["redes"], accesos: SitioContenido["accesos"]) => void;
  onCerrar: () => void;
}) {
  const [valores, setValores] = useState(redes);
  const [valoresAccesos, setValoresAccesos] = useState(accesos);
  const invalidas = [
    ...REDES.filter((r) => valores[r.clave].trim() !== "" && !RE_HTTPS.test(valores[r.clave].trim())),
    ...ACCESOS.filter((r) => valoresAccesos[r.clave].trim() !== "" && !RE_HTTPS.test(valoresAccesos[r.clave].trim())),
  ];

  return (
    <Modal titulo="Redes sociales y enlaces" onCerrar={onCerrar}>
      <p className="text-[13px] text-[var(--gray-500)] mb-4">
        Pega el enlace completo de cada red. Las que dejes vacías no se muestran en el sitio.
      </p>
      <div className="flex flex-col gap-3.5">
        {REDES.map((r) => (
          <div key={r.clave}>
            <label htmlFor={`red-${r.clave}`} className="block text-[12.5px] font-medium mb-1.5">
              {r.nombre}
            </label>
            <input
              id={`red-${r.clave}`}
              type="url"
              value={valores[r.clave]}
              placeholder={r.ejemplo}
              onChange={(e) => setValores({ ...valores, [r.clave]: e.target.value })}
              className="w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px]"
            />
          </div>
        ))}
        <p className="text-[12px] font-medium text-[var(--navy)] mt-2 mb-0">Íconos junto al teléfono</p>
        {ACCESOS.map((r) => (
          <div key={r.clave}>
            <label htmlFor={`acceso-${r.clave}`} className="block text-[12.5px] font-medium mb-1.5">
              {r.nombre}
            </label>
            <input
              id={`acceso-${r.clave}`}
              type="url"
              value={valoresAccesos[r.clave]}
              placeholder={r.ejemplo}
              onChange={(e) => setValoresAccesos({ ...valoresAccesos, [r.clave]: e.target.value })}
              className="w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px]"
            />
          </div>
        ))}
      </div>
      {invalidas.length > 0 && (
        <p className="text-[12.5px] text-[var(--red)] font-medium mt-3">
          El enlace de {invalidas.map((r) => r.nombre).join(" y ")} debe empezar con https://
        </p>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <button type="button" onClick={onCerrar} className="btn btn-secundario">
          Cancelar
        </button>
        <button
          type="button"
          disabled={invalidas.length > 0}
          onClick={() => {
            onAplicar({
              facebook: valores.facebook.trim(),
              instagram: valores.instagram.trim(),
              linkedin: valores.linkedin.trim(),
              whatsapp: valores.whatsapp.trim(),
            }, {
              facebook: valoresAccesos.facebook.trim(),
              maps: valoresAccesos.maps.trim(),
            });
            onCerrar();
          }}
          className="btn btn-primario"
        >
          Aplicar enlaces
        </button>
      </div>
    </Modal>
  );
}

type Suscriptor = { id: number; correo: string; fecha: string };

export function PanelSuscriptores({ onCerrar }: { onCerrar: () => void }) {
  const [lista, setLista] = useState<Suscriptor[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/sitio/boletin", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "No se pudo leer la lista.");
        setLista(d.suscriptores);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo leer la lista."));
  }, []);

  const eliminar = async (s: Suscriptor) => {
    if (!window.confirm(`¿Eliminar a ${s.correo} del boletín?`)) return;
    const r = await fetch(`/api/sitio/boletin?id=${s.id}`, { method: "DELETE" });
    if (r.ok) setLista((l) => (l ? l.filter((x) => x.id !== s.id) : l));
    else setError((await r.json().catch(() => ({}))).error || "No se pudo eliminar.");
  };

  const descargar = () => {
    if (!lista) return;
    const csv = "Correo,Fecha de suscripción\n" + lista.map((s) => `"${s.correo.replace(/"/g, '""')}",${s.fecha}`).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "suscriptores-boletin.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal titulo={lista ? `Suscriptores del boletín (${lista.length})` : "Suscriptores del boletín"} onCerrar={onCerrar}>
      {error && <p className="text-[12.5px] text-[var(--red)] font-medium mb-3">{error}</p>}
      {!lista && !error && <p className="text-[13px] text-[var(--gray-500)]">Cargando...</p>}
      {lista && lista.length === 0 && (
        <p className="text-[13px] text-[var(--gray-500)]">Todavía no hay suscriptores. Aparecerán aquí cuando alguien se registre desde la sección Boletín del sitio.</p>
      )}
      {lista && lista.length > 0 && (
        <>
          <div className="border border-[var(--gray-200)] rounded-md overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--gray-50)] text-[var(--gray-500)]">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Correo</th>
                  <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Fecha</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--gray-200)]">
                    <td className="px-3 py-2 break-all">{s.correo}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-[var(--gray-500)]">{s.fecha}</td>
                    <td className="px-2 py-1 text-right">
                      <button type="button" onClick={() => eliminar(s)} title="Eliminar" aria-label={`Eliminar ${s.correo}`} className="w-7 h-7 rounded-md text-[var(--gray-400)] hover:text-[var(--red)] hover:bg-[var(--gray-100)]">
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-4">
            <button type="button" onClick={descargar} className="btn btn-secundario">
              Descargar CSV
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
