/**
 * Helper de canvas pra recortar uma imagem baseado em area de crop
 * (tipicamente vinda do react-easy-crop) e devolver um Blob JPEG comprimido.
 *
 * Uso: apos o usuario ajustar o crop no ImageCropDialog, chamar essa
 * funcao com o src da imagem original e a area retornada pelo
 * callback `onCropComplete` do Cropper. Resultado e um Blob pronto
 * pra upload no Supabase Storage.
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Recorta uma imagem e retorna o resultado como Blob JPEG comprimido.
 *
 * @param imageSrc URL da imagem (object URL de um File, ou URL normal)
 * @param cropArea Area de crop em pixels da imagem original
 * @param maxSize Lado maximo do output em pixels (default 800, mantem proporcao)
 * @param quality Qualidade do JPEG de 0 a 1 (default 0.85)
 */
export async function getCroppedBlob(
  imageSrc: string,
  cropArea: CropArea,
  maxSize = 800,
  quality = 0.85,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context nao disponivel");

  // Limita ao maxSize mantendo a proporcao do crop
  const scale = Math.min(1, maxSize / Math.max(cropArea.width, cropArea.height));
  canvas.width = Math.round(cropArea.width * scale);
  canvas.height = Math.round(cropArea.height * scale);

  // Fundo branco pra imagens com transparencia (PNG) ficarem OK em JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Falha ao gerar imagem recortada"));
      },
      "image/jpeg",
      quality,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Permite carregar imagens de outras origens (e.g., Supabase Storage)
    // sem tintar o canvas. Object URLs de File nao precisam disso.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = src;
  });
}
