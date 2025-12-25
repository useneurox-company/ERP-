import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DealContact } from "@shared/schema";

interface DealContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  contact?: DealContact;
}

interface ContactFormData {
  name: string;
  position: string;
  phone: string;
  email: string;
  is_primary: boolean;
}

export function DealContactDialog({
  open,
  onOpenChange,
  dealId,
  contact,
}: DealContactDialogProps) {
  const { toast } = useToast();
  const isEditing = !!contact;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactFormData>({
    defaultValues: {
      name: "",
      position: "",
      phone: "",
      email: "",
      is_primary: false,
    },
  });

  const isPrimary = watch("is_primary");

  useEffect(() => {
    if (contact) {
      reset({
        name: contact.name,
        position: contact.position || "",
        phone: contact.phone || "",
        email: contact.email || "",
        is_primary: Boolean(contact.is_primary),
      });
    } else {
      reset({
        name: "",
        position: "",
        phone: "",
        email: "",
        is_primary: false,
      });
    }
  }, [contact, reset, open]);

  const createContact = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return await apiRequest("POST", `/api/deals/${dealId}/contacts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId] });
      toast({
        title: "Контакт добавлен",
        description: "Контактное лицо успешно добавлено",
      });
      onOpenChange(false);
      reset();
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить контакт",
        variant: "destructive",
      });
    },
  });

  const updateContact = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return await apiRequest("PUT", `/api/deal-contacts/${contact!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId] });
      toast({
        title: "Контакт обновлен",
        description: "Контактное лицо успешно обновлено",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить контакт",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    if (isEditing) {
      updateContact.mutate(data);
    } else {
      createContact.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Редактировать контакт" : "Добавить контакт"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Измените информацию о контактном лице"
              : "Добавьте новое контактное лицо к сделке"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Имя <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                {...register("name", { required: "Введите имя контакта" })}
                placeholder="Иван Петров"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="position">Должность</Label>
              <Input
                id="position"
                {...register("position")}
                placeholder="Директор"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                type="tel"
                {...register("phone")}
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email", {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Неверный формат email",
                  },
                })}
                placeholder="email@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_primary"
                checked={isPrimary}
                onCheckedChange={(checked) => setValue("is_primary", !!checked)}
              />
              <Label
                htmlFor="is_primary"
                className="text-sm font-normal cursor-pointer"
              >
                Основной контакт
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={createContact.isPending || updateContact.isPending}
            >
              {isEditing ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
