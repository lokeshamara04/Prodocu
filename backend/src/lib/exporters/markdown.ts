import { buildMarkdown, type ProjectExportData } from "../buildMarkdown";

export async function exportMarkdown(data: ProjectExportData): Promise<Buffer> {
  return Buffer.from(buildMarkdown(data), "utf-8");
}
