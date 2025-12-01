import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Check, X } from "lucide-react";

interface InlineEditFieldProps {
  value: string | number | null | undefined;
  onSave: (value: string) => void;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'number';
  placeholder?: string;
  icon?: React.ReactNode;
  formatter?: (value: string | number | null | undefined) => string;
  validator?: (value: string) => boolean;
  displayClassName?: string;
}

export function InlineEditField({
  value,
  onSave,
  label,
  type = 'text',
  placeholder,
  icon,
  formatter,
  validator,
  displayClassName,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const displayValue = formatter ? formatter(value) : (value || '—');

  const handleStartEdit = () => {
    setEditValue(value?.toString() || '');
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
    setError(null);
  };

  const handleSave = () => {
    // Validate if validator provided
    if (validator && !validator(editValue)) {
      setError('Неверный формат');
      return;
    }

    onSave(editValue);
    setIsEditing(false);
    setEditValue('');
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center gap-2 group">
          <div className="flex items-center gap-2 text-sm">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            <span className={`${!value ? 'text-muted-foreground' : ''} ${displayClassName || ''}`}>{displayValue}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleStartEdit}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-1">
        <Input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`h-8 text-sm ${error ? 'border-destructive' : ''}`}
          autoFocus
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={handleSave}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
          onClick={handleCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
