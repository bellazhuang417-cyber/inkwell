import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { FileNode, FileContent } from '../types';

// Read a directory tree
export async function readDirectory(dirPath: string, depth?: number): Promise<FileNode[]> {
  return invoke<FileNode[]>('read_directory', { dirPath, depth: depth ?? null });
}

// Read a single file
export async function readFile(filePath: string): Promise<FileContent> {
  return invoke<FileContent>('read_file', { filePath });
}

// Write a file
export async function writeFile(filePath: string, content: string): Promise<void> {
  return invoke('write_file', { filePath, content });
}

// Get the user's home directory
export async function getHomeDir(): Promise<string> {
  return invoke<string>('get_home_dir');
}

// Start watching a directory for changes
export async function watchDirectory(path: string): Promise<void> {
  return invoke('watch_directory', { path });
}

// Open a folder picker dialog
export async function openFolderDialog(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: '选择笔记库文件夹',
  });
  return selected as string | null;
}
