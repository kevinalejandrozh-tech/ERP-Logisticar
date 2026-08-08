export function compressImage(file: File, maxWidth = 900, quality = 0.6): Promise<string> {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
reader.onload = () => {
const img = new Image();
img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
img.onload = () => {
let { width, height } = img;
if (width > maxWidth) {
height = Math.round((height * maxWidth) / width);
width = maxWidth;
}
const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext("2d");
if (!ctx) {
resolve(reader.result as string);
return;
}
ctx.drawImage(img, 0, 0, width, height);
resolve(canvas.toDataURL("image/jpeg", quality));
};
img.src = reader.result as string;
};
reader.readAsDataURL(file);
});
}

export function rotarImagen(dataUrl: string, grados: 90 | -90): Promise<string> {
return new Promise((resolve, reject) => {
const img = new Image();
img.onerror = () => reject(new Error("No se pudo rotar la imagen."));
img.onload = () => {
const canvas = document.createElement("canvas");
canvas.width = img.height;
canvas.height = img.width;
const ctx = canvas.getContext("2d");
if (!ctx) {
resolve(dataUrl);
return;
}
ctx.translate(canvas.width / 2, canvas.height / 2);
ctx.rotate((grados * Math.PI) / 180);
ctx.drawImage(img, -img.width / 2, -img.height / 2);
resolve(canvas.toDataURL("image/jpeg", 0.8));
};
img.src = dataUrl;
});
}
