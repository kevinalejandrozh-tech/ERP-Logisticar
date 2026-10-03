// Estado del modo edición (solo sysadmin), compartido entre componentes del navegador.
const CLAVE = "logisticar-modo-edicion";
export const EVENTO_MODO = "modo-edicion-cambio";

export function modoEdicionActivo(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

export function cambiarModoEdicion(activo: boolean) {
  try {
    if (activo) window.localStorage.setItem(CLAVE, "1");
    else window.localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new Event(EVENTO_MODO));
}
