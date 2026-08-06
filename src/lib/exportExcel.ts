export async function exportarExcel(
  nombreArchivo: string,
  hojas: { nombre: string; filas: Record<string, unknown>[] }[]
) {
  const XLSX = await import("xlsx");
  const libro = XLSX.utils.book_new();
  hojas.forEach((h) => {
    const datos = h.filas.length ? h.filas : [{ " ": "" }];
    const hoja = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.book_append_sheet(libro, hoja, h.nombre.slice(0, 31));
  });
  XLSX.writeFile(libro, nombreArchivo);
}
