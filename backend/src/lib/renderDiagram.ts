/**
 * Renders Mermaid diagram source to an image using the public mermaid.ink
 * rendering service (no headless browser / Puppeteer dependency needed).
 */

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

export async function renderMermaidToPng(mermaidCode: string): Promise<Buffer> {
  const encoded = toBase64Url(mermaidCode);
  const url = `https://mermaid.ink/img/${encoded}?type=png&bgColor=white`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Diagram rendering failed (status ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function renderMermaidToSvg(mermaidCode: string): Promise<string> {
  const encoded = toBase64Url(mermaidCode);
  const url = `https://mermaid.ink/svg/${encoded}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Diagram rendering failed (status ${res.status})`);
  return res.text();
}
