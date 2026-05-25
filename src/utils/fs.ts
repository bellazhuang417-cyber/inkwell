// Unified file system API — delegates to Tauri or browser based on environment.
import { isTauri } from './env';
import type { FileNode, FileContent } from '../types';

async function getTauri() {
  return import('./tauri-api');
}

async function getBrowser() {
  return import('./browser-fs');
}

export async function openFolderDialog(): Promise<string | null> {
  if (isTauri()) return (await getTauri()).openFolderDialog();
  return (await getBrowser()).openFolderDialog();
}

export async function readDirectory(path: string, depth?: number): Promise<FileNode[]> {
  if (isTauri()) return (await getTauri()).readDirectory(path, depth);
  return (await getBrowser()).readDirectory(path, depth);
}

export async function readFile(path: string): Promise<FileContent> {
  if (isTauri()) return (await getTauri()).readFile(path);
  return (await getBrowser()).readFile(path);
}

export async function watchDirectory(path: string): Promise<void> {
  if (isTauri()) return (await getTauri()).watchDirectory(path);
  // browser: no-op, App.tsx uses polling instead
}

// Restore the last opened vault on startup
export async function restoreLastVault(): Promise<string | null> {
  if (isTauri()) {
    // Tauri: path string in localStorage is enough
    return localStorage.getItem('inkwell_vault_path');
  }
  // Browser: path alone is not enough — we also need to restore the handle
  const { restoreLastVault: browserRestore } = await getBrowser();
  return browserRestore();
}
