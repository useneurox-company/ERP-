import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Paperclip, FileSpreadsheet, Receipt, FileSignature, Copy } from "lucide-react";
import type { DealDocument, DealAttachment } from "@shared/schema";

interface AllDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: DealDocument[];
  attachments?: DealAttachment[];
  isLoading: boolean;
  dealId?: string;
  onCloneDocument?: (docId: string) => void;
}

const documentTypeLabels = {
  quote: "КП",
  invoice: "Счёт",
  contract: "Договор",
  other: "Прочее"
};

const getDocumentIcon = (type: string) => {
  switch (type) {
    case 'quote':
      return <FileSpreadsheet className="w-5 h-5 text-blue-500 flex-shrink-0" />;
    case 'invoice':
      return <Receipt className="w-5 h-5 text-green-500 flex-shrink-0" />;
    case 'contract':
      return <FileSignature className="w-5 h-5 text-purple-500 flex-shrink-0" />;
    default:
      return <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />;
  }
};

const getDocumentBadgeColor = (type: string) => {
  switch (type) {
    case 'quote':
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case 'invoice':
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case 'contract':
      return "bg-purple-100 text-purple-700 hover:bg-purple-100";
    default:
      return "bg-gray-100 text-gray-700 hover:bg-gray-100";
  }
};

// Build document tree hierarchy
const buildDocumentTree = (docs: DealDocument[]) => {
  const tree: { [key: string]: DealDocument[] } = {};
  const roots: DealDocument[] = [];

  // First pass: identify root documents (no parent) and group children by parent
  docs.forEach(doc => {
    if (!doc.parent_id) {
      roots.push(doc);
    } else {
      if (!tree[doc.parent_id]) {
        tree[doc.parent_id] = [];
      }
      tree[doc.parent_id].push(doc);
    }
  });

  // Sort children by document_number
  Object.keys(tree).forEach(parentId => {
    tree[parentId].sort((a, b) => {
      const numA = parseFloat(a.document_number?.split('.').pop() || '0');
      const numB = parseFloat(b.document_number?.split('.').pop() || '0');
      return numA - numB;
    });
  });

  return { roots, children: tree };
};

export function AllDocumentsDialog({ open, onOpenChange, documents, attachments = [], isLoading, dealId, onCloneDocument }: AllDocumentsDialogProps) {
  const handleDownload = (doc: DealDocument) => {
    if (doc.document_type === 'contract' && doc.file_url) {
      // For contracts, download the uploaded file directly
      window.open(doc.file_url, '_blank');
    } else if ((doc.document_type === 'quote' || doc.document_type === 'invoice') && dealId) {
      // For quotes and invoices, download the generated HTML
      window.open(`/api/deals/${dealId}/documents/${doc.id}/html`, '_blank');
    }
  };

  const handleAttachmentDownload = (attachment: DealAttachment) => {
    // Download attachment from server
    const link = document.createElement('a');
    link.href = attachment.file_path;
    link.download = attachment.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sortedDocuments = [...(documents ?? [])].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const sortedAttachments = [...(attachments ?? [])].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const hasContent = sortedDocuments.length > 0 || sortedAttachments.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-all-documents">
        <DialogHeader>
          <DialogTitle>Все документы</DialogTitle>
          <DialogDescription>
            Структурированные документы и вложения сделки
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="status-documents-loading">
            Загрузка...
          </div>
        ) : !hasContent ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="status-documents-empty">
            Документы отсутствуют
          </div>
        ) : (
          <div className="space-y-6">
            {/* Attachments Section */}
            {sortedAttachments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  Вложения ({sortedAttachments.length})
                </h3>
                <div className="space-y-3">
                  {sortedAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-4 border rounded-md hover-elevate"
                      data-testid={`attachment-item-${attachment.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <h4 className="font-medium truncate" data-testid={`attachment-name-${attachment.id}`}>
                            {attachment.file_name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {attachment.file_size && (
                            <span className="text-xs">
                              {(attachment.file_size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          )}
                          {attachment.mime_type && (
                            <span className="text-xs">• {attachment.mime_type}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(attachment.created_at).toLocaleDateString('ru-RU', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAttachmentDownload(attachment)}
                        className="ml-4"
                        data-testid={`button-download-attachment-${attachment.id}`}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Скачать
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents Section */}
            {sortedDocuments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Документы ({sortedDocuments.length})
                </h3>
                <div className="space-y-3">
                  {sortedDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 border rounded-md hover-elevate"
                data-testid={`document-item-${doc.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getDocumentIcon(doc.document_type || 'other')}
                    <h4 className="font-medium truncate" data-testid={`document-name-${doc.id}`}>
                      {doc.name}
                    </h4>
                    {doc.is_signed && (
                      <Badge variant="default" className="text-xs">Подписан</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className={`text-xs ${getDocumentBadgeColor(doc.document_type || 'other')}`}>
                      {documentTypeLabels[(doc.document_type || 'other') as keyof typeof documentTypeLabels]}
                    </Badge>
                    {doc.version && (
                      <span className="text-xs">Версия {doc.version}</span>
                    )}
                    {doc.total_amount && (
                      <span className="text-xs">
                        • {Number(doc.total_amount).toLocaleString('ru-RU')} ₽
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(doc.created_at).toLocaleDateString('ru-RU', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  {doc.document_type === 'quote' && onCloneDocument && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCloneDocument(doc.id)}
                      className="whitespace-nowrap"
                      data-testid={`button-clone-document-${doc.id}`}
                      title="Создать копию этого КП с новым номером"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Копировать
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    data-testid={`button-download-document-${doc.id}`}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Скачать
                  </Button>
                </div>
              </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
