// Типы для работы с зависимостями
export interface LocalStageDependency {
  stage_id: string;
  depends_on_stage_id: string;
}

export interface ChainInfo {
  chainId: string;
  color: string;
  level: number; // глубина в цепочке (0 = корень)
  hasParents: boolean;
  hasChildren: boolean;
}

// Палитра цветов для разных цепочек (только граница, без фона)
const COLOR_PALETTE = [
  'border-blue-500',      // синий
  'border-green-500',    // зелёный
  'border-purple-500',  // фиолетовый
  'border-orange-500',  // оранжевый
  'border-pink-500',      // розовый
  'border-cyan-500',      // голубой
  'border-amber-500',    // жёлтый
  'border-red-500',        // красный
];

/**
 * Проверяет есть ли цикл при добавлении новой зависимости
 * Использует DFS (поиск в глубину)
 */
export function wouldCreateCycle(
  fromStageId: string,
  toStageId: string,
  dependencies: LocalStageDependency[]
): boolean {
  if (fromStageId === toStageId) return true;

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(stageId: string): boolean {
    visited.add(stageId);
    recursionStack.add(stageId);

    // Найти все зависимости этого этапа
    const dependentStages = dependencies
      .filter(d => d.stage_id === stageId)
      .map(d => d.depends_on_stage_id);

    for (const depStageId of dependentStages) {
      // Если зависимость ведёт на toStageId, будет цикл
      if (depStageId === toStageId) {
        return true;
      }

      if (!visited.has(depStageId)) {
        if (hasCycle(depStageId)) {
          return true;
        }
      } else if (recursionStack.has(depStageId)) {
        return true;
      }
    }

    recursionStack.delete(stageId);
    return false;
  }

  return hasCycle(fromStageId);
}

/**
 * Находит все этапы в цепочке (вверх и вниз по зависимостям)
 */
export function findChainMembers(
  stageId: string,
  dependencies: LocalStageDependency[]
): string[] {
  const members = new Set<string>();
  const visited = new Set<string>();

  function traverse(id: string, direction: 'up' | 'down' | 'both') {
    if (visited.has(id)) return;
    visited.add(id);
    members.add(id);

    if (direction === 'up' || direction === 'both') {
      // Найти этапы которые зависят от текущего (родители)
      dependencies
        .filter(d => d.stage_id === id)
        .forEach(d => traverse(d.depends_on_stage_id, 'up'));
    }

    if (direction === 'down' || direction === 'both') {
      // Найти этапы которые зависят от текущего (дети)
      dependencies
        .filter(d => d.depends_on_stage_id === id)
        .forEach(d => traverse(d.stage_id, 'down'));
    }
  }

  traverse(stageId, 'both');
  return Array.from(members);
}

/**
 * Рассчитывает цепочки и присваивает им цвета
 */
export function assignChainColors(
  stageIds: string[],
  dependencies: LocalStageDependency[]
): Map<string, ChainInfo> {
  const chainMap = new Map<string, ChainInfo>();
  const visited = new Set<string>();
  let colorIndex = 0;

  for (const stageId of stageIds) {
    if (visited.has(stageId)) continue;

    // Найти цепочку этого этапа
    const chainMembers = findChainMembers(stageId, dependencies);

    // Фильтруем - берём только членов цепочки, которые на самом деле участвуют в зависимостях
    const membersWithDependencies = chainMembers.filter(memberId => {
      const hasParents = dependencies.some(d => d.stage_id === memberId);
      const hasChildren = dependencies.some(d => d.depends_on_stage_id === memberId);
      return hasParents || hasChildren;
    });

    // Если цепочка имеет зависимости, назначаем цвет
    if (membersWithDependencies.length > 0) {
      const color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
      const chainId = `chain-${colorIndex}`;

      // Для каждого члена цепочки вычислить уровень (глубину)
      for (const memberId of membersWithDependencies) {
        const level = calculateLevel(memberId, dependencies);
        const hasParents = dependencies.some(d => d.stage_id === memberId);
        const hasChildren = dependencies.some(d => d.depends_on_stage_id === memberId);

        chainMap.set(memberId, {
          chainId,
          color,
          level,
          hasParents,
          hasChildren,
        });

        visited.add(memberId);
      }

      colorIndex++;
    } else {
      // Если нет зависимостей, просто отметить как посещённый
      visited.add(stageId);
    }
  }

  return chainMap;
}

/**
 * Вычисляет уровень этапа в цепочке зависимостей
 * Корневые этапы имеют уровень 0
 */
function calculateLevel(stageId: string, dependencies: LocalStageDependency[]): number {
  const parents = dependencies
    .filter(d => d.stage_id === stageId)
    .map(d => d.depends_on_stage_id);

  if (parents.length === 0) return 0;

  const maxParentLevel = Math.max(
    ...parents.map(parentId => calculateLevel(parentId, dependencies))
  );

  return maxParentLevel + 1;
}

/**
 * Возвращает визуальный класс цвета для этапа
 */
export function getChainColorClass(chainInfo?: ChainInfo): string {
  if (!chainInfo) return 'border-border bg-card';
  // Возвращаем класс с цветной границей и обычным фоном
  return `${chainInfo.color} bg-card`;
}

/**
 * Возвращает текстовый цвет соответствующий фону
 */
export function getChainTextColor(colorClass: string): string {
  return TEXT_COLOR_MAP[colorClass as keyof typeof TEXT_COLOR_MAP] || 'text-gray-600';
}

/**
 * Фильтрует доступные зависимости (убирает циклы и сам этап)
 */
export function getAvailableDependencies(
  stageId: string,
  allStageIds: string[],
  currentDependencies: LocalStageDependency[],
  alreadyDepends: string[] // этапы от которых уже зависит стейдж
): string[] {
  // Получаем все этапы которые уже зависят от текущего (прямо или косвенно)
  const allDependents = getAllDependentsRecursive(stageId, currentDependencies);

  return allStageIds.filter(id => {
    // Не добавляем сам этап
    if (id === stageId) return false;

    // Не добавляем если уже есть эта зависимость
    if (alreadyDepends.includes(id)) return false;

    // Проверяем что не будет прямого цикла (A→B→A)
    if (wouldCreateCycle(stageId, id, currentDependencies)) return false;

    // Проверяем что не будет обратного цикла (если A зависит от B, то B не может зависеть от A)
    if (allDependents.has(id)) return false;

    return true;
  });
}

/**
 * Получает все этапы от которых зависит данный этап
 */
export function getDirectDependencies(
  stageId: string,
  dependencies: LocalStageDependency[]
): string[] {
  return dependencies
    .filter(d => d.stage_id === stageId)
    .map(d => d.depends_on_stage_id);
}

/**
 * Получает все этапы которые зависят от данного этапа (прямые потомки)
 */
export function getDependents(
  stageId: string,
  dependencies: LocalStageDependency[]
): string[] {
  return dependencies
    .filter(d => d.depends_on_stage_id === stageId)
    .map(d => d.stage_id);
}

/**
 * Получает все этапы которые (прямо или косвенно) зависят от данного этапа
 * Нужно для предотвращения обратных циклических зависимостей
 */
export function getAllDependentsRecursive(
  stageId: string,
  dependencies: LocalStageDependency[]
): Set<string> {
  const allDependents = new Set<string>();

  function traverse(id: string) {
    const directDependents = getDependents(id, dependencies);
    for (const dependent of directDependents) {
      if (!allDependents.has(dependent)) {
        allDependents.add(dependent);
        traverse(dependent);
      }
    }
  }

  traverse(stageId);
  return allDependents;
}
