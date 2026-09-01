import { getFullImageUrl, isLikelyImagePath } from "./getFullImageUrl";

/** Tamaño cuadrado estándar para logos en login de empresa y empleados. */
export const LOGO_IMAGE_SIZE = 300;

export type ResizedLogoImage = {
    dataUrl: string;
    base64: string;
};

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("No se pudo leer la imagen"));
        };
        img.src = url;
    });
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo leer la imagen"));
        if (src.startsWith("data:") || src.startsWith("http")) {
            img.src = src;
            return;
        }
        if (isLikelyImagePath(src)) {
            img.src = getFullImageUrl(src);
            return;
        }
        img.src = `data:image/png;base64,${src}`;
    });
}

function drawLogoContain(
    img: HTMLImageElement,
    size: number,
): ResizedLogoImage {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas no disponible");
    }

    ctx.clearRect(0, 0, size, size);

    const scale = Math.min(size / img.width, size / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);

    const dataUrl = canvas.toDataURL("image/png");
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;

    return { dataUrl, base64 };
}

/** Ajusta un archivo de logo a 300×300 (contain, PNG). */
export async function resizeLogoImageFile(
    file: File,
    size: number = LOGO_IMAGE_SIZE,
): Promise<ResizedLogoImage> {
    const img = await loadImageFromFile(file);
    return drawLogoContain(img, size);
}

/** Normaliza logo remoto/base64 para caché de login; rutas URL no se modifican. */
export async function normalizeLogoForLoginCache(
    raw: string,
    size: number = LOGO_IMAGE_SIZE,
): Promise<string> {
    const value = raw.trim();
    if (!value || isLikelyImagePath(value)) {
        return value;
    }

    try {
        const img = await loadImageFromSrc(value);
        return drawLogoContain(img, size).base64;
    } catch {
        return value;
    }
}
