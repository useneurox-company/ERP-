import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DealStage } from "@shared/schema";

interface BulkStageChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newStage: string) => void;
  selectedCount: number;
  stages: DealStage[];
  isPending?: boolean;
}

export function BulkStageChangeDialog({
  open,
  onOpenChange,
  onConfirm,
  selectedCount,
  stages,
  isPending = false
}: BulkStageChangeDialogProps) {
  const [selectedStage, setSelectedStage] = useState<string>("");

  const handleConfirm = () => {
    if (selectedStage) {
      onConfirm(selectedStage);
      setSelectedStage("");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedStage("");
    }
    onOpenChange(newOpen);
  };

  const selectedStageName = stages.find(s => s.key === selectedStage)?.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="dialog-bulk-stage-change">
        <DialogHeader>
          <DialogTitle>Изменить этап сделок</DialogTitle>
          <DialogDescription>
            Выберите новый этап для {selectedCount}{" "}
            {selectedCount === 1 ? "сделки" : selectedCount < 5 ? "сделок" : "сделок"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Select value={selectedStage} onValueChange={setSelectedStage}>
            <SelectTrigger data-testid="select-stage">
              <SelectValue placeholder="Выберите этап" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.key} value={stage.key}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color || "#6366f1" }}
                    />
                    {stage.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
            data-testid="button-cancel"
          >
            Отмена
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedStage || isPending}
            data-testid="button-confirm"
          >
            {isPending ? "Изменение..." : "Изменить этап"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
