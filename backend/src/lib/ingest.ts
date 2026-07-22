import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import os from "node:os";
import { v4 as uuid } from "uuid";
import * as tar from "tar";
import AdmZip from "adm-zip";

export interface IngestedFile {
  path: string; // relative path within the project
  content: string; // truncated file content
  size: number;
}

export interface IngestResult {
  rootDir: string; // temp dir to clean up later
  fileTree: string[]; // every relative path found (for display), capped
  files: IngestedFile[]; // actual file contents selected for AI analysis
}

const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out", "vendor",
  "target", ".venv", "venv", "__pycache__", ".idea", ".vscode",
  "coverage", ".turbo", ".cache", "bin", "obj",
]);

// Files whose presence/content is high-signal for tech detection & docs.
const PRIORITY_FILES = new Set([
  "package.json", "requirements.txt", "pyproject.toml", "Pipfile",
  "go.mod", "Cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts",
  "composer.json", "Gemfile", "Dockerfile", "docker-compose.yml",
  "docker-compose.yaml", "README.md", "readme.md", "README", "Makefile",
  ".env.example", "tsconfig.json", "next.config.js", "next.config.ts",
  "vite.config.ts", "vite.config.js", "manage.py", "settings.py",
]);

const SOURCE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".rb", ".java", ".kt",
  ".rs", ".php", ".c", ".cpp", ".h", ".cs", ".swift", ".vue", ".svelte",
  ".sql", ".graphql", ".yml", ".yaml", ".json",
]);

const MAX_FILE_BYTES = 6_000;   // truncate any single file beyond this
const MAX_TOTAL_FILES = 60;    // candidate pool size before budget trim
const MAX_TOTAL_CHARS = 30_000; // total content budget across ALL selected files
const MAX_TREE_ENTRIES = 300;  // file tree entries for display

/** Downloads a public GitHub repo as a tarball (no git binary required) and extracts it. */
export async function ingestFromGithub(repoUrl: string, githubToken?: string): Promise<IngestResult> {
  const { owner, repo } = parseGithubUrl(repoUrl);

  const headers: Record<string, string> = { "User-Agent": "prodocu-app" };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!metaRes.ok) {
    throw new Error(`Could not find GitHub repo "${owner}/${repo}" (status ${metaRes.status}). Is it public?`);
  }
  const meta: { default_branch?: string } = await metaRes.json() as { default_branch?: string };
  const branch = meta.default_branch || "main";

  const tarballUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${branch}`;
  const tarRes = await fetch(tarballUrl);
  if (!tarRes.ok || !tarRes.body) {
    throw new Error(`Failed to download tarball for ${owner}/${repo}@${branch}`);
  }

  const rootDir = await makeTempDir();
  const tarPath = path.join(rootDir, "repo.tar.gz");
  const buf = Buffer.from(await tarRes.arrayBuffer());
  await fs.writeFile(tarPath, buf);

  const extractDir = path.join(rootDir, "extracted");
  await fs.mkdir(extractDir, { recursive: true });
  await tar.x({ file: tarPath, cwd: extractDir });

  // GitHub tarballs extract into a single "<repo>-<branch>" folder
  const entries = await fs.readdir(extractDir);
  const projectDir = entries.length === 1 ? path.join(extractDir, entries[0]) : extractDir;

  return walkAndSelect(rootDir, projectDir);
}

/** Extracts an uploaded zip archive (given as a Buffer) into a temp dir. */
export async function ingestFromZip(zipBuffer: Buffer): Promise<IngestResult> {
  const rootDir = await makeTempDir();
  const extractDir = path.join(rootDir, "extracted");
  await fs.mkdir(extractDir, { recursive: true });

  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(extractDir, true);

  // Some zips wrap everything in a single top-level folder; unwrap if so.
  const entries = await fs.readdir(extractDir);
  const onlyEntry = entries.length === 1 ? path.join(extractDir, entries[0]) : extractDir;
  const projectDir = fssync.statSync(onlyEntry).isDirectory() ? onlyEntry : extractDir;

  return walkAndSelect(rootDir, projectDir);
}

async function walkAndSelect(rootDir: string, projectDir: string): Promise<IngestResult> {
  const fileTree: string[] = [];
  const candidates: { rel: string; abs: string; priority: number }[] = [];

  async function walk(dir: string) {
    if (fileTree.length >= MAX_TREE_ENTRIES) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (fileTree.length >= MAX_TREE_ENTRIES) break;
      if (entry.name.startsWith(".") && !PRIORITY_FILES.has(entry.name)) {
        if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
      }
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        await walk(path.join(dir, entry.name));
      } else {
        const abs = path.join(dir, entry.name);
        const rel = path.relative(projectDir, abs);
        fileTree.push(rel);

        const ext = path.extname(entry.name);
        if (PRIORITY_FILES.has(entry.name)) {
          candidates.push({ rel, abs, priority: 0 });
        } else if (SOURCE_EXTENSIONS.has(ext)) {
          candidates.push({ rel, abs, priority: 1 });
        }
      }
    }
  }

  await walk(projectDir);

  candidates.sort((a, b) => a.priority - b.priority || a.rel.length - b.rel.length);

  // Select files respecting both the count cap and a total character budget
  const files: IngestedFile[] = [];
  let totalChars = 0;
  for (const c of candidates) {
    if (files.length >= MAX_TOTAL_FILES) break;
    try {
      const stat = await fs.stat(c.abs);
      const raw = await fs.readFile(c.abs, "utf-8").catch(() => null);
      if (raw === null) continue; // binary file, skip

      const truncated =
        raw.length > MAX_FILE_BYTES
          ? raw.slice(0, MAX_FILE_BYTES) + "\n... [truncated]"
          : raw;

      // Check if adding this file would exceed the total char budget
      if (totalChars + truncated.length > MAX_TOTAL_CHARS) {
        if (files.length === 0) {
          // At least include the single most important file
          files.push({ path: c.rel, content: truncated.slice(0, MAX_TOTAL_CHARS), size: stat.size });
        }
        break;
      }

      files.push({ path: c.rel, content: truncated, size: stat.size });
      totalChars += truncated.length;
    } catch {
      // unreadable file, skip
    }
  }

  return { rootDir, fileTree, files };
}

export async function cleanupIngest(rootDir: string) {
  await fs.rm(rootDir, { recursive: true, force: true }).catch(() => {});
}

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `prodocu-${uuid()}-`));
}

function parseGithubUrl(input: string): { owner: string; repo: string } {
  const cleaned = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/i);
  if (!match) throw new Error("That doesn't look like a valid GitHub repository URL.");
  return { owner: match[1], repo: match[2] };
}
