import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import type { ExplorerNode } from './types';

const newNode = (type: 'file' | 'folder'): ExplorerNode => ({
  id: `node-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: type === 'file' ? 'new-file.txt' : 'New Folder',
  type,
  content: type === 'file' ? 'New file content...' : undefined,
  children: type === 'folder' ? [] : undefined,
  open: type === 'folder'
});

const cloneNodes = (nodes: ExplorerNode[]): ExplorerNode[] =>
  nodes.map(node => ({
    ...node,
    children: node.children ? cloneNodes(node.children) : undefined
  }));

const findNodeById = (nodes: ExplorerNode[], id: string): ExplorerNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

const updateNodes = (
  nodes: ExplorerNode[],
  id: string,
  callback: (node: ExplorerNode, parent?: ExplorerNode) => void,
  parent?: ExplorerNode
): ExplorerNode[] =>
  nodes.map(node => {
    if (node.id === id) {
      const clone = { ...node, children: node.children ? cloneNodes(node.children) : undefined };
      callback(clone, parent);
      return clone;
    }
    if (node.children) {
      return { ...node, children: updateNodes(node.children, id, callback, node) };
    }
    return node;
  });

const removeNodeById = (nodes: ExplorerNode[], id: string): ExplorerNode[] =>
  nodes
    .filter(node => node.id !== id)
    .map(node => ({
      ...node,
      children: node.children ? removeNodeById(node.children, id) : undefined
    }));

const STORAGE_KEY = 'storebox-file-explorer';

function App() {
  const [nodes, setNodes] = useState<ExplorerNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ExplorerNode[];
      setNodes(parsed);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
  }, [nodes]);

  const selectedNode = useMemo(() => {
    if (!selectedId) return undefined;
    return findNodeById(nodes, selectedId);
  }, [nodes, selectedId]);

  const createRootNode = (type: 'file' | 'folder') => {
    const node = newNode(type);
    setNodes((prev: ExplorerNode[]) => [...prev, node]);
    setSelectedId(node.id);
    setEditingId(node.id);
    setRenameValue(node.name);
  };

  const createChildNode = (parentId: string, type: 'file' | 'folder') => {
    const node = newNode(type);
    setNodes((prev: ExplorerNode[]) =>
      updateNodes(prev, parentId, parent => {
        if (parent.type === 'folder') {
          parent.children = parent.children ? [...parent.children, node] : [node];
        }
      })
    );
    setSelectedId(node.id);
    setEditingId(node.id);
    setRenameValue(node.name);
  };

  const updateName = (id: string, name: string) => {
    setNodes((prev: ExplorerNode[]) => updateNodes(prev, id, node => {
      node.name = name;
    }));
  };

  const updateContent = (id: string, content: string) => {
    setNodes((prev: ExplorerNode[]) => updateNodes(prev, id, node => {
      if (node.type === 'file') node.content = content;
    }));
  };

  const deleteNode = (id: string) => {
    setNodes((prev: ExplorerNode[]) => removeNodeById(prev, id));
    if (selectedId === id) setSelectedId(null);
  };

  const toggleFolder = (id: string) => {
    setNodes((prev: ExplorerNode[]) => updateNodes(prev, id, node => {
      if (node.type === 'folder') node.open = !node.open;
    }));
  };

  const handleRenameSubmit = () => {
    if (!editingId) return;
    updateName(editingId, renameValue.trim() || 'Untitled');
    setEditingId(null);
  };

  const renderTree = (items: ExplorerNode[], depth = 0): ReactNode[] => {
    return items.flatMap(node => [
      <div key={`${node.id}-row`} className="tree-row" style={{ marginLeft: depth * 16 }}>
        <button
          className="tree-toggle"
          onClick={() => node.type === 'folder' && toggleFolder(node.id)}
          aria-label={node.type === 'folder' ? 'Toggle folder' : 'File icon'}
          type="button"
        >
          {node.type === 'folder' ? (node.open ? '📂' : '📁') : '📄'}
        </button>
        {editingId === node.id ? (
          <form
            className="rename-form"
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              handleRenameSubmit();
            }}
          >
            <input
              value={renameValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRenameValue(e.target.value)}
              autoFocus
              onBlur={handleRenameSubmit}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRenameSubmit();
                }
                if (e.key === 'Escape') {
                  setEditingId(null);
                }
              }}
              className="rename-input"
            />
          </form>
        ) : (
          <button
            className={`tree-label ${selectedId === node.id ? 'selected' : ''}`}
            type="button"
            onClick={() => {
              if (node.type === 'folder') toggleFolder(node.id);
              setSelectedId(node.id);
            }}
          >
            {node.name}
          </button>
        )}

        <div className="tree-actions">
          {node.type === 'folder' && (
            <>
              <button type="button" onClick={() => createChildNode(node.id, 'file')}>
                + file
              </button>
              <button type="button" onClick={() => createChildNode(node.id, 'folder')}>
                + folder
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingId(node.id);
              setRenameValue(node.name);
            }}
          >
            rename
          </button>
          <button type="button" onClick={() => deleteNode(node.id)}>
            delete
          </button>
        </div>
      </div>,
      node.type === 'folder' && node.open && node.children && node.children.length > 0 ? (
        <div key={`${node.id}-children`} className="tree-branch">
          {renderTree(node.children, depth + 1)}
        </div>
      ) : null
    ]);
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <h1>Storebox File Explorer</h1>
          <p>VS Code-style file explorer with folders and files.</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => createRootNode('file')}>
            Create file
          </button>
          <button onClick={() => createRootNode('folder')}>
            Create folder
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel explorer-panel">
          <div className="panel-header">Explorer</div>
          <div className="tree-view">
            {nodes.length === 0 ? (
              <div className="empty-state">No files or folders yet. Use the buttons above.</div>
            ) : (
              renderTree(nodes)
            )}
          </div>
        </section>

        <section className="panel detail-panel">
          <div className="panel-header">Details</div>
          {selectedNode ? (
            <div className="detail-content">
              <div className="detail-row">
                <strong>Name</strong>
                <span>{selectedNode.name}</span>
              </div>
              <div className="detail-row">
                <strong>Type</strong>
                <span>{selectedNode.type}</span>
              </div>
              {selectedNode.type === 'file' ? (
                <>
                  <strong>File content</strong>
                  <textarea
                    value={selectedNode.content ?? ''}
                    onChange={e => updateContent(selectedNode.id, e.target.value)}
                    className="editor"
                  />
                </>
              ) : (
                <div className="folder-info">This folder can contain nested files and folders.</div>
              )}
            </div>
          ) : (
            <div className="empty-state detail-empty">Select a file or folder to edit.</div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
