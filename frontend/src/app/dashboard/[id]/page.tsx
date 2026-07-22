"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import StatusBadge from "@/components/StatusBadge";
import { fetchJson } from "@/lib/fetchJson";

interface TechStack {
  languages: string[]; frameworks: string[]; databases: string[];
  buildTools: string[]; testingTools: string[]; architecturePattern: string; summary: string;
}
interface Documentation {
  overview: string; architecture: string; folderStructure: string; setupInstructions: string;
  keyModules: { name: string; description: string }[];
  apiEndpoints: { method: string; path: string; description: string }[];
  dataModels: { name: string; description: string; fields: string[] }[];
  deploymentNotes: string;
}
interface Diagram { title: string; type: string; mermaidCode: string }
interface ThesisAnalysis {
  abstract: string;
  theoreticalBackground: string;
  designRationale: { title: string; discussion: string }[];
  knownIssues: { area: string; title: string; description: string; impact: string; proposedSolution: string }[];
  futureWork: { title: string; description: string; priority: string }[];
  references: { title: string; authors: string; year: string; source: string }[];
}
interface ProjectDetail {
  id: string; name: string; sourceType: string; sourceRef: string;
  status: string; errorMessage: string | null;
  techStack: TechStack | null; documentation: Documentation | null; diagrams: Diagram[] | null;
  thesisAnalysis: ThesisAnalysis | null;
}

function mermaidToImgSrc(code: string): string {
  const utf8Bytes = encodeURIComponent(code).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  const base64 = btoa(utf8Bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `https://mermaid.ink/svg/${base64}`;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const data: ProjectDetail = await fetchJson(`/api/projects/${id}`);
        if (cancelled) return;
        setProject(data);
        if (data.status === "pending" || data.status === "ingesting" || data.status === "analyzing") {
          timer = setTimeout(poll, 3000);
        }
      } catch {
        // Poll failed — retry
        if (!cancelled) timer = setTimeout(poll, 5000);
      }
    }
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [id]);

  if (!project) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="max-w-4xl mx-auto px-6 py-10 text-slate-500">Loading…</main>
      </div>
    );
  }

  const { status, techStack, documentation, diagrams, thesisAnalysis } = project;
  const isRunning = status === "pending" || status === "ingesting" || status === "analyzing";

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          <StatusBadge status={status} />
        </div>
        <p className="text-sm text-slate-500 mb-8">{project.sourceRef}</p>

        {isRunning && (
          <div className="bg-white border border-slate-100 rounded-xl p-8 text-center">
            <p className="text-slate-600 font-medium mb-1">
              {status === "ingesting" ? "Fetching your project source…" : "Prodocu is analyzing your codebase…"}
            </p>
            <p className="text-slate-400 text-sm">This usually takes 45–120 seconds depending on project size (generating thesis-quality documentation).</p>
          </div>
        )}

        {status === "failed" && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-red-700">
            <p className="font-medium mb-1">Analysis failed</p>
            <p className="text-sm">{project.errorMessage}</p>
          </div>
        )}

        {status === "completed" && techStack && documentation && (
          <div className="space-y-8">
            {/* Export buttons */}
            <div className="flex gap-3">
              <a href={`/api/projects/${id}/export?format=md`} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium hover:border-brand-300 transition">⬇ Markdown</a>
              <a href={`/api/projects/${id}/export?format=pdf`} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium hover:border-brand-300 transition">⬇ PDF</a>
              <a href={`/api/projects/${id}/export?format=docx`} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium hover:border-brand-300 transition">⬇ Word (.docx)</a>
            </div>

            {/* Table of Contents */}
            <Section title="Table of Contents" className="bg-brand-50/40 border-brand-200">
              <nav className="text-sm text-slate-700">
                <ul className="space-y-0.5">
                  <TocItem number="1" title="Abstract" />
                  <TocItem number="2" title="Technology Stack" />
                  <TocItem number="3" title="Architecture" />
                  {diagrams && diagrams.length > 0 && <TocItem number="4" title="Diagrams" />}
                  <TocItem number="5" title="Folder Structure" />
                  <TocItem number="6" title="Key Modules" />
                  {documentation.apiEndpoints.length > 0 && <TocItem number="7" title="API Endpoints" />}
                  {documentation.dataModels.length > 0 && <TocItem number="8" title="Data Models" />}
                  <TocItem number="9" title="Setup Instructions" />
                  <TocItem number="10" title="Deployment Notes" />
                  {thesisAnalysis && (
                    <>
                      <li className="border-t border-brand-200/50 my-2 pt-2 font-medium text-slate-800">Part II: Thesis Analysis</li>
                      <TocItem number="11" title="Theoretical Background" />
                      <TocItem number="12" title="Design Rationale &amp; Trade-offs" />
                      <TocItem number="13" title="Known Issues &amp; Limitations" />
                      <TocItem number="14" title="Future Work &amp; Recommendations" />
                      <TocItem number="15" title="References" />
                    </>
                  )}
                </ul>
              </nav>
            </Section>

            {/* 1. Abstract / Overview */}
            {thesisAnalysis ? (
              <Section title="1. Abstract" className="border-l-4 border-l-brand-500">
                <p className="text-slate-700 leading-relaxed">{thesisAnalysis.abstract}</p>
              </Section>
            ) : (
              <Section title="1. Overview"><p className="text-slate-700">{documentation.overview}</p></Section>
            )}

            {/* 2. Technology Stack */}
            <Section title="2. Technology Stack">
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <TagList label="Languages" items={techStack.languages} />
                <TagList label="Frameworks" items={techStack.frameworks} />
                <TagList label="Databases" items={techStack.databases} />
                <TagList label="Build Tools" items={techStack.buildTools} />
                <TagList label="Testing" items={techStack.testingTools} />
                <TagList label="Architecture" items={[techStack.architecturePattern]} />
              </div>
              <p className="text-slate-700">{techStack.summary}</p>
            </Section>

            {/* 3. Architecture */}
            <Section title="3. Architecture">
              <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">{documentation.architecture}</div>
            </Section>

            {/* 4. Diagrams */}
            {diagrams && diagrams.length > 0 && (
              <Section title="4. Diagrams">
                <div className="space-y-8">
                  {diagrams.map((d, i) => (
                    <div key={i} className="bg-slate-50/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-medium text-slate-800">{d.title}</p>
                        <span className="text-xs font-mono bg-slate-200 text-slate-500 px-2 py-0.5 rounded">{d.type}</span>
                      </div>
                      <img src={mermaidToImgSrc(d.mermaidCode)} alt={d.title} className="border border-slate-100 rounded-lg bg-white p-3 w-full" />
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 5. Folder Structure */}
            <Section title="5. Folder Structure">
              <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">{documentation.folderStructure}</div>
            </Section>

            {/* 6. Key Modules */}
            <Section title="6. Key Modules">
              <ul className="space-y-2">
                {documentation.keyModules.map((m, i) => (
                  <li key={i} className="text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                    <code className="font-medium text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded text-sm">{m.name}</code>
                    <span className="ml-2">— {m.description}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* 7. API Endpoints */}
            {documentation.apiEndpoints.length > 0 && (
              <Section title="7. API Endpoints">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-slate-100 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr><th className="text-left px-3 py-2 font-medium">Method</th><th className="text-left px-3 py-2 font-medium">Path</th><th className="text-left px-3 py-2 font-medium">Description</th></tr>
                    </thead>
                    <tbody>
                      {documentation.apiEndpoints.map((e, i) => (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-3 py-2"><code className="text-xs font-semibold bg-slate-100 px-1.5 py-0.5 rounded">{e.method}</code></td>
                          <td className="px-3 py-2 font-mono text-xs">{e.path}</td>
                          <td className="px-3 py-2">{e.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* 8. Data Models */}
            {documentation.dataModels.length > 0 && (
              <Section title="8. Data Models">
                <div className="space-y-5">
                  {documentation.dataModels.map((m, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                      <p className="font-semibold text-slate-800 mb-1">{m.name}</p>
                      <p className="text-slate-600 text-sm mb-2">{m.description}</p>
                      <ul className="text-sm text-slate-600 space-y-0.5">
                        {m.fields.map((f, j) => (
                          <li key={j} className="flex items-start gap-2">
                            <span className="text-brand-400 mt-0.5">◆</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 9. Setup Instructions */}
            <Section title="9. Setup Instructions">
              <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">{documentation.setupInstructions}</div>
            </Section>

            {/* 10. Deployment Notes */}
            <Section title="10. Deployment Notes">
              <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">{documentation.deploymentNotes}</div>
            </Section>

            {/* Part II: Thesis Analysis */}
            {thesisAnalysis && (
              <>
                <div className="relative py-6">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-slate-100 text-slate-600 px-6 py-1.5 rounded-full text-sm font-semibold tracking-wider">PART II — THESIS ANALYSIS</span>
                  </div>
                </div>

                {/* 11. Theoretical Background */}
                <Section title="11. Theoretical Background" className="border-l-4 border-l-indigo-400">
                  <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">{thesisAnalysis.theoreticalBackground}</div>
                </Section>

                {/* 12. Design Rationale */}
                <Section title="12. Design Rationale &amp; Trade-offs" className="border-l-4 border-l-amber-400">
                  <div className="space-y-5">
                    {thesisAnalysis.designRationale.map((dr, i) => (
                      <div key={i} className="bg-amber-50/30 rounded-lg p-4 border border-amber-100">
                        <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-800 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                          {dr.title}
                        </h3>
                        <p className="text-slate-700 text-sm leading-relaxed">{dr.discussion}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* 13. Known Issues */}
                <Section title="13. Known Issues &amp; Limitations" className="border-l-4 border-l-red-400">
                  <div className="space-y-5">
                    {thesisAnalysis.knownIssues.map((issue, i) => (
                      <div key={i} className="bg-red-50/40 rounded-lg p-4 border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full bg-red-400" />
                          <span className="text-xs font-medium text-red-600 uppercase tracking-wider">{issue.area}</span>
                        </div>
                        <h3 className="font-semibold text-slate-800 mb-1">{issue.title}</h3>
                        <p className="text-slate-700 text-sm mb-2">{issue.description}</p>
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">Impact: {issue.impact}</span>
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Proposed: {issue.proposedSolution}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* 14. Future Work */}
                <Section title="14. Future Work &amp; Recommendations" className="border-l-4 border-l-green-400">
                  <div className="space-y-4">
                    {thesisAnalysis.futureWork.map((fw, i) => (
                      <div key={i} className="bg-green-50/30 rounded-lg p-4 border border-green-100">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-slate-800">{fw.title}</h3>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            fw.priority === "high" ? "bg-red-100 text-red-700" :
                            fw.priority === "medium" ? "bg-amber-100 text-amber-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {fw.priority.toUpperCase()} PRIORITY
                          </span>
                        </div>
                        <p className="text-slate-700 text-sm leading-relaxed">{fw.description}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* 15. References */}
                <Section title="15. References" className="border-l-4 border-l-slate-400">
                  <div className="space-y-2">
                    {thesisAnalysis.references.map((r, i) => (
                      <div key={i} className="text-sm text-slate-700 flex gap-3">
                        <span className="text-slate-400 font-mono shrink-0 w-6 text-right">[{i + 1}]</span>
                        <span>
                          <span className="italic">{r.title}</span>
                          {r.authors && <span> by {r.authors}</span>}
                          {r.year && <span> ({r.year})</span>}
                          {r.source && <span>. <span className="text-slate-500">{r.source}</span></span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white border border-slate-100 rounded-xl p-6 ${className}`}>
      <h2 className="text-lg font-semibold text-slate-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function TocItem({ number, title }: { number: string; title: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-brand-500 font-mono text-xs w-5 text-right">{number}.</span>
      <span>{title}</span>
    </li>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase mb-1">{label}</p>
      <p className="text-slate-700">{items.filter(Boolean).join(", ") || "—"}</p>
    </div>
  );
}
