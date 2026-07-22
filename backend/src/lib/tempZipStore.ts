import fs from "fs/promises";
import path from "path";
import os from "os";

const STORAGE_DIR = path.join(os.tmpdir(), "prodocu-uploads");

async function ensureDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

function getPath(projectId: string): string {
  return path.join(STORAGE_DIR, `${projectId}.zip`);
}

export async function writeTempZip(projectId: string, buffer: Buffer) {
  await ensureDir();
  await fs.writeFile(getPath(projectId), buffer);
}

export async function readTempZip(projectId: string): Promise<Buffer> {
  return fs.readFile(getPath(projectId));
}

export async function deleteTempZip(projectId: string) {
  await fs.unlink(getPath(projectId)).catch(() => {});
}
