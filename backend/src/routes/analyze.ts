import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { ingestFromGithub, ingestFromZip, cleanupIngest } from "../lib/ingest";
import { detectTechStack, generateDocumentation, generateDiagrams, generateThesisAnalysis } from "../lib/openrouter";
import { readTempZip, deleteTempZip } from "../lib/tempZipStore";

const router = Router();

// POST /api/projects/:id/analyze — kick off analysis pipeline
router.post("/:id/analyze", authenticate, async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project || project.userId !== req.user!.id) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Mark as running, then process async
  await prisma.project.update({ where: { id: project.id }, data: { status: "ingesting", errorMessage: null } });

  runPipeline(project.id).catch(async (err) => {
    console.error(`[analyze:${project.id}]`, err);
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "failed", errorMessage: err instanceof Error ? err.message : "Unknown error" },
    }).catch(() => {});
  });

  res.json({ status: "started" });
});

async function runPipeline(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  let rootDir: string | undefined;

  try {
    const ingestResult =
      project.sourceType === "github"
        ? await ingestFromGithub(project.sourceRef, process.env.GITHUB_TOKEN)
        : await ingestFromZip(await readTempZip(project.id));

    rootDir = ingestResult.rootDir;
    const { fileTree, files } = ingestResult;

    if (files.length === 0) {
      throw new Error("No readable source files were found in this project.");
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "analyzing", fileTree: JSON.stringify(fileTree.slice(0, 500)) },
    });

    const techStack = await detectTechStack(fileTree, files);
    const documentation = await generateDocumentation(fileTree, files, techStack);
    const diagrams = await generateDiagrams(fileTree, files, techStack, documentation);
    const thesisAnalysis = await generateThesisAnalysis(fileTree, files, techStack, documentation);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "completed",
        techStack: JSON.stringify(techStack),
        documentation: JSON.stringify(documentation),
        diagrams: JSON.stringify(diagrams),
        thesisAnalysis: JSON.stringify(thesisAnalysis),
      },
    });
  } finally {
    if (rootDir) await cleanupIngest(rootDir);
    if (project.sourceType === "zip") await deleteTempZip(project.id);
  }
}

export default router;
