/**
 * Local project persistence. Projects live in IndexedDB so SVGs and motion
 * documents are not limited by the 5MB localStorage budget. A localStorage
 * mirror is used only when IndexedDB is unavailable.
 */

import type { AniProject, ProjectSummary } from "@/lib/studio/contracts";
import { PROJECT_SCHEMA_VERSION } from "@/lib/studio/contracts";

const DB_NAME = "ani-studio";
const DB_VERSION = 1;
const STORE = "projects";
const FALLBACK_KEY = "ani-studio-projects-v1";

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB failed to open."));
  });
}

function readFallback(): Record<string, AniProject> {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? "{}") as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, AniProject>;
  } catch {
    /* ignore corrupt local storage */
  }
  return {};
}

function writeFallback(projects: Record<string, AniProject>): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(projects));
}

function summarize(project: AniProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    sourceKind: project.source.kind,
    thumbnail: project.thumbnail,
  };
}

export async function saveProject(project: AniProject): Promise<void> {
  const next: AniProject = {
    ...project,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  if (!hasIndexedDb()) {
    const projects = readFallback();
    projects[next.id] = next;
    writeFallback(projects);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(next);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Project save failed."));
  });
  db.close();
}

export async function loadProject(id: string): Promise<AniProject | null> {
  if (!hasIndexedDb()) return readFallback()[id] ?? null;
  const db = await openDb();
  const result = await new Promise<AniProject | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as AniProject | undefined);
    request.onerror = () => reject(request.error ?? new Error("Project load failed."));
  });
  db.close();
  return result ?? null;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  if (!hasIndexedDb()) {
    return Object.values(readFallback())
      .map(summarize)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const db = await openDb();
  const projects = await new Promise<AniProject[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as AniProject[]);
    request.onerror = () => reject(request.error ?? new Error("Project list failed."));
  });
  db.close();
  return projects
    .map(summarize)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteProject(id: string): Promise<void> {
  if (!hasIndexedDb()) {
    const projects = readFallback();
    delete projects[id];
    writeFallback(projects);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Project delete failed."));
  });
  db.close();
}

export async function touchProject(project: AniProject): Promise<AniProject> {
  const next = { ...project, updatedAt: new Date().toISOString() };
  await saveProject(next);
  return next;
}
