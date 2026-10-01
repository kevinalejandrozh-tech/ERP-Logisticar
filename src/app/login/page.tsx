"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const destino = params.get("destino") || "/";
  const [usuario, setUsuario] = useState("");
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
        body: JSON.stringify({ usuario, password }),
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
    <div className="min-h-screen flex items-center justify-center bg-[var(--gray-50)] px-4">
      <div className="w-full max-w-[380px] bg-white border border-[var(--gray-200)] rounded-lg shadow-[0_4px_20px_rgba(22,33,92,0.06)] p-8">
        <div className="flex flex-col items-center mb-6">
          <Logo size={54} enlace={false} />
          <p className="font-display font-medium text-[var(--red)] text-[12px] tracking-[0.12em] mt-3">TRANSPORTES LOGISTICAR</p>
          <h1 className="font-display font-medium text-[var(--navy)] text-[20px] mt-1.5">Iniciar sesión</h1>
        </div>
        <form onSubmit={iniciarSesion} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-[12.5px] font-medium text-[var(--text)] mb-1.5">Usuario</label>
            <input
              type="text"
              required
              autoFocus
              autoCapitalize="characters"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="NOMBRE COMPLETO o correo"
              className="w-full border border-[var(--gray-300)] rounded-md px-3 py-2.5 text-[14px]"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-[var(--text)] mb-1.5">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-[var(--gray-300)] rounded-md px-3 py-2.5 text-[14px]"
            />
          </div>
          {error && <p className="text-[12.5px] text-[var(--red)] font-medium">{error}</p>}
          <button
            type="submit"
            disabled={cargando}
            className="btn btn-primario mt-2 w-full py-3 text-[14px]"
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
