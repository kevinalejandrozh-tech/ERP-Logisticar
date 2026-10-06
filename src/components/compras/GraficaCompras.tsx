"use client";
import { useMemo, useState } from "react";
import { OrdenCompra, esRechazada, moneda, totalOC } from "@/lib/comprasData";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const SEM = ["D", "L", "M", "M", "J", "V", "S"];
const diaMx = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Mexico_City" }); // AAAA-MM-DD
const peso = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);

// Escala "bonita" para el eje Y (1, 2, 2.5, 5 × 10^n).
function escala(max: number) {
  if (max <= 0) return { tope: 1000, paso: 250 };
  const bruto = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) || mag * 10;
  return { tope: paso * Math.ceil(max / paso), paso };
}

// Gráfica de líneas y puntos: $ en el eje Y y los días del mes en el eje X, con la etiqueta del monto sobre cada punto.
export default function GraficaCompras({ ordenes }: { ordenes: OrdenCompra[] }) {
  const hoy = diaMx(new Date().toISOString());
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const vigentes = useMemo(() => ordenes.filter((o) => !esRechazada(o.estado)), [ordenes]);

  const { dias, valores, ordenesMes, totalMes } = useMemo(() => {
    const [a, m] = mes.split("-").map(Number);
    const n = new Date(a, m, 0).getDate();
    const v = Array.from({ length: n }, () => 0);
    let cuenta = 0;
    for (const o of vigentes) {
      const d = diaMx(o.fecha || o.created_at || "");
      if (d.slice(0, 7) !== mes) continue;
      v[Number(d.slice(8, 10)) - 1] += totalOC(o);
      cuenta++;
    }
    return { dias: n, valores: v, ordenesMes: cuenta, totalMes: v.reduce((x, y) => x + y, 0) };
  }, [vigentes, mes]);
  const totalGeneral = useMemo(() => vigentes.reduce((x, o) => x + totalOC(o), 0), [vigentes]);

  const mover = (d: -1 | 1) => {
    const [a, m] = mes.split("-").map(Number);
    const f = new Date(a, m - 1 + d, 1);
    setMes(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`);
  };

  const [a, m] = mes.split("-").map(Number);
  const { tope, paso } = escala(Math.max(...valores));
  const ML = 84, MR = 28, MT = 38, MB = 52, H = 360;
  const stepX = 62;
  const W = ML + MR + dias * stepX;
  const x = (i: number) => ML + i * stepX + stepX / 2;
  const y = (v: number) => MT + (H - MT - MB) * (1 - v / tope);
  const ticks = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);
  const linea = valores.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-[var(--gray-200)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h3 className="text-[15px] sm:text-[16px] font-bold text-[var(--navy)] m-0">Gráfica de compras por día</h3>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior" className="w-8 h-8 rounded-lg border border-[var(--gray-200)] bg-white text-[var(--navy)] font-bold">‹</button>
          <span className="min-w-[130px] text-center text-[13px] font-bold text-[var(--navy)]">{MESES[m - 1]} {a}</span>
          <button type="button" onClick={() => mover(1)} disabled={mes >= hoy.slice(0, 7)} aria-label="Mes siguiente" className="w-8 h-8 rounded-lg border border-[var(--gray-200)] bg-white text-[var(--navy)] font-bold disabled:opacity-40">›</button>
        </div>
      </div>
      <p className="text-[11.5px] sm:text-[12.5px] text-[var(--gray-400)] m-0 mb-3">Monto de las órdenes de compra por día: artículos + combustible + viáticos (pendientes y autorizadas; no cuenta las rechazadas).</p>

      <div className="overflow-x-auto border border-[var(--gray-200)] rounded-lg">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Compras por día de ${MESES[m - 1]} ${a}`} className="block max-w-none">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke="#e5e8ef" strokeWidth={1} />
              <text x={ML - 10} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#6b7280">{peso(t)}</text>
            </g>
          ))}
          <line x1={ML} x2={ML} y1={MT} y2={H - MB} stroke="#9aa3b8" />
          <line x1={ML} x2={W - MR} y1={H - MB} y2={H - MB} stroke="#9aa3b8" />
          <text x={14} y={(MT + H - MB) / 2} transform={`rotate(-90 14 ${(MT + H - MB) / 2})`} textAnchor="middle" fontSize={11} fontWeight={700} fill="#16215c">Monto ($)</text>
          <text x={(ML + W - MR) / 2} y={H - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill="#16215c">Día del mes</text>
          {valores.map((_, i) => {
            const dow = new Date(a, m - 1, i + 1).getDay();
            return (
              <g key={i}>
                <text x={x(i)} y={H - MB + 16} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#16215c">{i + 1}</text>
                <text x={x(i)} y={H - MB + 29} textAnchor="middle" fontSize={9.5} fill={dow === 0 || dow === 6 ? "#e2412c" : "#9aa3b8"}>{SEM[dow]}</text>
              </g>
            );
          })}
          <path d={linea} fill="none" stroke="#1d4ed8" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {valores.map((v, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(v)} r={v > 0 ? 5 : 3} fill={v > 0 ? "#fff" : "#1d4ed8"} stroke="#1d4ed8" strokeWidth={2.5}>
                <title>{`${i + 1} de ${MESES[m - 1]}: ${moneda(v)}`}</title>
              </circle>
              {v > 0 && <text x={x(i)} y={y(v) - 12} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1d4ed8">{peso(v)}</text>}
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <span className="inline-flex items-baseline gap-2 rounded-full bg-[#1d4ed8] text-white px-5 py-2">
          <span className="text-[12px] font-medium opacity-90">Total de compras de {MESES[m - 1]}</span>
          <b className="text-[17px]">{moneda(totalMes)}</b>
        </span>
        <span className="text-[12.5px] text-[var(--gray-500)]">{ordenesMes} orden(es) en el mes · Acumulado de todas las compras: <b className="text-[var(--navy)]">{moneda(totalGeneral)}</b></span>
      </div>
    </div>
  );
}
