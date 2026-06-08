interface Window {
  siyuan: {
    notebooks: any;
    menus: any;
    dialogs: any;
    blockPanels: any;
    storage: any;
    user: any;
    ws: any;
    languages: any;
  };
  sySketchNote?: {
    openEditor: (blockId: string, sourceBlockId?: string | null) => void;
  };
}
