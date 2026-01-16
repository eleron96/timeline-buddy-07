import React, { useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Filter, 
  X, 
  ChevronDown, 
  ChevronRight,
  FolderKanban,
  Users,
  CircleDot,
  Tag,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const FilterSection: React.FC<FilterSectionProps> = ({ 
  title, 
  icon, 
  children, 
  defaultOpen = true 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-4 py-3 hover:bg-accent transition-colors text-left"
      >
        {icon}
        <span className="text-sm font-medium flex-1">{title}</span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-3 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
};

export const FilterPanel: React.FC = () => {
  const { 
    projects, 
    assignees, 
    statuses, 
    taskTypes, 
    tags,
    filters,
    setFilters,
    clearFilters,
  } = usePlannerStore();
  
  const hasActiveFilters = 
    filters.projectIds.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.statusIds.length > 0 ||
    filters.typeIds.length > 0 ||
    filters.tagIds.length > 0;
  
  const toggleFilter = (type: keyof typeof filters, id: string) => {
    const current = filters[type] as string[];
    const updated = current.includes(id)
      ? current.filter(i => i !== id)
      : [...current, id];
    setFilters({ [type]: updated });
  };
  
  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-semibold text-sm">Filters</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <FilterSection 
          title="Projects" 
          icon={<FolderKanban className="w-4 h-4 text-muted-foreground" />}
        >
          {projects.map(project => (
            <label
              key={project.id}
              className="flex items-center gap-2 py-1 cursor-pointer"
            >
              <Checkbox
                checked={filters.projectIds.includes(project.id)}
                onCheckedChange={() => toggleFilter('projectIds', project.id)}
              />
              <div 
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="text-sm truncate">{project.name}</span>
            </label>
          ))}
        </FilterSection>
        
        <FilterSection 
          title="Assignees" 
          icon={<Users className="w-4 h-4 text-muted-foreground" />}
        >
          {assignees.map(assignee => (
            <label
              key={assignee.id}
              className="flex items-center gap-2 py-1 cursor-pointer"
            >
              <Checkbox
                checked={filters.assigneeIds.includes(assignee.id)}
                onCheckedChange={() => toggleFilter('assigneeIds', assignee.id)}
              />
              <span className="text-sm truncate">{assignee.name}</span>
            </label>
          ))}
        </FilterSection>
        
        <FilterSection 
          title="Status" 
          icon={<CircleDot className="w-4 h-4 text-muted-foreground" />}
        >
          {statuses.map(status => (
            <label
              key={status.id}
              className="flex items-center gap-2 py-1 cursor-pointer"
            >
              <Checkbox
                checked={filters.statusIds.includes(status.id)}
                onCheckedChange={() => toggleFilter('statusIds', status.id)}
              />
              <div 
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: status.color }}
              />
              <span className="text-sm truncate">{status.name}</span>
            </label>
          ))}
        </FilterSection>
        
        <FilterSection 
          title="Type" 
          icon={<Layers className="w-4 h-4 text-muted-foreground" />}
          defaultOpen={false}
        >
          {taskTypes.map(type => (
            <label
              key={type.id}
              className="flex items-center gap-2 py-1 cursor-pointer"
            >
              <Checkbox
                checked={filters.typeIds.includes(type.id)}
                onCheckedChange={() => toggleFilter('typeIds', type.id)}
              />
              <span className="text-sm truncate">{type.name}</span>
            </label>
          ))}
        </FilterSection>
        
        <FilterSection 
          title="Tags" 
          icon={<Tag className="w-4 h-4 text-muted-foreground" />}
          defaultOpen={false}
        >
          {tags.map(tag => (
            <label
              key={tag.id}
              className="flex items-center gap-2 py-1 cursor-pointer"
            >
              <Checkbox
                checked={filters.tagIds.includes(tag.id)}
                onCheckedChange={() => toggleFilter('tagIds', tag.id)}
              />
              <div 
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <span className="text-sm truncate">{tag.name}</span>
            </label>
          ))}
        </FilterSection>
      </ScrollArea>
    </div>
  );
};
