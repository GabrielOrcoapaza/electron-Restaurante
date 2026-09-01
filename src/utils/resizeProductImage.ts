/** Tamaño estándar para fotos de producto (grid POS). */
export const PRODUCT_IMAGE_WIDTH = 150;
export const PRODUCT_IMAGE_HEIGHT = 150;

export type ResizedProductImage = {
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

/** Recorta al centro (cover) y redimensiona a 350×195 JPEG. */
export async function resizeProductImageFile(
    file: File,
    width: number = PRODUCT_IMAGE_WIDTH,
    height: number = PRODUCT_IMAGE_HEIGHT,
): Promise<ResizedProductImage> {
    const img = await loadImageFromFile(file);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas no disponible");
    }

    const targetAspect = width / height;
    const srcAspect = img.width / img.height;

    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;

    if (srcAspect > targetAspect) {
        sw = img.height * targetAspect;
        sx = (img.width - sw) / 2;
    } else {
        sh = img.width / targetAspect;
        sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;

    return { dataUrl, base64 };
}
