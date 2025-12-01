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

interface DeleteDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  dealName: string;
  isPending?: boolean;
}

export function DeleteDealDialog({ open, onOpenChange, onConfirm, dealName, isPending = false }: DeleteDealDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-delete-deal">
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить сделку?</AlertDialogTitle>
          <AlertDialogDescription>
            Вы действительно хотите удалить сделку <span className="font-semibold">{dealName}</span>? 
            Это действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete" disabled={isPending}>
            Отмена
          </AlertDialogCancel>
          <AlertDialogAction 
            data-testid="button-confirm-delete"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Удаление..." : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
