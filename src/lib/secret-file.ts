import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";

/** Répertoire persistant (volume /data/storage) lisible seulement par le compte du conteneur. */
function secretsDir() {
  const root = process.env.STORAGE_LOCAL_DIR || join(/*turbopackIgnore: true*/ process.cwd(), "storage");
  return join(root, ".secrets");
}

/**
 * Écrit un secret à usage unique (mot de passe provisoire) dans un fichier 0600 plutôt que dans les journaux,
 * souvent collectés ou partagés. Renvoie le chemin, ou null si l'écriture est impossible.
 */
export async function writeSecretFile(name: string, content: string) {
  try {
    const dir = secretsDir();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const path = join(dir, name);
    await writeFile(path, `${content}\n`, { mode: 0o600 });
    return path;
  } catch {
    return null;
  }
}

/** Le secret a servi (mot de passe changé) : le fichier n'a plus de raison d'exister. */
export async function deleteSecretFile(name: string) {
  await rm(join(secretsDir(), name), { force: true }).catch(() => undefined);
}
