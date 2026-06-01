// Persistência das imagens coladas no chat. Salva o base64 em arquivos dentro
// de web/uploads (servido estático em /uploads) e devolve as URLs públicas.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { ImagePart } from "./ai-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// diretório dentro de web/ (web/server -> ../uploads)
export const UPLOADS_DIR = join(__dirname, "../uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

// Tamanho máximo por imagem (bytes decodificados do base64): 10 MB.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Grava cada imagem em disco e retorna as URLs públicas (/uploads/<uuid>.<ext>).
// Lança Error com mensagem descritiva se o tipo for inválido, o tamanho exceder o
// limite ou houver falha de I/O (disco cheio, permissão, etc.).
export function saveImages(images?: ImagePart[]): string[] {
  if (!images?.length) return [];
  const urls: string[] = [];
  for (const img of images) {
    const ext = EXT[img.media_type];
    if (!ext) {
      throw new Error(
        `Tipo de imagem não suportado: "${img.media_type}". ` +
        `Tipos aceitos: PNG, JPEG, GIF, WebP.`
      );
    }
    // Estimativa do tamanho real antes de alocar o Buffer.
    const estimatedBytes = Math.ceil((img.data.length * 3) / 4);
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      const mb = (estimatedBytes / 1024 / 1024).toFixed(1);
      throw new Error(
        `Imagem muito grande: ~${mb} MB. O limite é 10 MB por imagem.`
      );
    }
    let buf: Buffer;
    try {
      buf = Buffer.from(img.data, "base64");
    } catch {
      throw new Error("Dados de imagem inválidos (base64 corrompido).");
    }
    const name = `${randomUUID()}.${ext}`;
    try {
      writeFileSync(join(UPLOADS_DIR, name), buf);
    } catch (err) {
      const detail = (err as NodeJS.ErrnoException).code === "ENOSPC"
        ? "disco cheio"
        : (err as Error).message;
      throw new Error(`Falha ao salvar imagem: ${detail}.`);
    }
    urls.push(`/uploads/${name}`);
  }
  return urls;
}
