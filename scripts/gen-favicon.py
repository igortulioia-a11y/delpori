"""
Gera favicon.ico multisize + apple-icon.png + icon.png a partir do
PNG original do logo, SEM recortar nada. Apenas adiciona padding
transparente pra virar quadrado, preservando 100% do arquivo original.

Uso:
    python scripts/gen-favicon.py

Fluxo:
    1. Carrega o PNG fonte (com transparencia)
    2. Detecta bbox do conteudo (pixels nao-transparentes)
    3. Recorta o bbox exato (remove o excesso de fundo preto/transparente)
    4. Coloca num canvas quadrado com padding transparente
    5. Gera icon.png 512, apple-icon.png 180 e favicon.ico multisize
"""
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DIR = os.path.join(ROOT, "src", "app")
SRC = r"C:/Users/igort/OneDrive/Desktop/Delpori/Imagens/icone.png"


def load_and_square(path: str) -> Image.Image:
    """
    Carrega o PNG, detecta o bbox do conteudo (pixels nao-transparentes),
    recorta so o bbox (sem perder nada do logo) e coloca num canvas
    quadrado com padding transparente. Resultado: imagem quadrada
    com fundo transparente e o logo 100% preservado.
    """
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:, :, 3]
    mask = alpha > 10

    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]

    # Recorta so o conteudo (remove fundo transparente nas bordas)
    content = img.crop((cmin, rmin, cmax + 1, rmax + 1))
    cw, ch = content.size
    side = max(cw, ch)

    # Padding de 8% pra respirar visualmente
    pad = int(side * 0.08)
    canvas_side = side + 2 * pad

    # Canvas quadrado transparente, logo centralizado
    canvas = Image.new("RGBA", (canvas_side, canvas_side), (0, 0, 0, 0))
    dx = (canvas_side - cw) // 2
    dy = (canvas_side - ch) // 2
    canvas.paste(content, (dx, dy), content)
    return canvas


def main() -> None:
    print(f"Loading {SRC}...")
    square = load_and_square(SRC)
    print(f"  squared to {square.size}")

    # Tamanhos de saida
    sizes = {
        "icon.png": 512,
        "apple-icon.png": 180,
    }

    for name, size in sizes.items():
        out = square.resize((size, size), Image.LANCZOS)
        path = os.path.join(APP_DIR, name)
        out.save(path, "PNG", optimize=True)
        print(f"  wrote {path} ({size}x{size}, {os.path.getsize(path)} bytes)")

    # favicon.ico multisize
    ico_sizes = [16, 32, 48, 64]
    ico_imgs = [square.resize((s, s), Image.LANCZOS) for s in ico_sizes]
    favicon_path = os.path.join(APP_DIR, "favicon.ico")
    ico_imgs[0].save(
        favicon_path,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_imgs[1:],
    )
    print(f"  wrote {favicon_path} ({os.path.getsize(favicon_path)} bytes)")


if __name__ == "__main__":
    main()
