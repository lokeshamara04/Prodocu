import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { exportMarkdown } from "../lib/exporters/markdown";
import { exportPdf } from "../lib/exporters/pdf";
import { exportDocx } from "../lib/exporters/docx";
import type { ProjectExportData } from "../lib/buildMarkdown";

const router = Router();

const CONTENT_TYPES: Record<string, string> = {
  md: "text/markdown",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const EXTENSIONS: Record<string, string> = {
  md: ".md",
  pdf: ".pdf",
  docx: ".docx",
};

// GET /api/projects/:id/export?format=md|pdf|docx
router.get("/:id/export", authenticate, async (req: Request, res: Response) => {
  const format = (req.query.format as string) || "md";
  if (!CONTENT_TYPES[format]) {
    res.status(400).json({ error: "format must be one of: md, pdf, docx" });
    return;
  }

  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project || project.userId !== req.user!.id) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (project.status !== "completed" || !project.techStack || !project.documentation) {
    res.status(409).json({ error: "This project hasn't finished analyzing yet" });
    return;
  }

  const exportData: ProjectExportData = {
    name: project.name,
    sourceType: project.sourceType,
    sourceRef: project.sourceRef,
    techStack: JSON.parse(project.techStack),
    documentation: JSON.parse(project.documentation),
    diagrams: project.diagrams ? JSON.parse(project.diagrams) : [],
    thesisAnalysis: project.thesisAnalysis ? JSON.parse(project.thesisAnalysis) : null,
  };

  let buffer: Buffer;
  try {
    buffer =
      format === "pdf" ? await exportPdf(exportData)
      : format === "docx" ? await exportDocx(exportData)
      : await exportMarkdown(exportData);
  } catch (err) {
    console.error(`[export:${project.id}]`, err);
    res.status(500).json({ error: "Export generation failed" });
    return;
  }

  const filename = `${project.name.replace(/[^a-z0-9-_]+/gi, "_")}${EXTENSIONS[format]}`;

  res.setHeader("Content-Type", CONTENT_TYPES[format]);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

export default router;
