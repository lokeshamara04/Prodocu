import { mdToPdf } from "md-to-pdf";
import { buildMarkdown, type ProjectExportData } from "../buildMarkdown";
import { renderMermaidToPng } from "../renderDiagram";

/**
 * Replaces ```mermaid fenced blocks with <img> tags pointing to a rendered
 * PNG (as a data URI), since Puppeteer's PDF print doesn't execute
 * client-side Mermaid JS by default.
 */
async function inlineDiagramImages(markdown: string): Promise<string> {
  const mermaidBlockRegex = /```mermaid\n([\s\S]*?)```/g;
  const matches = [...markdown.matchAll(mermaidBlockRegex)];

  let result = markdown;
  for (const match of matches) {
    const [fullBlock, code] = match;
    try {
      const png = await renderMermaidToPng(code);
      const dataUri = `data:image/png;base64,${png.toString("base64")}`;
      result = result.replace(fullBlock, `<img src="${dataUri}" style="max-width:100%;" />`);
    } catch {
      result = result.replace(fullBlock, `<pre>${code}</pre>`);
    }
  }
  return result;
}

export async function exportPdf(data: ProjectExportData): Promise<Buffer> {
  const rawMarkdown = buildMarkdown(data);
  const markdownWithImages = await inlineDiagramImages(rawMarkdown);

  const pdf = await mdToPdf(
    { content: markdownWithImages },
    {
      css: `
        @page { margin: 25mm 22mm 25mm 22mm; }

        body {
          font-family: "Times New Roman", Georgia, "Palatino Linotype", serif;
          font-size: 12pt;
          line-height: 1.7;
          color: #1a1a1a;
          text-align: justify;
          hyphens: auto;
        }

        h1 {
          font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
          font-size: 22pt;
          border-bottom: 2px solid #2c3e50;
          padding-bottom: 10px;
          margin-top: 36px;
          margin-bottom: 18px;
          color: #2c3e50;
          page-break-after: avoid;
        }

        h2 {
          font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
          font-size: 16pt;
          margin-top: 28px;
          margin-bottom: 12px;
          color: #34495e;
          page-break-after: avoid;
        }

        h3 {
          font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
          font-size: 13pt;
          margin-top: 20px;
          margin-bottom: 8px;
          color: #555;
          page-break-after: avoid;
        }

        p { margin: 8px 0; }

        table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
          font-size: 10pt;
        }
        th, td {
          border: 1px solid #bbb;
          padding: 6px 10px;
          text-align: left;
        }
        th {
          background: #ecf0f1;
          font-weight: 600;
        }
        tr:nth-child(even) { background: #fafafa; }

        code {
          font-family: "Consolas", "Courier New", monospace;
          background: #f4f4f4;
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 10pt;
        }
        pre {
          background: #f7f7f7;
          padding: 12px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 9pt;
          line-height: 1.4;
        }

        img {
          border: 1px solid #ddd;
          border-radius: 4px;
          margin: 12px 0;
          max-width: 100%;
          page-break-inside: avoid;
        }

        blockquote {
          border-left: 4px solid #2c3e50;
          margin: 16px 0;
          padding: 8px 16px;
          background: #f8f9fa;
          color: #555;
          font-style: italic;
        }

        hr {
          border: none;
          border-top: 1px solid #ccc;
          margin: 24px 0;
        }

        ul, ol { margin: 8px 0; }
        li { margin: 4px 0; }
      `,
      pdf_options: {
        format: "A4",
        margin: { top: "25mm", bottom: "25mm", left: "22mm", right: "22mm" },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size:8pt; color:#999; text-align:center; width:100%; padding-top:5mm;"><span class="title"></span></div>',
        footerTemplate: '<div style="font-size:8pt; color:#999; text-align:center; width:100%; padding-bottom:5mm;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      },
      launch_options: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
    }
  );

  if (!pdf || !("content" in pdf)) throw new Error("PDF generation failed");
  return Buffer.from(pdf.content);
}
