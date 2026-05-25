import { useState, useEffect, useRef, useCallback } from 'react';
import jsYaml from 'js-yaml';
import { isTauri } from './utils/env';
import {
  FolderOpen,
  Folder,
  FileCode2,
  FileText,
  Search,
  ChevronRight,
  PanelRightOpen,
  PanelRightClose,
  FolderSync,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Filter,
  RotateCw,
} from 'lucide-react';
import type { FileNode, OpenFile, ViewType } from './types';
import {
  readDirectory,
  readFile,
  openFolderDialog,
  watchDirectory,
  restoreLastVault,
} from './utils/fs';
import './styles/global.css';

// ---- File Tree Component ----
function FileTree({
  nodes,
  onFileOpen,
  activePath,
  onFolderExpand,
  htmlOnly,
  depth = 0,
}: {
  nodes: FileNode[];
  onFileOpen: (node: FileNode) => void;
  activePath: string | null;
  onFolderExpand: (node: FileNode) => Promise<FileNode[] | null>;
  htmlOnly?: boolean;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childNodes, setChildNodes] = useState<Map<string, FileNode[]>>(new Map());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string, node: FileNode) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        // Dynamically load children if not cached
        if (!childNodes.has(path) && !loadingPaths.has(path)) {
          setLoadingPaths((prev) => {
            const n = new Set(prev);
            n.add(path);
            return n;
          });
          onFolderExpand(node)
            .then((children) => {
              if (children && children.length > 0) {
                setChildNodes((prev) => {
                  const next = new Map(prev);
                  next.set(path, children);
                  return next;
                });
              }
            })
            .catch((e) => console.error('Expand error:', e))
            .finally(() => {
              setLoadingPaths((prev) => {
                const n = new Set(prev);
                n.delete(path);
                return n;
              });
            });
        }
      }
      return next;
    });
  };

  const visibleNodes = htmlOnly
    ? nodes.filter((n) => n.isDir || n.ext?.toLowerCase() === 'html' || n.ext?.toLowerCase() === 'htm')
    : nodes;

  return (
    <div className="sidebar-tree">
      {visibleNodes.map((node) => {
        const isExpanded = expanded.has(node.path);
        const isActive = activePath === node.path;
        const indent = depth * 16;
        const displayChildren = childNodes.get(node.path) ?? node.children ?? [];

        if (node.isDir) {
          return (
            <div key={node.path}>
              <div
                className={`tree-node ${isActive ? 'active' : ''}`}
                style={{ paddingLeft: `${8 + indent}px` }}
                onClick={() => toggleFolder(node.path, node)}
              >
                <span className={`tree-node-arrow ${isExpanded ? 'expanded' : ''}`}>
                  <ChevronRight size={12} />
                </span>
                <span className="tree-node-icon folder">
                  {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                </span>
                <span className="tree-node-name">{node.name}</span>
                {loadingPaths.has(node.path) && (
                  <span style={{ fontSize: 10, color: 'var(--hn-text-tertiary)' }}>...</span>
                )}
              </div>
              {isExpanded && displayChildren.length > 0 && (
                <FileTree
                  nodes={displayChildren}
                  onFileOpen={onFileOpen}
                  activePath={activePath}
                  onFolderExpand={onFolderExpand}
                  htmlOnly={htmlOnly}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }

        const ext = node.ext?.toLowerCase() || '';
        const iconClass = ext === 'html' || ext === 'htm' ? 'html' : ext === 'md' || ext === 'mdx' ? 'md' : '';

        return (
          <div
            key={node.path}
            className={`tree-node ${isActive ? 'active' : ''}`}
            style={{ paddingLeft: `${8 + indent + 20}px` }}
            onClick={() => onFileOpen(node)}
          >
            <span className={`tree-node-icon ${iconClass}`}>
              {iconClass === 'html' ? (
                <FileCode2 size={16} />
              ) : iconClass === 'md' ? (
                <FileText size={16} />
              ) : (
                <FileText size={16} />
              )}
            </span>
            <span className="tree-node-name">{node.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Search Overlay ----
function SearchOverlay({
  visible,
  onClose,
  onFileOpen,
  vaultPath,
}: {
  visible: boolean;
  onClose: () => void;
  onFileOpen: (node: FileNode) => void;
  vaultPath: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileNode[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const allFilesRef = useRef<FileNode[]>([]);

  const flattenTree = (nodes: FileNode[]): FileNode[] => {
    const files: FileNode[] = [];
    for (const node of nodes) {
      if (!node.isDir) files.push(node);
      if (node.children) files.push(...flattenTree(node.children));
    }
    return files;
  };

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      if (vaultPath && allFilesRef.current.length === 0) {
        readDirectory(vaultPath).then((tree) => {
          allFilesRef.current = flattenTree(tree);
        }).catch(() => {});
      }
    }
  }, [visible, vaultPath]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const q = query.toLowerCase();
    const filtered = allFilesRef.current.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.path.toLowerCase().includes(q)
    );
    setResults(filtered.slice(0, 20));
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        onFileOpen(results[selectedIndex]);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, results, selectedIndex, onClose, onFileOpen]);

  if (!visible) return null;

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-container" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <Search size={20} />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="搜索笔记..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>ESC</kbd>
        </div>
        {results.length > 0 && (
          <div className="search-results">
            {results.map((file, i) => {
              const ext = file.ext?.toLowerCase() || '';
              const iconClass = ext === 'html' || ext === 'htm' ? 'html' : ext === 'md' || ext === 'mdx' ? 'md' : '';
              return (
                <div
                  key={file.path}
                  className={`search-result-item ${i === selectedIndex ? 'selected' : ''}`}
                  onClick={() => {
                    onFileOpen(file);
                    onClose();
                  }}
                >
                  <span className={`search-result-icon tree-node-icon ${iconClass}`}>
                    {iconClass === 'html' ? <FileCode2 size={16} /> : <FileText size={16} />}
                  </span>
                  <div className="search-result-info">
                    <div className="search-result-name">{file.name}</div>
                    <div className="search-result-path">{file.path}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {query && results.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hn-text-tertiary)' }}>
            未找到相关笔记
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main App ----
function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [currentFile, setCurrentFile] = useState<OpenFile | null>(null);
  const [viewType, setViewType] = useState<ViewType>('empty');
  const [searchVisible, setSearchVisible] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [siblings, setSiblings] = useState<FileNode[]>([]);
  const [siblingIndex, setSiblingIndex] = useState(-1);
  const [initError, setInitError] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [htmlOnly, setHtmlOnly] = useState(false);
  const mdEditorRef = useRef<HTMLDivElement>(null);
  const mdPreviewRef = useRef<HTMLDivElement>(null);

  // Load vault on mount — restore last opened folder
  useEffect(() => {
    async function loadSaved() {
      try {
        setInitLoading(true);
        setInitError(null);
        const saved = await restoreLastVault();
        if (!saved) return;
        setVaultPath(saved);
        const nodes = await readDirectory(saved);
        setTree(nodes);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[Inkwell] Init error:', msg);
        setInitError(msg);
        localStorage.removeItem('inkwell_vault_path');
      } finally {
        setInitLoading(false);
      }
    }
    loadSaved();
  }, []);

  // ⌘K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchVisible((v) => !v);
      }
      if (
        currentFile &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        if (e.key === 'j' || e.key === 'J') {
          e.preventDefault();
          navigateDoc(1);
        } else if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          navigateDoc(-1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFile, siblings, siblingIndex]);

  // Refresh current folder
  const handleRefresh = useCallback(async () => {
    if (!vaultPath) return;
    const nodes = await readDirectory(vaultPath);
    setTree(nodes);
  }, [vaultPath]);

  // Watch for file system changes and auto-refresh
  useEffect(() => {
    if (!vaultPath) return;

    if (isTauri()) {
      // Tauri: use native file watcher events (1s debounce)
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let cleanup: (() => void) | null = null;
      watchDirectory(vaultPath).catch(() => {});
      import('@tauri-apps/api/event').then(({ listen }) => {
        const unlistenPromise = listen('directory-changed', () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => handleRefresh(), 1000);
        });
        cleanup = () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          unlistenPromise.then((unlisten) => unlisten());
        };
      });
      return () => cleanup?.();
    } else {
      // Browser: poll every 5 seconds
      const interval = setInterval(() => handleRefresh(), 5000);
      return () => clearInterval(interval);
    }
  }, [vaultPath, handleRefresh]);

  // Open folder
  const handleOpenFolder = async () => {
    const path = await openFolderDialog();
    if (path) {
      localStorage.setItem('inkwell_vault_path', path);
      setVaultPath(path);
      const nodes = await readDirectory(path);
      setTree(nodes);
      setCurrentFile(null);
      setViewType('empty');
    }
  };

  // Expand folder (load children on demand)
  const handleFolderExpand = async (node: FileNode): Promise<FileNode[] | null> => {
    if (!node.isDir) return null;
    if (node.children && node.children.length > 0) return node.children;
    try {
      const children = await readDirectory(node.path);
      return children;
    } catch (e) {
      console.error('Failed to expand folder:', e);
      return null;
    }
  };

  // Open a file
  const handleFileOpen = async (node: FileNode) => {
    if (node.isDir) return;
    try {
      const result = await readFile(node.path);
      const ext = result.ext.toLowerCase();
      const folder = node.path.split('/').slice(-2, -1)[0] || '';

      const fileType: OpenFile['fileType'] =
        ext === 'html' || ext === 'htm' ? 'html'
        : ext === 'md' || ext === 'mdx' ? 'md'
        : ext === 'yaml' || ext === 'yml' ? 'yaml'
        : 'other';

      const file: OpenFile = {
        path: result.path,
        name: node.name,
        ext,
        content: result.content,
        folder,
        fileType,
      };

      setCurrentFile(file);
      setViewType(fileType === 'other' ? 'empty' : fileType === 'yaml' ? 'yaml' : 'html');

      const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
      if (vaultPath) {
        try {
          const parentNodes = await readDirectory(parentPath);
          const files = parentNodes.filter((n) => !n.isDir);
          const idx = files.findIndex((f) => f.path === node.path);
          setSiblings(files);
          setSiblingIndex(idx);
        } catch {
          setSiblings([]);
          setSiblingIndex(-1);
        }
      }
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  };

  const navigateDoc = (direction: number) => {
    const nextIdx = siblingIndex + direction;
    if (nextIdx < 0 || nextIdx >= siblings.length) return;
    handleFileOpen(siblings[nextIdx]);
  };

  // ---- Markdown → HTML rendering (GFM + Obsidian + Chinese-export dialect) ----
  const renderMarkdown = (md: string): string => {
    let html = md;

    // === 1. YAML Frontmatter: detect and render as meta panel ===
    // Long values (like tags that swallowed the full text) get truncated
    const MAX_FM_VAL_LEN = 80;
    html = html.replace(/^---\n([\s\S]*?)\n---\n*/g, (_m: string, fm: string) => {
      const lines = fm.trim().split('\n').filter(Boolean);
      if (lines.length === 0) return '';
      const items = lines.map((line: string) => {
        const idx = line.indexOf(':');
        if (idx === -1) return line;
        const key = line.substring(0, idx).trim();
        let val = line.substring(idx + 1).trim();
        if (val.length > MAX_FM_VAL_LEN) {
          val = val.substring(0, MAX_FM_VAL_LEN) + '…';
        }
        return `<span class="fm-key">${key}</span><span class="fm-val">${val}</span>`;
      }).join('');
      return `<div class="frontmatter">${items}</div>`;
    });

    // === 2. Fenced code blocks — must come first to protect inner content ===
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m: string, lang: string, code: string) => {
      const escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre><code class="lang-${lang}">${escaped}</code></pre>`;
    });

    // === 3. Pre-process: split long paragraphs at semantic boundaries ===
    // Many Chinese-exported notes have no line breaks between list items.
    // Split before numbered sections (e.g., "1. 投资认知") when they appear mid-line
    html = html.replace(/([^\n])(\s*\d+\.\s+[\u4e00-\u9fa5A-Z])/g, '$1\n$2');
    // Split before bullet markers (• ◦ ○) when mid-line
    html = textSplitBeforeBullets(html);

    // === 4. Inline code (backtick) ===
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // === 5. Headers (ATX style) — per-line replace to avoid cross-line corruption ===
    const lines3 = html.split('\n');
    html = lines3.map(line => {
      if (/^###### /.test(line)) return line.replace(/^###### (.*)$/, '<h6>$1</h6>');
      if (/^##### /.test(line)) return line.replace(/^##### (.*)$/, '<h5>$1</h5>');
      if (/^#### /.test(line)) return line.replace(/^#### (.*)$/, '<h4>$1</h4>');
      if (/^### /.test(line)) return line.replace(/^### (.*)$/, '<h3>$1</h3>');
      if (/^## /.test(line)) return line.replace(/^## (.*)$/, '<h2>$1</h2>');
      if (/^# /.test(line)) return line.replace(/^# (.*)$/, '<h1>$1</h1>');
      return line;
    }).join('\n');

    // === 6. Numbered section headers ("1. 投资认知" pattern) ===
    const lines4 = html.split('\n');
    html = lines4.map(line => {
      const m = line.match(/^(\d+)\.\s+([\u4e00-\u9fa5][^\n]*)$/);
      if (m && !line.match(/^[<]/)) {
        return `<h3 class="section-num">${m[1]}. ${m[2]}</h3>`;
      }
      return line;
    }).join('\n');

    // === 7. Horizontal rule ===
    const lines5 = html.split('\n');
    html = lines5.map(line => {
      if (/^(---|\*\*\*|___)$/.test(line.trim()) && !line.startsWith('<')) return '<hr/>';
      return line;
    }).join('\n');

    // === 8. Images (before links since ![...](...) contains [...](...)) ===
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

    // === 9. Links ===
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // === 10. Bold & Italic ===
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(?!\*)(.*?)(?<!\*)\*/g, '<em>$1</em>');

    // === 11. Blockquotes ===
    const lines6 = html.split('\n');
    html = lines6.map(line => {
      if (/^>\s+/.test(line) && !line.startsWith('<')) {
        return line.replace(/^>\s+(.*)$/, '<blockquote>$1</blockquote>');
      }
      return line;
    }).join('\n');

    // === 12. Wikilinks (Obsidian-style) ===
    html = html.replace(/\[\[([^\]]+)\]\]/g, '<span class="wikilink">[[$1]]</span>');

    // === 13. Tags (#tag in running text) ===
    html = html.replace(/(^|\s)#([\u4e00-\u9fa5A-Za-z0-9_\/]+)/g, '$1<span class="tag">#$2</span>');

    // === 14. List Items: multi-style bullets + indent-level detection ===
    const lines7 = html.split('\n');
    html = lines7.map(line => {
      // Skip already-tagged lines
      if (line.startsWith('<') || line.trim() === '') return line;
      // Unordered: -, *, •, ◦, ○, · followed by space
      const ulM = line.match(/^(\s*)([-*•◦○·])\s+(.*)$/);
      if (ulM) {
        const level = Math.floor(ulM[1].length / 2);
        const cls = level > 0 ? ` class="indent-${Math.min(level, 3)}"` : '';
        return `<li${cls}>${ulM[3]}</li>`;
      }
      // Ordered: "N. text" but NOT CJK section headers (already handled above)
      const olM = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (olM && /^[\u4e00-\u9fa5]/.test(olM[3])) return line; // skip CJK headers
      if (olM) {
        const level = Math.floor(olM[1].length / 2);
        const cls = level > 0 ? ` class="indent-${Math.min(level, 3)}"` : '';
        return `<li class="ordered"${cls}>${olM[2]}. ${olM[3]}</li>`;
      }
      return line;
    }).join('\n');

    // === 15. GFM Tables (pipe syntax) ===
    // Must run before wrapParagraphs so table blocks are recognized as containers
    html = renderGFMTables(html);

    // === 16. Wrap consecutive <li> into <ul>/<ol> with nesting ===
    html = wrapListItems(html);

    // === 17. Smart paragraph wrapping ===
    html = wrapParagraphs(html);

    return html;
  };

  /** Render GFM (GitHub Flavored Markdown) pipe tables into <table> HTML */
  function renderGFMTables(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let tableLines: string[] | null = null;

    for (const rawLine of lines) {
      const line = rawLine;
      // A table row contains at least one unescaped | (not at start/end only)
      const isTableRow = /^\|(.+)\|$/.test(line.trim());
      const isSeparator = /^\|[\s\-:|\s]+\|$/.test(line.trim());

      if (isTableRow || isSeparator) {
        if (tableLines === null) {
          // Check this isn't a standalone | inside a paragraph
          // by looking back: if previous non-empty line wasn't a table row, start new
          tableLines = [];
        }
        tableLines.push(line);
      } else {
        if (tableLines !== null) {
          // Flush accumulated table lines
          result.push(buildGFMTable(tableLines));
          tableLines = null;
        }
        result.push(line);
      }
    }

    // Flush any remaining table
    if (tableLines !== null) {
      result.push(buildGFMTable(tableLines));
    }

    return result.join('\n');
  }

  /** Convert an array of GFM table lines into a <table> element */
  function buildGFMTable(lines: string[]): string {
    const rows: string[][] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip separator line (e.g., |---|---|)
      if (/^[\s\-:|]+$/.test(trimmed.replace(/^\|/, '').replace(/\|$/, ''))) continue;
      // Split by |, trim each cell
      const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      rows.push(cells);
    }

    if (rows.length === 0) return '';

    const numCols = Math.max(...rows.map(r => r.length));
    let html = '<table>\n';
    for (let i = 0; i < rows.length; i++) {
      const tag = i === 0 ? 'th' : 'td';
      html += '  <tr>';
      for (let j = 0; j < numCols; j++) {
        const cell = rows[i][j] || '';
        html += `<${tag}>${cell}</${tag}>`;
      }
      html += '</tr>\n';
    }
    html += '</table>';
    return html;
  }

  /** Split text before bullet markers that appear mid-line (Chinese export format) */
  function textSplitBeforeBullets(text: string): string {
    return text
      .replace(/([^\n\s])(\s*)([•◦○·])/g, (_m, before: string, space: string, bullet: string) => `${before}\n${space}${bullet}`)
      .replace(/\n{2,}/g, '\n')
      ;
  }

  /** Wrap consecutive <li> elements into proper <ul>/<ol> containers */
  function wrapListItems(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let listBuf: string[] | null = null;
    let isOrderedBuf = false;

    for (const rawLine of lines) {
      const line = rawLine;
      const isLi = /^<li[\s>]/.test(line);
      const isOrdered = /class="ordered"/.test(line);

      if (isLi) {
        if (listBuf === null) {
          // Start new list
          listBuf = [];
          isOrderedBuf = isOrdered;
          result.push(isOrdered ? '<ol>' : '<ul>');
        } else if (isOrdered !== isOrderedBuf) {
          // List type changed: close old, open new
          result.push(isOrderedBuf ? '</ol>' : '</ul>');
          listBuf = [];
          isOrderedBuf = isOrdered;
          result.push(isOrdered ? '<ol>' : '<ul>');
        }
        listBuf.push(line);
        result.push(line);
      } else {
        // Not a list item
        if (listBuf !== null) {
          result.push(isOrderedBuf ? '</ol>' : '</ul>');
          listBuf = null;
        }
        result.push(line);
      }
    }
    // Close any remaining open list
    if (listBuf !== null) {
      result.push(isOrderedBuf ? '</ol>' : '</ul>');
    }

    return result.join('\n');
  }

  /** Wrap plain-text lines as paragraphs, preserving existing block tags */
  function wrapParagraphs(text: string): string {
    const blocks = text.split(/\n\n+/);
    return blocks.map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Already a block element?
      if (/^<(h[1-6]|hr|pre|ul|ol|blockquote|div|img|table)[\s>]/.test(trimmed)) return block;
      // Process each line within the block
      const lines = block.split('\n').filter(l => l.trim());
      return '\n' + lines.map(l => {
        if (l.startsWith('<')) return l;
        if (!l.trim()) return '';
        return `<p>${l}</p>`;
      }).join('\n') + '\n';
    }).join('\n\n');
  }

  // ---- Build srcDoc for HTML view ----
  const buildSrcDoc = (file: OpenFile): string => {
    if (file.fileType === 'md') {
      const rendered = renderMarkdown(file.content);
      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css">
<style>
  /* === Kami-inspired design tokens === */
  :root {
    --parchment:    #f5f4ed;
    --ivory:        #faf9f5;
    --warm-sand:    #e8e6dc;
    --brand:        #1B365D;
    --brand-light:  #2D5A8A;
    --near-black:   #141413;
    --dark-warm:    #3d3d3a;
    --olive:        #504e49;
    --stone:        #6b6a64;
    --border:       #e8e6dc;
    --code-bg:      #2D2D2D;
    --blockquote-bg:#f0ede7;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: "LXGW WenKai", "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", Georgia, serif;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.75;
    letter-spacing: 0.35px;
    color: var(--near-black);
    background: var(--parchment);
    padding: 40px 56px;
    max-width: 800px;
    margin: 0 auto;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* === Typography hierarchy (serif carries weight) === */
  h1, h2, h3, h4, h5, h6 {
    font-family: "LXGW WenKai", "Source Han Serif SC", Georgia, serif;
    font-weight: 500;           /* avoid synthetic bold */
    color: var(--brand);       /* ink-blue as sole accent */
    line-height: 1.25;
    letter-spacing: 0;
  }
  h1 {
    font-size: 2em;
    border-bottom: 2px solid var(--border);
    padding-bottom: 0.35em;
    margin-top: 0.6em;
    margin-bottom: 0.6em;
    color: var(--near-black);
  }
  h2 {
    font-size: 1.55em;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.25em;
    margin-top: 1.6em;
    margin-bottom: 0.5em;
  }
  h3 { font-size: 1.25em; margin-top: 1.4em; }
  h4 { font-size: 1.1em;  margin-top: 1.2em; }
  h5 { font-size: 1em;   color: var(--olive); }
  h6 { font-size: 0.9em;  color: var(--stone); }

  p { margin-bottom: 1em; }

  /* Links — subtle underline on hover */
  a {
    color: var(--brand-light);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.18s ease;
  }
  a:hover { border-bottom-color: var(--brand-light); }

  strong { font-weight: 500; }

  code {
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace;
    font-size: 0.85em;
    background: #EEF2F7;
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--brand);
  }

  pre {
    background: var(--code-bg);
    color: #E8E6E3;
    padding: 16px 20px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1.2em 0;
    font-size: 13px;
    line-height: 1.6;
  }
  pre code {
    background: none;
    color: inherit;
    padding: 0;
    font-size: inherit;
    border-radius: 0;
  }

  blockquote {
    border-left: 3px solid var(--brand);
    margin: 1.2em 0;
    padding: 10px 18px;
    color: var(--olive);
    background: var(--blockquote-bg);
    border-radius: 0 6px 6px 0;
  }
  blockquote p { margin-bottom: 0; }

  hr {
    border: none;
    height: 1px;
    background: var(--border);
    margin: 2em 0;
  }

  ul, ol { padding-left: 1.6em; margin-bottom: 1em; }
  li { margin-bottom: 0.35em; }

  img { max-width: 100%; height: auto; border-radius: 6px; margin: 1em 0; }

  .wikilink {
    color: var(--brand);
    background: rgba(27,54,93,0.07);
    padding: 1px 5px;
    border-radius: 3px;
    cursor: pointer;
    font-weight: 500;
  }

  /* Fade-in animation (Kami style) */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  body { animation: fadeIn 0.4s ease-out; }

  /* === Frontmatter meta panel === */
  .frontmatter {
    background: var(--ivory);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 20px;
    margin-bottom: 1.5em;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 20px;
    font-size: 0.88em;
  }
  .fm-key {
    color: var(--stone);
    font-weight: 500;
    min-width: 52px;
    text-align: right;
  }
  .fm-val { color: var(--dark-warm); }

  /* === Tags === */
  .tag {
    color: var(--brand-light);
    background: rgba(45,90,138,0.08);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.9em;
    white-space: nowrap;
  }

  /* === Section numbered headings === */
  h3.section-num {
    color: var(--near-black);
    font-size: 1.2em;
    margin-top: 1.8em;
    margin-bottom: 0.4em;
    padding-bottom: 0.15em;
    border-bottom: 1px solid var(--warm-sand);
  }

  /* === Nested list indentation === */
  li.indent-1, li.indent-2, li.indent-3 { list-style-position: outside; }
  ul li.indent-1 { margin-left: 1.2em; }
  ul li.indent-2 { margin-left: 2.4em; color: var(--olive); }
  ul li.indent-3 { margin-left: 3.6em; color: var(--stone); }

  /* === GFM Tables === */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.2em 0;
    font-size: 0.92em;
    line-height: 1.6;
  }
  th, td {
    padding: 0.6em 1em;
    text-align: left;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  th {
    font-weight: 600;
    color: var(--brand);
    background: rgba(27, 54, 93, 0.05);
    border-bottom: 2px solid var(--brand);
  }
  tr:hover td { background: rgba(27, 54, 93, 0.03); }
  tr:last-child td { border-bottom: none; }
</style>
</head>
<body>${rendered}</body>
</html>`;
    }
    // For HTML files, pass content directly
    return file.content;
  };

  // ---- Build srcDoc for YAML view ----
  const buildYamlSrcDoc = (content: string): string => {
    let parsed: unknown;
    let parseError: string | null = null;
    try {
      parsed = jsYaml.load(content);
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }

    const escHtml = (s: string) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const renderValue = (val: unknown, depth = 0): string => {
      if (val === null || val === undefined) return '<span class="yaml-null">null</span>';
      if (typeof val === 'boolean') return `<span class="yaml-bool">${val}</span>`;
      if (typeof val === 'number') return `<span class="yaml-num">${val}</span>`;
      if (typeof val === 'string') {
        if (val.length > 120) return `<span class="yaml-str">${escHtml(val.slice(0, 120))}…</span>`;
        return `<span class="yaml-str">${escHtml(val)}</span>`;
      }
      if (Array.isArray(val)) {
        if (val.length === 0) return '<span class="yaml-empty">[]</span>';
        const items = val.map(item =>
          `<li>${renderValue(item, depth + 1)}</li>`
        ).join('');
        return `<ul class="yaml-list">${items}</ul>`;
      }
      if (typeof val === 'object') {
        const entries = Object.entries(val as Record<string, unknown>);
        if (entries.length === 0) return '<span class="yaml-empty">{}</span>';
        const rows = entries.map(([k, v]) =>
          `<div class="yaml-row"><span class="yaml-key">${escHtml(k)}</span><span class="yaml-colon">:</span><span class="yaml-val">${renderValue(v, depth + 1)}</span></div>`
        ).join('');
        return depth === 0
          ? `<div class="yaml-object root">${rows}</div>`
          : `<div class="yaml-object nested">${rows}</div>`;
      }
      return escHtml(String(val));
    };

    const body = parseError
      ? `<div class="parse-error"><strong>YAML parse error</strong><pre>${escHtml(parseError)}</pre></div>`
      : renderValue(parsed);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  :root {
    --bg: #f7f8fa; --surface: #ffffff; --border: #e4e7ec;
    --key: #1B365D; --str: #2e7d32; --num: #c62828; --bool: #6a1a9a;
    --null: #888; --text: #1a1a1a;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "SF Mono", "JetBrains Mono", Consolas, monospace; font-size: 13px; line-height: 1.6; background: var(--bg); color: var(--text); padding: 24px; }
  .yaml-object.root { display: grid; grid-template-columns: 1fr; gap: 2px; }
  .yaml-row { display: flex; align-items: flex-start; padding: 5px 12px; border-radius: 5px; }
  .yaml-row:hover { background: rgba(27,54,93,0.05); }
  .yaml-key { color: var(--key); font-weight: 600; min-width: 140px; flex-shrink: 0; }
  .yaml-colon { color: #999; margin: 0 8px; flex-shrink: 0; }
  .yaml-val { flex: 1; }
  .yaml-str { color: var(--str); }
  .yaml-num { color: var(--num); }
  .yaml-bool { color: var(--bool); font-weight: 600; }
  .yaml-null { color: var(--null); font-style: italic; }
  .yaml-empty { color: var(--null); }
  .yaml-list { list-style: disc; padding-left: 20px; }
  .yaml-list li { padding: 2px 0; }
  .yaml-object.nested { padding-left: 12px; border-left: 2px solid var(--border); margin-top: 2px; }
  .parse-error { background: #fff0f0; border: 1px solid #ffcccc; border-radius: 8px; padding: 16px; }
  .parse-error pre { margin-top: 8px; font-size: 12px; color: #c00; }
</style>
</head>
<body>${body}</body>
</html>`;
  };

  return (
    <div className="app-layout">
      {/* Top Bar */}
      <div className="app-topbar">
        <div className="app-topbar-title">
          <span className="logo-dot" />
          HtmlNote
        </div>
        <div className="app-topbar-actions">
          <button className="view-btn" onClick={handleOpenFolder} title="打开文件夹">
            <FolderSync size={16} />
          </button>
          <button className="view-btn" onClick={() => setSearchVisible(true)} title="搜索 ⌘K">
            <Search size={16} />
          </button>
          <button
            className="view-btn"
            onClick={() => setRightPanelOpen((v) => !v)}
            title="切换右侧面板"
          >
            {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="app-main">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">
            <span>{vaultPath ? vaultPath.split('/').pop() : '未打开'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                className={`view-btn ${htmlOnly ? 'active' : ''}`}
                onClick={() => setHtmlOnly((v) => !v)}
                title={htmlOnly ? '显示全部文件' : '仅显示 HTML'}
              >
                <Filter size={14} />
              </button>
              <button className="view-btn" onClick={handleRefresh} title="刷新 / Refresh">
                <RotateCw size={14} />
              </button>
              <button className="view-btn" onClick={handleOpenFolder} title="切换文件夹">
                <FolderSync size={14} />
              </button>
            </div>
          </div>
          {initLoading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--hn-text-tertiary)', fontSize: 13 }}>
              加载中...
            </div>
          ) : initError ? (
            <div style={{ padding: '16px', margin: '0 8px', background: 'rgba(232,80,80,0.08)', borderRadius: 'var(--hn-radius-md)', border: '1px solid rgba(232,80,80,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#e85050', fontSize: 12 }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>加载失败</div>
                  <div style={{ color: 'var(--hn-text-tertiary)', wordBreak: 'break-all' }}>{initError}</div>
                </div>
              </div>
            </div>
          ) : tree.length > 0 ? (
            <FileTree nodes={tree} onFileOpen={handleFileOpen} activePath={currentFile?.path ?? null} onFolderExpand={handleFolderExpand} htmlOnly={htmlOnly} />
          ) : (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <Folder size={40} style={{ color: 'var(--hn-border)', marginBottom: 12 }} />
              <div style={{ fontSize: 13, color: 'var(--hn-text-tertiary)' }}>
                点击上方按钮打开文件夹
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="content-area">
          <div className="content-body">
            {viewType === 'empty' && (
              <div className="empty-state">
                <FileCode2 size={64} className="empty-state-icon" />
                <div className="empty-state-title">开始你的笔记之旅</div>
                <div className="empty-state-desc">
                  从左侧选择一个 HTML 或 Markdown 文件，或按 <kbd>⌘K</kbd> 搜索
                </div>
              </div>
            )}

            {viewType === 'html' && currentFile && (
              <div className="html-render-view">
                <div className="html-meta-bar">
                  <div className="html-meta-info">
                    <FileCode2 size={14} style={{ color: 'var(--hn-accent)' }} />
                    <span className="html-filename">{currentFile.name}</span>
                    {currentFile.fileType === 'md' ? (
                      <span className="html-trust-badge">渲染预览</span>
                    ) : (
                      <span className="html-trust-badge">本地信任</span>
                    )}
                  </div>
                </div>
                <div className="html-render-scroll">
                  <iframe
                    className="html-render-iframe"
                    srcDoc={buildSrcDoc(currentFile)}
                    sandbox="allow-scripts allow-same-origin"
                    title={currentFile.name}
                  />
                </div>
              </div>
            )}

            {viewType === 'yaml' && currentFile && (
              <div className="html-render-view">
                <div className="html-meta-bar">
                  <div className="html-meta-info">
                    <FileText size={14} style={{ color: 'var(--hn-accent)' }} />
                    <span className="html-filename">{currentFile.name}</span>
                    <span className="html-trust-badge">YAML 预览</span>
                  </div>
                </div>
                <div className="html-render-scroll">
                  <iframe
                    className="html-render-iframe"
                    srcDoc={buildYamlSrcDoc(currentFile.content)}
                    sandbox="allow-scripts allow-same-origin"
                    title={currentFile.name}
                  />
                </div>
              </div>
            )}

            {viewType === 'md' && currentFile && (
              <div className="md-editor-view">
                <div className="md-editor-meta">
                  <div className="md-filename">
                    <FileText size={14} style={{ color: 'var(--hn-secondary)' }} />
                    {currentFile.name}
                  </div>
                </div>
                <div className="md-editor-split">
                  <div className="md-editor-pane" ref={mdEditorRef}>
                    <textarea
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        padding: '16px 24px',
                        fontFamily: 'var(--hn-font-code)',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        color: 'var(--hn-text-primary)',
                        background: 'var(--hn-surface)',
                      }}
                      value={currentFile.content}
                      onChange={(e) =>
                        setCurrentFile({ ...currentFile, content: e.target.value })
                      }
                    />
                  </div>
                  <div className="md-preview-pane" ref={mdPreviewRef}>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(currentFile.content),
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          <div className={`bottom-bar ${!currentFile ? 'hidden' : ''}`}>
            <div className="bottom-bar-nav">
              <div className="doc-nav-info">
                <span className="doc-nav-folder">
                  <Folder size={12} />
                  {currentFile?.folder}
                </span>
                <span className="doc-nav-position">
                  {siblingIndex >= 0 ? `${siblingIndex + 1} / ${siblings.length}` : ''}
                </span>
              </div>
              <div className="doc-nav-controls">
                <button
                  className="doc-nav-btn"
                  disabled={siblingIndex <= 0}
                  onClick={() => navigateDoc(-1)}
                >
                  <ArrowLeft size={12} />
                  <span>上一篇</span>
                  <kbd>K</kbd>
                </button>
                <button
                  className="doc-nav-btn"
                  disabled={siblingIndex >= siblings.length - 1}
                  onClick={() => navigateDoc(1)}
                >
                  <span>下一篇</span>
                  <ArrowRight size={12} />
                  <kbd>J</kbd>
                </button>
              </div>
            </div>
            <div className="bottom-bar-separator" />
            <div className="bottom-bar-views">
              <button
                className={`view-btn ${viewType === 'empty' ? 'active' : ''}`}
                onClick={() => {
                  setViewType('empty');
                  setCurrentFile(null);
                }}
              >
                空状态
              </button>
              <button
                className={`view-btn ${viewType === 'html' ? 'active' : ''}`}
                onClick={() => {
                  if (currentFile) setViewType('html');
                }}
                disabled={!currentFile}
                title="HTML 预览"
              >
                HTML
              </button>
              <button
                className={`view-btn ${viewType === 'md' ? 'active' : ''}`}
                onClick={() => {
                  if (currentFile) setViewType('md');
                }}
                disabled={!currentFile}
                title="Markdown 编辑"
              >
                MD
              </button>
              {currentFile?.fileType === 'yaml' && (
                <button
                  className={`view-btn ${viewType === 'yaml' ? 'active' : ''}`}
                  onClick={() => setViewType('yaml')}
                  title="YAML 预览"
                >
                  YAML
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className={`right-panel ${!rightPanelOpen ? 'hidden' : ''}`}>
          <div className="panel-header">
            <span>反链 & 标签</span>
            <button
              className="view-btn"
              onClick={() => setRightPanelOpen(false)}
            >
              <PanelRightClose size={14} />
            </button>
          </div>
          <div className="panel-tabs">
            <button className="panel-tab active">引用</button>
            <button className="panel-tab">出链</button>
            <button className="panel-tab">标签</button>
          </div>
          <div className="panel-content">
            {currentFile ? (
              <div style={{ padding: '16px', color: 'var(--hn-text-tertiary)', fontSize: 13 }}>
                反链面板将在 Phase 2 实现
              </div>
            ) : (
              <div style={{ padding: '16px', color: 'var(--hn-text-tertiary)', fontSize: 13, textAlign: 'center' }}>
                打开文件后查看引用关系
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Overlay */}
      <SearchOverlay
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onFileOpen={handleFileOpen}
        vaultPath={vaultPath || ''}
      />
    </div>
  );
}

export default App;
