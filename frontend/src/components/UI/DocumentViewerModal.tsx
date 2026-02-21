import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Blob URL or any URL to display */
  url: string;
  /** MIME type, e.g. application/pdf, image/jpeg */
  contentType?: string;
  /** Optional display title */
  fileName?: string;
}

/**
 * In-app document preview modal. Renders PDF in iframe, images in img.
 * Use with blob URLs from getReportFileUrl etc. Caller must revoke the blob URL on close.
 */
const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  url,
  contentType = "application/pdf",
  fileName,
}) => {
  if (!isOpen || !url) return null;

  const isImage = contentType.startsWith("image/");

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4">
      <div className="card max-w-4xl w-full h-[90vh] max-h-[90vh] overflow-hidden flex flex-col bg-slate-900/95 border border-white/10">
        <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-semibold text-gray-100 truncate flex-1 mr-4">
            {fileName || "Document preview"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200 shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 min-h-0 flex flex-col overflow-auto p-4">
          {isImage ? (
            <img
              src={url}
              alt={fileName || "Document"}
              className="max-w-full h-auto rounded-lg mx-auto"
            />
          ) : (
            <iframe
              src={url}
              title={fileName || "Document"}
              className="flex-1 min-h-0 w-full rounded-lg border border-white/10 bg-white"
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DocumentViewerModal;
