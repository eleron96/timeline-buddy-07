import React, { useState } from 'react';
import { Input } from '@/shared/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { cn } from '@/shared/lib/classNames';

const EMOJI_OPTIONS = [
  '📝', '🚧', '✅', '🚫', '⏳', '⚡', '🔥', '⭐', '🎯', '💡',
  '🔍', '🧩', '🛠️', '🧪', '🚀', '📌', '📅', '🧠', '🔒', '🔓',
  '📣', '🗂️', '🧭', '📦', '🧹', '🧯', '🕒', '🆕', '🧰', '🧼',
];

interface EmojiPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  value,
  onChange,
  placeholder = '🙂',
  disabled = false,
  className,
  onKeyDown,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className={cn('w-16 text-center', className)}
        />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex flex-wrap gap-1">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
              className={cn(
                'h-8 w-8 rounded-md text-lg leading-none hover:bg-muted',
                value === emoji && 'bg-muted',
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="mt-2 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="w-full rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Clear emoji
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
