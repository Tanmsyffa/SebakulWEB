'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { TabIndicator } from '@/components/motion/tab-indicator';

interface TabsState {
  activeValue: string;
  selectTab: (next: string) => void;
  baseId: string;
  registerTab: (value: string, el: HTMLButtonElement | null) => void;
  focusRelative: (currentValue: string, direction: 'prev' | 'next' | 'first' | 'last') => void;
}

const TabsContext = React.createContext<TabsState | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error('Komponen Tabs harus digunakan di dalam <Tabs>.');
  return ctx;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({
  value,
  defaultValue = '',
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const activeValue = value !== undefined ? value : internalValue;
  const baseId = React.useId();
  const tabElementsRef = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  const selectTab = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternalValue(next);
      onValueChange?.(next);
    },
    [value, onValueChange]
  );

  const registerTab = React.useCallback((tabVal: string, el: HTMLButtonElement | null) => {
    if (el) {
      tabElementsRef.current.set(tabVal, el);
    } else {
      tabElementsRef.current.delete(tabVal);
    }
  }, []);

  const focusRelative = React.useCallback(
    (currentValue: string, direction: 'prev' | 'next' | 'first' | 'last') => {
      const entries = Array.from(tabElementsRef.current.entries()).filter(
        ([, el]) => !el.disabled
      );
      if (entries.length === 0) return;

      const currentIdx = entries.findIndex(([v]) => v === currentValue);
      let nextIdx = 0;

      if (direction === 'first') nextIdx = 0;
      else if (direction === 'last') nextIdx = entries.length - 1;
      else if (direction === 'next') nextIdx = (currentIdx + 1) % entries.length;
      else nextIdx = (currentIdx - 1 + entries.length) % entries.length;

      const [nextValue, nextEl] = entries[nextIdx];
      nextEl.focus();
      selectTab(nextValue);
    },
    [selectTab]
  );

  return (
    <TabsContext.Provider
      value={{ activeValue, selectTab, baseId, registerTab, focusRelative }}
    >
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

export function TabsList({ className, label, children, ...props }: TabsListProps) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-surface-muted p-1',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({
  value,
  className,
  children,
  disabled,
  onClick,
  onKeyDown,
  ...props
}: TabsTriggerProps) {
  const { activeValue, selectTab, baseId, registerTab, focusRelative } = useTabsContext();
  const selected = activeValue === value;
  const tabId = `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  return (
    <button
      ref={(el) => registerTab(value, el)}
      id={tabId}
      role="tab"
      type="button"
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) selectTab(value);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          focusRelative(value, 'next');
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          focusRelative(value, 'prev');
        } else if (event.key === 'Home') {
          event.preventDefault();
          focusRelative(value, 'first');
        } else if (event.key === 'End') {
          event.preventDefault();
          focusRelative(value, 'last');
        }
      }}
      className={cn(
        'relative inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:pointer-events-none disabled:opacity-50',
        selected ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
        className
      )}
      {...props}
    >
      {selected && (
        <TabIndicator
          layoutId={`${baseId}-indicator`}
          className="absolute inset-0 rounded-md bg-surface shadow-xs"
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const { activeValue, baseId } = useTabsContext();
  const selected = activeValue === value;

  if (!selected) return null;

  return (
    <div
      id={`${baseId}-panel-${value}`}
      role="tabpanel"
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={cn('mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-xl', className)}
      {...props}
    >
      {children}
    </div>
  );
}
