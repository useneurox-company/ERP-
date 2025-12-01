import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Star, Edit, Trash2, Plus, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DealContactDialog } from "@/components/DealContactDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DealContact } from "@shared/schema";

interface DealContactsListProps {
  dealId: string;
}

export function DealContactsList({ dealId }: DealContactsListProps) {
  const { toast } = useToast();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<DealContact | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<DealContact | null>(null);

  const { data: contacts = [] } = useQuery<DealContact[]>({
    queryKey: ["/api/deals", dealId, "contacts"],
    enabled: !!dealId,
  });

  const deleteContact = useMutation({
    mutationFn: async (contactId: string) => {
      return await apiRequest("DELETE", `/api/deal-contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "contacts"] });
      toast({
        title: "Контакт удален",
        description: "Контактное лицо успешно удалено",
      });
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить контакт",
        variant: "destructive",
      });
    },
  });

  const handleAddContact = () => {
    setEditingContact(undefined);
    setContactDialogOpen(true);
  };

  const handleEditContact = (contact: DealContact) => {
    setEditingContact(contact);
    setContactDialogOpen(true);
  };

  const handleDeleteClick = (contact: DealContact) => {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (contactToDelete) {
      deleteContact.mutate(contactToDelete.id);
    }
  };

  return (
    <div>
      {contacts.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Нет контактных лиц
          </p>
          <Button variant="outline" size="sm" onClick={handleAddContact}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить контакт
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="p-3 bg-muted/30 rounded-lg space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{contact.name}</span>
                      {contact.is_primary && (
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                    {contact.position && (
                      <p className="text-xs text-muted-foreground">{contact.position}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleEditContact(contact)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(contact)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1 pl-6">
                {contact.phone && (
                  <div className="flex items-center gap-2 text-xs">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <a
                      href={`tel:${contact.phone}`}
                      className="hover:underline text-primary"
                    >
                      {contact.phone}
                    </a>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2 text-xs">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <a
                      href={`mailto:${contact.email}`}
                      className="hover:underline text-primary"
                    >
                      {contact.email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleAddContact}
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить контакт
          </Button>
        </div>
      )}

      <DealContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        dealId={dealId}
        contact={editingContact}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить контакт?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить контакт "{contactToDelete?.name}"? Это
              действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
