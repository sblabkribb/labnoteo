import type {
  LabNoteDocument,
  WorkflowDocument,
  WorkflowReference,
  UnitOperationBlock,
} from './sectionTypes';

/** Sample id -> alias + first description line (from resources/labsamples JSON). */
export type SampleDefMap = Record<string, { alias: string | null; description: string | null }>;

// Extension <-> Webview message types (Section Editor webview protocol).
export type ExtensionToWebviewMessage =
  | {
      type: 'init';
      data: {
        mode: string;
        labNote?: LabNoteDocument;
        workflow?: WorkflowDocument;
        linkedWorkflows?: WorkflowDocument[];
        parentLabNotePath?: string;
        docBaseUri?: string;
        availableTypes?: string[];
        /** Built-in + custom sample type → hex color map, injected from extension sampleUtils. */
        sampleTypeColors?: Record<string, string>;
        sampleDefs?: SampleDefMap;
      };
    }
  | { type: 'sampleDefsUpdated'; data: { sampleDefs: SampleDefMap } }
  | { type: 'unitOpAdded'; data: UnitOperationBlock }
  | { type: 'unitOpPasted'; data: { afterOpIndex: number; unitOp: UnitOperationBlock } }
  | { type: 'clipboardStateUpdated'; data: { hasUnitOp: boolean } }
  | { type: 'sampleInserted'; data: { text: string } }
  | { type: 'textInserted'; data: { text: string } }
  | { type: 'workflowAdded'; data: WorkflowReference & { workflow?: WorkflowDocument } }
  | { type: 'sampleDefinitionCreated'; data: { definitionText: string; opIndex: number; secIndex: number; opId?: string; uoId?: string; secHeading?: string } }
  | { type: 'documentChanged'; data: { labNote?: LabNoteDocument; workflow?: WorkflowDocument } }
  | { type: 'saveCompleted' }
  | { type: 'saveFailed' }
  | { type: 'imagePasted'; data: { markdownText: string } }
  | { type: 'productSearchResult'; data: { alias: string; description: string } }
  | { type: 'customTypesUpdated'; data: { availableTypes: string[]; sampleTypeColors?: Record<string, string> } }
  | { type: 'scrollToSample'; data: { area: string; sectionIndex?: number; opIndex?: number; secIndex?: number; localOffset: number } }
  | {
      type: 'fileAttached';
      data: {
        markdownLink: string;
        area: 'unitOp' | 'labnoteSection' | 'tailContent' | 'linkedUnitOp';
        opIndex?: number;
        secIndex?: number;
        sectionIndex?: number;
        linkedWfIndex?: number;
        /**
         * Issue #20: caret offset within the target section content at the
         * moment the user clicked the paperclip. Echoed back by the extension
         * verbatim so the webview can insert the link inline. Omitted when the
         * webview could not unambiguously match the focused textarea to the
         * click target, in which case the link is appended at the end.
         */
        cursorPos?: number;
      };
    };

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'save'; data: any }
  | { type: 'openAsText' }
  | { type: 'openImagePreview'; data: { imagePath: string; altText?: string } }
  | { type: 'createSampleFromModal'; data: { sampleType: string; alias: string; description: string; opIndex: number; secIndex: number; opId?: string; uoId?: string; secHeading?: string } }
  | { type: 'searchProducts'; data: { sampleType: string } }
  | { type: 'addCustomType'; data: { typeName: string } }
  | { type: 'navigateToSample'; data: { sampleId: string; sampleType: string } }
  | { type: 'openWorkflow'; data: { link: string } }
  | { type: 'renumberWorkflows' }
  | { type: 'deleteWorkflow'; data: { link: string } }
  | { type: 'pasteImage'; data: { imageBase64: string; mimeType: string } }
  | {
      type: 'attachFile';
      data: {
        area: 'unitOp' | 'labnoteSection' | 'tailContent' | 'linkedUnitOp';
        opIndex?: number;
        secIndex?: number;
        sectionIndex?: number;
        linkedWfIndex?: number;
        /** Issue #20: see `fileAttached.data.cursorPos`. */
        cursorPos?: number;
      };
    }
  | { type: 'openAttachment'; data: { path: string } }
  | { type: 'copyUnitOp'; data: { payload: string } }
  | { type: 'requestPasteUnitOp'; data: { afterOpIndex: number } }
  | { type: 'queryClipboardState' }
  | {
      type: 'sendSelectionToChat';
      data: {
        selectedText: string;
        chatContextOpId?: string;
        chatContextSectionHeading?: string;
      };
    };
