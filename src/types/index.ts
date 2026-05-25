// File content returned from backend
export interface FileContent {
  path: string;
  content: string;
  ext: string;
}

// File node in the tree
export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  ext?: string;
  children?: FileNode[];
}

// Currently open file
export interface OpenFile {
  path: string;
  name: string;
  ext: string;
  content: string;
  folder: string;
  fileType: 'html' | 'md' | 'yaml' | 'other';
}

// View type
export type ViewType = 'empty' | 'html' | 'md' | 'yaml';

// Search result
export interface SearchResult {
  name: string;
  path: string;
  ext: string;
  snippet: string;
}

// Backlink
export interface Backlink {
  name: string;
  path: string;
  context: string;
  ext: string;
}
