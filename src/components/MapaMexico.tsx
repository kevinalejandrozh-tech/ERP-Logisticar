"use client";
import { COORDENADAS_DESTINO } from "@/lib/monitoreoData";

const VIEW_W = 300;
const VIEW_H = 380;
const LAT_MIN = 14.3;
const LAT_MAX = 32.7;
const LON_MIN = -117.2;
const LON_MAX = -86.6;

function proyectar(lat: number, lon: number): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * VIEW_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * VIEW_H;
  return [x, y];
}

// Contorno esquemático (no cartográfico de precisión) para dar referencia visual del territorio.
const CONTORNO: [number, number][] = [
  [32.53, -117.0], [29.5, -114.5], [23.0, -109.7], [23.25, -106.4], [20.65, -105.23],
  [16.86, -99.89], [15.8, -96.5], [16.17, -95.2], [14.5, -92.2], [16.0, -90.5],
  [18.5, -88.3], [21.16, -86.85], [21.5, -89.6], [18.65, -91.8], [18.14, -94.42],
  [22.24, -97.86], [25.87, -97.5], [27.48, -99.51], [28.7, -100.52], [29.8, -103.0],
  [31.69, -106.42], [31.33, -108.2], [31.33, -111.0], [32.0, -113.3], [32.62, -115.45],
  [32.53, -117.0],
];

export default function MapaMexico({ conteos }: { conteos: Record<string, number> }) {
  const puntos = CONTORNO.map(([lat, lon]) => proyectar(lat, lon).join(",")).join(" ");
  const valores = Object.values(conteos);
  const maxConteo = valores.length ? Math.max(...valores) : 1;

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-full">
      <polygon points={puntos} fill="#e2e7f2" stroke="#9aa1b0" strokeWidth={1.2} />
      {Object.entries(conteos).map(([destino, n]) => {
        const coords = COORDENADAS_DESTINO[destino];
        if (!coords || n <= 0) return null;
        const [x, y] = proyectar(coords[0], coords[1]);
        const r = 3 + (n / maxConteo) * 9;
        return (
          <g key={destino}>
            <circle cx={x} cy={y} r={r} fill="rgba(226,65,44,0.78)" stroke="#fff" strokeWidth={1} />
            <text x={x} y={y - r - 2} fontSize={7} textAnchor="middle" fill="#16215c" fontWeight="bold">
              {n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
