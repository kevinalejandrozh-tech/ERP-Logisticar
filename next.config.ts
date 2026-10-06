import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo se activa al construir la imagen Docker (BUILD_STANDALONE=1); Vercel no se ve afectado.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
};

export default nextConfig;
