// Tareas de fondo del servidor. Se ejecuta una vez al iniciar Next.js.
// Reloj checador: sincroniza las checadas cada minuto (solo si el reloj está configurado).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.BIOMETRICO_IP || !process.env.BIOMETRICO_PASSWORD || !process.env.DATABASE_URL) return;

  const { sincronizarReloj } = await import("./lib/biometricoSync");
  const ciclo = () => {
    sincronizarReloj()
      .then((r) => {
        if (!r.ok) console.warn("[reloj checador]", r.error);
        else if (r.nuevas) console.log(`[reloj checador] ${r.nuevas} checada(s) nueva(s), ${r.dias} día(s) actualizados`);
      })
      .catch((e) => console.warn("[reloj checador]", e instanceof Error ? e.message : e));
  };
  setTimeout(ciclo, 15_000);
  setInterval(ciclo, 60_000);
}
