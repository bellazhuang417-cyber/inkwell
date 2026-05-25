import type { FileNode, FileContent } from '../types';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', 'dist',
  'build', 'target', '__pycache__', '.cache', '.turbo', 'vendor',
]);

// Map virtual path → handle
const handleMap = new Map<string, FileSystemFileHandle | FileSystemDirectoryHandle>();
let rootPath = '';

// ── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('inkwell', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(handle: FileSystemDirectoryHandle) {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'root');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get('root');
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

// ── Directory tree builder ───────────────────────────────────────────────────

async function buildTree(
  dir: FileSystemDirectoryHandle,
  virtualPath: string,
  depth: number,
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];

  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith('.')) continue;

    const childPath = `${virtualPath}/${name}`;
    handleMap.set(childPath, handle);

    if (handle.kind === 'directory') {
      if (SKIP_DIRS.has(name.toLowerCase())) continue;
      const children =
        depth > 0
          ? await buildTree(handle as FileSystemDirectoryHandle, childPath, depth - 1)
          : undefined;
      nodes.push({ name, path: childPath, isDir: true, ext: undefined, children });
    } else {
      const ext = name.includes('.') ? name.split('.').pop() : undefined;
      nodes.push({ name, path: childPath, isDir: false, ext, children: undefined });
    }
  }

  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  return nodes;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function openFolderDialog(): Promise<string | null> {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    rootPath = `/${handle.name}`;
    handleMap.set(rootPath, handle);
    await saveHandle(handle);
    return rootPath;
  } catch {
    return null;
  }
}

export async function readDirectory(dirPath: string, depth = 3): Promise<FileNode[]> {
  const handle = handleMap.get(dirPath);
  if (!handle || handle.kind !== 'directory') {
    throw new Error(`Directory not found: ${dirPath}`);
  }
  return buildTree(handle as FileSystemDirectoryHandle, dirPath, depth);
}

export async function readFile(filePath: string): Promise<FileContent> {
  const handle = handleMap.get(filePath);
  if (!handle || handle.kind !== 'file') {
    throw new Error(`File not found: ${filePath}`);
  }
  const file = await (handle as FileSystemFileHandle).getFile();
  const content = await file.text();
  const ext = filePath.split('.').pop() ?? '';
  return { path: filePath, content, ext };
}

// Browser has no native file watching; App uses polling instead
export async function watchDirectory(_path: string): Promise<void> {}

// Try to restore the last opened folder from IndexedDB
export async function restoreLastVault(): Promise<string | null> {
  const savedPath = localStorage.getItem('inkwell_vault_path');
  if (!savedPath) return null;

  const handle = await loadHandle();
  if (!handle) return null;

  try {
    // Re-request read permission (browser requires this after page reload)
    const perm = await handle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') {
      const req = await handle.requestPermission({ mode: 'read' });
      if (req !== 'granted') return null;
    }
    rootPath = `/${handle.name}`;
    handleMap.set(rootPath, handle);
    return rootPath;
  } catch {
    return null;
  }
}
