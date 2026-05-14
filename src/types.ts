export type ExplorerNode = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: ExplorerNode[];
  open?: boolean;
};
