"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const destino = params.get("destino") || "/";
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar sesión.");
      window.location.href = destino;
    } catch (err: any) {
      setError(err.message || "No se pudo iniciar sesión.");
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#dcdfe6] px-4">
      <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-xl p-7">
        <div className="flex flex-col items-center mb-6">
          <Logo size={54} />
          <p className="font-display font-extrabold text-[var(--red)] text-[13px] mt-2">TRANSPORTES LOGISTICAR</p>
          <h1 className="font-display font-extrabold text-[var(--navy)] text-[16px] mt-1">Iniciar sesión</h1>
        </div>
        <form onSubmit={iniciarSesion} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Correo</label>
            <input
              type="email"
              required
              autoFocus
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="correo@transporteslogisticar.com"
              className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]"
            />
          </div>
          <div>
            <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]"
            />
          </div>
          {error && <p className="text-[12px] text-[var(--red)] font-semibold">{error}</p>}
          <button
            type="submit"
            disabled={cargando}
            className="mt-1 bg-[var(--navy)] disabled:opacity-60 text-white font-display font-extrabold uppercase text-[12.5px] tracking-wide rounded-lg py-3"
          >
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
