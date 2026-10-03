"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { fechaCorta, moneda } from "@/lib/nominaCalculo";

type Semana = { id: number; semana: number; fecha_inicio: string; fecha_fin: string; estado: string; empleados: number; percepciones: number; deducciones: number; neto: number; bbva: number; viaticos: number };
type Concepto = { concepto: string; monto: number };
type Datos = {
  anio: number;
  anios: number[];
  semanas: Semana[];
  totales: { percepciones: number; deducciones: number; neto: number; bbva: number; viaticos: number; semanas_capturadas: number; promedio_semanal: number; ultima: Semana | null };
  percepciones: Concepto[];
  deducciones: Concepto[];
  top: { expediente_id: number; nombre: string; semanas: number; neto: number }[];
  creditos: { concepto: string; activos: number; saldo: number }[];
  caja: { total: number; personas: number };
};

const AZUL = "#2f6fed";
const NAVY = "#16215c";
const VERDE = "#21a866";
const COLORES = ["#16215c", "#2f6fed", "#21a866", "#f2b134", "#e2412c", "#7c5cd6", "#0f766e", "#8a91a0"];

// Dashboard sencillo de finanzas de nómina: cuánto se paga, cómo se paga (BBVA / viáticos) y en qué se va el descuento.
export default function DashboardNominaPage() {
  const [anio, setAnio] = useState<number | null>(null);
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async (a: number | null) => {
    try {
      const res = await fetch(`/api/nomina/dashboard${a ? `?anio=${a}` : ""}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "No se pudo cargar.");
      setD(j);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    }
  }, []);

  useEffect(() => {
    cargar(anio);
  }, [anio, cargar]);

  const semanas = d ? d.semanas.filter((s) => s.empleados > 0) : [];
  const maxNeto = Math.max(1, ...semanas.map((s) => s.bbva + s.viaticos));
  const totalDed = d ? d.deducciones.reduce((a, x) => a + x.monto, 0) : 0;
  const totalPer = d ? d.percepciones.reduce((a, x) => a + x.monto, 0) : 0;
  const pctBbva = d && d.totales.neto > 0 ? Math.round((d.totales.bbva / (d.totales.bbva + d.totales.viaticos || 1)) * 100) : 0;

  const tarjeta = (t: string, v: string, nota?: string, color?: string) => (
    <div className="bg-white border border-[var(--gray-200)] rounded-xl px-4 py-3.5 shadow-[0_1px_4px_rgba(22,33,92,0.05)]">
      <p className="text-[12px] text-[var(--gray-500)] m-0">{t}</p>
      <p className="text-[20px] font-bold m-0 mt-0.5 tabular-nums" style={{ color: color || "var(--navy)" }}>{v}</p>
      {nota && <p className="text-[11.5px] text-[var(--gray-400)] m-0 mt-0.5">{nota}</p>}
    </div>
  );

  const barras = (lista: Concepto[], total: number) => (
    <div className="grid gap-2.5">
      {lista.filter((x) => x.monto > 0).length === 0 && <p className="text-[12.5px] text-[var(--gray-400)] m-0">Sin datos capturados.</p>}
      {lista
        .filter((x) => x.monto > 0)
        .sort((a, b) => b.monto - a.monto)
        .map((x, i) => {
          const pct = total > 0 ? (x.monto / total) * 100 : 0;
          return (
            <div key={x.concepto}>
              <div className="flex justify-between text-[12.5px] mb-1">
                <span className="text-[var(--text)]">{x.concepto}</span>
                <span className="font-medium text-[var(--navy)] tabular-nums">{moneda(x.monto)} <span className="text-[var(--gray-400)] font-normal">· {pct.toFixed(0)}%</span></span>
              </div>
              <div className="h-[8px] bg-[var(--gray-100)] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORES[i % COLORES.length] }} />
              </div>
            </div>
          );
        })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
        <PageHeader
          titulo="Dashboard de nómina"
          subtitulo="Finanzas de la nómina: totales pagados, depósitos, percepciones y deducciones."
          backHref="/personas"
          backLabel="Recursos Humanos"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M3 3v18h18M8 17V9M13 17V5M18 17v-7" /></svg>}
        />
        {error && <p className="mb-4 text-[13px] text-[var(--red)]">{error}</p>}
        {!d && !error && <p className="text-[13px] text-[var(--gray-500)]">Cargando…</p>}
        {d && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <label className="text-[13px] text-[var(--gray-500)] flex items-center gap-2">
                Año
                <select value={d.anio} onChange={(e) => setAnio(Number(e.target.value))} className="border border-[var(--gray-300)] rounded-md px-3 py-1.5 text-[13.5px] bg-white">
                  {Array.from(new Set([d.anio, ...d.anios])).sort((a, b) => b - a).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <span className="text-[12.5px] text-[var(--gray-500)]">{d.totales.semanas_capturadas} semana(s) con captura · solo se consideran capturas guardadas · semana de lunes a domingo</span>
              <div className="flex-1" />
              <Link href="/personas/nomina" className="btn btn-secundario py-1.5">Ir a Nómina</Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-5">
              {tarjeta(`Total pagado ${d.anio}`, moneda(d.totales.neto), "Neto de todas las semanas")}
              {tarjeta("Promedio por semana", moneda(d.totales.promedio_semanal))}
              {tarjeta("Depósitos BBVA", moneda(d.totales.bbva), `${pctBbva}% del pago`, AZUL)}
              {tarjeta("Depósitos de viáticos", moneda(d.totales.viaticos), `${100 - pctBbva}% del pago`, VERDE)}
              {tarjeta("Caja de ahorro acumulada", moneda(d.caja.total), `${d.caja.personas} persona(s) · abonos capturados`)}
              {tarjeta("Créditos por cobrar", moneda(d.creditos.reduce((a, c) => a + c.saldo, 0)), `${d.creditos.reduce((a, c) => a + c.activos, 0)} crédito(s) activos`, "#a46b00")}
            </div>

            <div className="bg-white border border-[var(--gray-200)] rounded-xl p-5 mb-5 shadow-[0_1px_4px_rgba(22,33,92,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-[15px] font-bold text-[var(--navy)] m-0">Pago por semana</h3>
                <div className="flex items-center gap-4 text-[12px] text-[var(--gray-500)]">
                  <span className="flex items-center gap-1.5"><i className="inline-block w-4 h-[3px] rounded-sm" style={{ background: NAVY }} />Total</span>
                  <span className="flex items-center gap-1.5"><i className="inline-block w-4 h-[3px] rounded-sm" style={{ background: AZUL }} />BBVA</span>
                  <span className="flex items-center gap-1.5"><i className="inline-block w-4 h-[3px] rounded-sm" style={{ background: VERDE }} />Viáticos</span>
                </div>
              </div>
              {semanas.length === 0 ? (
                <p className="text-[12.5px] text-[var(--gray-400)] m-0">Aún no hay semanas capturadas en {d.anio}.</p>
              ) : (
                <GraficaLineas semanas={semanas} maximo={maxNeto} />
              )}
              {d.totales.ultima && (
                <p className="text-[12.5px] text-[var(--gray-500)] m-0 mt-3">
                  Última semana capturada: <b className="text-[var(--navy)] font-medium">Semana {d.totales.ultima.semana}</b> (cierre domingo {fechaCorta(d.totales.ultima.fecha_fin)}) · {d.totales.ultima.empleados} persona(s) · {moneda(d.totales.ultima.neto)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              <div className="bg-white border border-[var(--gray-200)] rounded-xl p-5 shadow-[0_1px_4px_rgba(22,33,92,0.05)]">
                <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-1">Percepciones</h3>
                <p className="text-[12px] text-[var(--gray-500)] m-0 mb-3">Lo que se paga · total {moneda(totalPer)}</p>
                {barras(d.percepciones, totalPer)}
              </div>
              <div className="bg-white border border-[var(--gray-200)] rounded-xl p-5 shadow-[0_1px_4px_rgba(22,33,92,0.05)]">
                <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-1">Deducciones</h3>
                <p className="text-[12px] text-[var(--gray-500)] m-0 mb-3">Lo que se descuenta · total {moneda(totalDed)}</p>
                {barras(d.deducciones, totalDed)}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
              <div className="bg-white border border-[var(--gray-200)] rounded-xl p-5 shadow-[0_1px_4px_rgba(22,33,92,0.05)]">
                <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-3">Mayor pago neto en el año</h3>
                {d.top.length === 0 && <p className="text-[12.5px] text-[var(--gray-400)] m-0">Sin datos.</p>}
                <table className="w-full text-[13px]">
                  <tbody>
                    {d.top.map((p, i) => (
                      <tr key={p.expediente_id} className="border-t border-[var(--gray-100)] first:border-0">
                        <td className="py-2 pr-2 text-[var(--gray-400)] w-6">{i + 1}</td>
                        <td className="py-2"><Link href={`/personas/expedientes/detalle?id=${p.expediente_id}`} className="text-[var(--navy)] font-medium hover:underline">{p.nombre}</Link></td>
                        <td className="py-2 text-[var(--gray-500)] text-right">{p.semanas} sem.</td>
                        <td className="py-2 text-right font-medium tabular-nums">{moneda(p.neto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white border border-[var(--gray-200)] rounded-xl p-5 shadow-[0_1px_4px_rgba(22,33,92,0.05)]">
                <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-3">Créditos activos (saldo por cobrar)</h3>
                {d.creditos.length === 0 && <p className="text-[12.5px] text-[var(--gray-400)] m-0">No hay créditos activos.</p>}
                <div className="grid gap-2">
                  {d.creditos.map((c) => (
                    <div key={c.concepto} className="flex items-center justify-between border border-[var(--gray-200)] rounded-lg px-3.5 py-2.5">
                      <div>
                        <p className="m-0 text-[13px] font-medium text-[var(--navy)]">{c.concepto}</p>
                        <p className="m-0 text-[11.5px] text-[var(--gray-500)]">{c.activos} activo(s)</p>
                      </div>
                      <b className="text-[15px] text-[#a46b00] tabular-nums">{moneda(c.saldo)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Gráfica de líneas "Pago por semana": total, depósitos BBVA y viáticos. Cada punto abre la semana.
function GraficaLineas({ semanas, maximo }: { semanas: Semana[]; maximo: number }) {
  const router = useRouter();
  const PASO = 56;
  const ALTO = 220;
  const M = { izq: 54, der: 18, arr: 18, aba: 30 };
  const ancho = Math.max(640, M.izq + M.der + (semanas.length - 1) * PASO + 20);
  const altoUtil = ALTO - M.arr - M.aba;
  const tope = Math.ceil(maximo / 5000) * 5000 || 1;
  const x = (i: number) => M.izq + 10 + i * PASO;
  const y = (v: number) => M.arr + altoUtil - (v / tope) * altoUtil;
  const ruta = (f: (s: Semana) => number) => semanas.map((s, i) => `${i ? "L" : "M"}${x(i)},${y(f(s))}`).join(" ");
  const series: { nombre: string; color: string; f: (s: Semana) => number; grosor: number }[] = [
    { nombre: "Total", color: NAVY, f: (s) => s.bbva + s.viaticos, grosor: 2.6 },
    { nombre: "BBVA", color: AZUL, f: (s) => s.bbva, grosor: 2 },
    { nombre: "Viáticos", color: VERDE, f: (s) => s.viaticos, grosor: 2 },
  ];
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((p) => p * tope);
  return (
    <div className="overflow-x-auto">
      <svg width={ancho} height={ALTO} viewBox={`0 0 ${ancho} ${ALTO}`} role="img" aria-label="Pago por semana" className="block">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={M.izq} x2={ancho - M.der} y1={y(m)} y2={y(m)} stroke="#e5e7eb" strokeDasharray={m ? "3 4" : undefined} />
            <text x={M.izq - 8} y={y(m) + 4} textAnchor="end" fontSize="10.5" fill="#8a91a0">{`${Math.round(m / 1000)}k`}</text>
          </g>
        ))}
        {series.map((se) => (
          <path key={se.nombre} d={ruta(se.f)} fill="none" stroke={se.color} strokeWidth={se.grosor} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {semanas.map((s, i) => (
          <g key={s.id} className="cursor-pointer" onClick={() => router.push(`/personas/nomina/semana?id=${s.id}`)}>
            <title>{`Semana ${s.semana} (${fechaCorta(s.fecha_inicio)} – ${fechaCorta(s.fecha_fin)})\nTotal: ${moneda(s.bbva + s.viaticos)}\nBBVA: ${moneda(s.bbva)}\nViáticos: ${moneda(s.viaticos)}`}</title>
            <rect x={x(i) - PASO / 2} y={M.arr} width={PASO} height={altoUtil} fill="transparent" />
            {series.map((se) => (
              <circle key={se.nombre} cx={x(i)} cy={y(se.f(s))} r={3.4} fill="#fff" stroke={se.color} strokeWidth={2} />
            ))}
            <text x={x(i)} y={ALTO - 10} textAnchor="middle" fontSize="11" fill="#6b7280">{`S${s.semana}`}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
