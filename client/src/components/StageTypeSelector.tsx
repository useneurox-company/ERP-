import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { StageType } from '@shared/schema';
import { Check } from 'lucide-react';

interface StageTypeSelectorProps {
  selectedTypeId?: string | null;
  onSelectType: (typeId: string) => void;
}

export function StageTypeSelector({ selectedTypeId, onSelectType }: StageTypeSelectorProps) {
  const { data: allStageTypes = [], isLoading } = useQuery<StageType[]>({
    queryKey: ['/api/stage-types'],
  });

  // Filter only active stage types
  const stageTypes = allStageTypes.filter(type => type.is_active);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Выберите тип этапа</h3>
        {selectedTypeId && (
          <Badge variant="outline" className="text-xs">
            {stageTypes.find(st => st.id === selectedTypeId)?.name}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stageTypes.map((type) => {
          const isSelected = selectedTypeId === type.id;

          return (
            <Card
              key={type.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                isSelected ? 'border-primary border-2 bg-primary/5' : 'border-border'
              }`}
              onClick={() => onSelectType(type.id)}
            >
              <div className="flex flex-col items-center text-center space-y-2 relative">
                {isSelected && (
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="w-3 h-3" />
                  </div>
                )}

                <div className="text-4xl">{type.icon}</div>

                <div className="space-y-1">
                  <h4 className="font-medium text-sm">{type.name}</h4>
                  {type.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {type.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {stageTypes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Типы этапов не найдены</p>
        </div>
      )}
    </div>
  );
}
