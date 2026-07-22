import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { writeTempZip } from "../lib/tempZipStore";
import multer from "multer";

const router = Router();
const upload = multer({ limits: { fileSize: Number(process.env.MAX_ZIP_SIZE_MB || 50) * 1024 * 1024 } });

// GET /api/projects — list user's projects
router.get("/", authenticate, async (req: Request, res: Response) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, sourceType: true, sourceRef: true,
      status: true, errorMessage: true, createdAt: true, updatedAt: true,
    },
  });
  res.json({ projects });
});

// POST /api/projects — create project from GitHub URL or zip upload
router.post("/", authenticate, upload.single("file"), async (req: Request, res: Response) => {
  if (req.file) {
    // Zip upload
    const name = (req.body.name as string || "").trim();
    const file = req.file;

    const project = await prisma.project.create({
      data: {
        userId: req.user!.id,
        name: name || file.originalname.replace(/\.zip$/, ""),
        sourceType: "zip",
        sourceRef: file.originalname,
        status: "pending",
      },
    });

    await writeTempZip(project.id, file.buffer);

    res.status(201).json({ project });
    return;
  }

  // JSON body (GitHub URL)
  const { repoUrl, name: bodyName } = req.body || {};
  const repoUrlTrimmed = (repoUrl || "").trim();
  const nameTrimmed = (bodyName || "").trim();

  if (!repoUrlTrimmed || !/^https?:\/\/(www\.)?github\.com\//i.test(repoUrlTrimmed)) {
    res.status(400).json({ error: "Provide a valid GitHub repository URL" });
    return;
  }

  const inferredName = nameTrimmed || repoUrlTrimmed.replace(/\/$/, "").split("/").slice(-1)[0];

  const project = await prisma.project.create({
    data: {
      userId: req.user!.id,
      name: inferredName,
      sourceType: "github",
      sourceRef: repoUrlTrimmed,
      status: "pending",
    },
  });

  res.status(201).json({ project });
});

// GET /api/projects/:id — get single project detail
router.get("/:id", authenticate, async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project || project.userId !== req.user!.id) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({
    ...project,
    techStack: project.techStack ? JSON.parse(project.techStack) : null,
    documentation: project.documentation ? JSON.parse(project.documentation) : null,
    diagrams: project.diagrams ? JSON.parse(project.diagrams) : null,
    fileTree: project.fileTree ? JSON.parse(project.fileTree) : null,
    thesisAnalysis: project.thesisAnalysis ? JSON.parse(project.thesisAnalysis) : null,
  });
});

// DELETE /api/projects/:id — delete a project
router.delete("/:id", authenticate, async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project || project.userId !== req.user!.id) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await prisma.project.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
