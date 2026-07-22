import OpenAI from "openai";
import type { IngestedFile } from "./ingest";

const apiKey = process.env.OPENROUTER_API_KEY;
const modelName = process.env.OPENROUTER_MODEL || "openai/gpt-4o";
const maxTokensRaw = parseInt(process.env.OPENROUTER_MAX_TOKENS || "4000", 10);
const maxTokens = isNaN(maxTokensRaw) || maxTokensRaw < 1 ? 4000 : maxTokensRaw;

function getClient() {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set. Add it to your .env file.");
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": process.env.APP_URL || "https://prodocu.app",
      "X-Title": "ProDocu",
    },
  });
}

function buildProjectContext(fileTree: string[], files: IngestedFile[]): string {
  const treePreview = fileTree.slice(0, 500).join("\n");
  const filesPreview = files
    .map((f) => `----- FILE: ${f.path} -----\n${f.content}`)
    .join("\n\n");
  return `PROJECT FILE TREE (partial):\n${treePreview}\n\nKEY FILE CONTENTS:\n${filesPreview}`;
}

const MAX_RETRIES = 5;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const err = error as Record<string, unknown>;
      const statusCode =
        typeof err?.status === "number"
          ? err.status
          : typeof (err as any)?.statusCode === "number"
            ? (err as any).statusCode
            : undefined;
      const isRateLimit =
        statusCode === 429 ||
        (typeof err?.message === "string" &&
          (/429|Too Many Requests|quota exceeded|rate.limit/i.test(err.message as string)));
      if (!isRateLimit || attempt === MAX_RETRIES - 1) {
        throw error;
      }
      const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      console.warn(
        `[OpenRouter] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}). ` +
          `Retrying in ${Math.round(delayMs)}ms...`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

export interface TechStack {
  languages: string[];
  frameworks: string[];
  databases: string[];
  buildTools: string[];
  testingTools: string[];
  architecturePattern: string;
  summary: string;
}

export interface Documentation {
  overview: string;
  architecture: string;
  folderStructure: string;
  setupInstructions: string;
  keyModules: { name: string; description: string }[];
  apiEndpoints: { method: string; path: string; description: string }[];
  dataModels: { name: string; description: string; fields: string[] }[];
  deploymentNotes: string;
}

export interface DiagramSpec {
  title: string;
  type: string;
  mermaidCode: string;
}

export interface ThesisAnalysis {
  abstract: string;
  theoreticalBackground: string;
  designRationale: { title: string; discussion: string }[];
  knownIssues: { area: string; title: string; description: string; impact: string; proposedSolution: string }[];
  futureWork: { title: string; description: string; priority: string }[];
  references: { title: string; authors: string; year: string; source: string }[];
}

async function jsonCompletion<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const client = getClient();
  const completion = await withRetry(() =>
    client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    })
  );
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned empty response");
  return JSON.parse(text) as T;
}

export async function detectTechStack(fileTree: string[], files: IngestedFile[]): Promise<TechStack> {
  const systemPrompt = `You are a senior software architect analyzing a project's technology stack.\n\nYou MUST respond with ONLY valid JSON — no markdown, no extra text, no code fences — using this exact structure:\n{\n  "languages": ["..."],\n  "frameworks": ["..."],\n  "databases": ["..."],\n  "buildTools": ["..."],\n  "testingTools": ["..."],\n  "architecturePattern": "...",\n  "summary": "..."\n}`;
  const userPrompt = `${buildProjectContext(fileTree, files)}\n\nReturn a precise JSON assessment of: programming languages used, frameworks/libraries, databases or storage systems, build/package tools, testing tools, the overall architecture pattern (e.g. "MVC monolith", "microservices", "JAMstack SPA + REST API", "layered architecture"), and a 2-3 sentence summary of what this project does.`;

  return jsonCompletion<TechStack>(systemPrompt, userPrompt);
}

export async function generateDocumentation(fileTree: string[], files: IngestedFile[], techStack: TechStack): Promise<Documentation> {
  const systemPrompt = `You are a senior technical writer producing an academic-quality software documentation chapter for a thesis or engineering report. Write with depth, precision, and analytical rigor.\n\nYou MUST respond with ONLY valid JSON — no markdown, no extra text, no code fences — using this exact structure:\n{\n  "overview": "...",\n  "architecture": "...",\n  "folderStructure": "...",\n  "setupInstructions": "...",\n  "keyModules": [{ "name": "...", "description": "..." }],\n  "apiEndpoints": [{ "method": "...", "path": "...", "description": "..." }],\n  "dataModels": [{ "name": "...", "description": "...", "fields": ["..."] }],\n  "deploymentNotes": "..."\n}`;
  const userPrompt = `Detected tech stack: ${JSON.stringify(techStack)}\n\n${buildProjectContext(fileTree, files)}\n\nWrite comprehensive, thesis-quality documentation with substantial depth (target 2000+ words total across all fields). Each section must be thorough:\n\n- overview: what the project does, its domain context, target audience, and problem statement (5-8 sentences, like an academic abstract)\n- architecture: a deep architectural analysis -- how the system is structured, component interactions, data flow, design patterns used, and rationale for key structural choices. Reference actual files/folders you saw. (3-5 paragraphs)\n- folderStructure: a detailed explanation of each top-level folder/file's purpose, organized hierarchically (3-5 paragraphs of prose)\n- setupInstructions: exhaustive step-by-step local setup, including dependencies, environment variables, configuration, and verification steps. Infer from config files. (as a single string, 5+ steps)\n- keyModules: the most important files/modules/classes, what each does, and what design pattern or role each serves (6-12 items)\n- apiEndpoints: every HTTP route/endpoint found, with method, path, and detailed description including request/response shape where discernible\n- dataModels: every database model/schema found, with all fields, types, constraints, and relationships described\n- deploymentNotes: a thorough deployment guide -- infrastructure needs, CI/CD pipeline inferred from config, production considerations, scaling notes\n\nGround everything in the actual code shown. This is for a thesis -- write with academic rigour.`;

  return jsonCompletion<Documentation>(systemPrompt, userPrompt);
}

export async function generateDiagrams(fileTree: string[], files: IngestedFile[], techStack: TechStack, documentation: Documentation): Promise<DiagramSpec[]> {
  const systemPrompt = `You are a software architect producing academic-quality UML diagrams for a thesis document, using Mermaid.js syntax.\n\nYou MUST respond with ONLY valid JSON — no markdown, no extra text, no code fences — using this exact structure:\n{\n  "diagrams": [\n    {\n      "title": "...",\n      "type": "architecture|class|sequence|er|state|flowchart",\n      "mermaidCode": "..."\n    }\n  ]\n}`;
  const userPrompt = `Tech stack: ${JSON.stringify(techStack)}\nArchitecture: ${documentation.architecture}\nData models: ${JSON.stringify(documentation.dataModels)}\nAPI endpoints: ${JSON.stringify(documentation.apiEndpoints)}\nFolder structure: ${documentation.folderStructure}\nKey modules: ${JSON.stringify(documentation.keyModules)}\n\n${buildProjectContext(fileTree, files)}\n\nProduce 5-7 Mermaid diagrams that comprehensively explain this project for a thesis audience. Include at least these types where applicable, selecting the most meaningful ones for THIS project:\n\n1. **High-level architecture / component diagram** (graph TD or flowchart LR) — show the system's major components, their connections, and data flow direction. Use subgraphs for logical groupings (e.g. "Frontend", "Backend", "Database"). This should be the most detailed and informative diagram.\n\n2. **UML class diagram** (classDiagram) — show the main classes, interfaces, their attributes, methods, and relationships (inheritance, composition, association, dependency). Map real types from the code.\n\n3. **UML sequence diagram** (sequenceDiagram) — pick the most important flow through the system (e.g. "User Registration Flow", "API Request Pipeline", "File Upload Process"). Show actors, components, and timed message exchanges with alt/opt fragments where applicable.\n\n4. **Entity-Relationship diagram** (erDiagram) — required if the project uses a database. Show entities, their attributes with types, and relationships (one-to-many, many-to-many).\n\n5. **State diagram** (stateDiagram-v2) — show the lifecycle of the most important object/session/process (e.g. "Project Analysis Pipeline Lifecycle", "User Session States").\n\n6. **Additional UML or flowchart diagram** (classDiagram, sequenceDiagram, or flowchart) — choose another meaningful view of the system.\n\nRules:\n- Each "mermaidCode" value must be syntactically valid Mermaid code with NO markdown code fences; just the raw Mermaid syntax starting with the diagram keyword.\n- Keep node labels concise but descriptive.\n- Use Mermaid styling (fill colors, stroke styles) to make diagrams visually informative.\n- If a diagram type does NOT apply to this project (e.g. ER diagram with no database), skip it and add a different meaningful diagram instead.`;

  const result = await jsonCompletion<{ diagrams: DiagramSpec[] }>(systemPrompt, userPrompt);
  return result.diagrams;
}

export async function generateThesisAnalysis(fileTree: string[], files: IngestedFile[], techStack: TechStack, documentation: Documentation): Promise<ThesisAnalysis> {
  const systemPrompt = `You are a senior software engineering researcher writing a critical analysis chapter for a thesis.\n\nYou MUST respond with ONLY valid JSON — no markdown, no extra text, no code fences — using this exact structure:\n{\n  "abstract": "...",\n  "theoreticalBackground": "...",\n  "designRationale": [{ "title": "...", "discussion": "..." }],\n  "knownIssues": [{ "area": "...", "title": "...", "description": "...", "impact": "...", "proposedSolution": "..." }],\n  "futureWork": [{ "title": "...", "description": "...", "priority": "high|medium|low" }],\n  "references": [{ "title": "...", "authors": "...", "year": "...", "source": "..." }]\n}`;
  const userPrompt = `Write a comprehensive thesis analysis chapter for this project.\n\nTech stack: ${JSON.stringify(techStack)}\nArchitecture: ${documentation.architecture}\nKey modules: ${JSON.stringify(documentation.keyModules)}\nAPI endpoints: ${JSON.stringify(documentation.apiEndpoints)}\nData models: ${JSON.stringify(documentation.dataModels)}\nFolder structure: ${documentation.folderStructure}\nSetup instructions: ${documentation.setupInstructions}\nDeployment notes: ${documentation.deploymentNotes}\n\n${buildProjectContext(fileTree, files)}\n\nWrite the following sections with depth and academic rigour (target 3000+ words total):\n\n1. **abstract**: A formal academic abstract (150-250 words) summarizing the project, its purpose, architecture, methodology, key findings, and significance.\n\n2. **theoreticalBackground**: 3-5 paragraphs discussing the theoretical foundations and related work. Cover:\n   - The domain/problem space and why it matters\n   - Relevant software engineering principles and patterns visible in the project\n   - How this project compares to similar tools or approaches in the field\n   - The architectural paradigms employed (e.g., REST, JAMstack, MVC, microservices) and their theoretical basis\n\n3. **designRationale**: 3-6 design decisions with analysis. For each:\n   - **title**: The decision being analyzed (e.g. "Authentication Strategy", "State Management Approach", "Database Selection")\n   - **discussion**: Why this approach was chosen, alternatives considered, trade-offs accepted, and how it aligns with project goals\n\n4. **knownIssues**: Critically analyze the codebase and identify 3-6 real issues or limitations. Look for:\n   - Authentication / session management issues (e.g., sign-out not invalidating session tokens properly, token expiry handling gaps, missing refresh token rotation)\n   - Error handling gaps\n   - Security considerations (e.g., missing rate limiting, lack of input sanitization in certain paths)\n   - Performance bottlenecks\n   - Code quality concerns\n   - Missing tests or test coverage gaps\n   - Dependency or compatibility issues\n   - Missing environment variable validation at startup\n\n   IMPORTANT: For each issue, be specific about where in the codebase the issue manifests.\n\n5. **futureWork**: 3-5 recommendations for future development. Each with a priority.\n\n6. **references**: 4-8 academic or technical references that are relevant to this project's domain or technology choices. Include proper citation format.\n\nGround every claim in the actual code shown. Be honest and critical - this is a thesis analysis, not marketing copy.`;

  return jsonCompletion<ThesisAnalysis>(systemPrompt, userPrompt);
}
