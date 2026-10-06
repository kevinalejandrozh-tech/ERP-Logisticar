import { ImageResponse } from "next/og";

// Imagen que se ve al compartir el sitio en WhatsApp, Facebook, LinkedIn, etc. (1200×630).
export const alt = "Transportes Logisticar — transporte de carga terrestre";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 80px",
          background: "linear-gradient(135deg, #0b1f3a 0%, #14346a 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", width: 120, height: 10, background: "#d62828", marginBottom: 36 }} />
        <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>Transportes Logisticar</div>
        <div style={{ display: "flex", fontSize: 40, marginTop: 28, color: "#dbe6f7" }}>Transporte de carga terrestre en México</div>
        <div style={{ display: "flex", fontSize: 30, marginTop: 40, color: "#9fb6d9" }}>
          Guadalajara · Monterrey · Chihuahua · Monitoreo GPS
        </div>
      </div>
    ),
    { ...size },
  );
}
