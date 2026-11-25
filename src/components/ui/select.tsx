'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { m } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOTION_DURATION, MOTION_EASE, useHydratedReducedMotion } from '@/components/motion';

type SelectOption = { value: string; disabled?: boolean; children: React.ReactNode };

function flattenOptions(children: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.type === React.Fragment) {
      return flattenOptions(child.props.children);
    }
    return [child];
  });
}

export type SelectProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'name' | 'type' | 'value'
> &
  Pick<React.SelectHTMLAttributes<HTMLSelectElement>, 'name' | 'value' | 'defaultValue' | 'required'> & {
    onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  };

interface PopoverPlacement {
  style: React.CSSProperties;
  direction: 'down' | 'up';
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      children,
      value,
      defaultValue,
      onChange,
      disabled,
      required,
      id,
      name,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const listId = `${generatedId}-options`;
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const controlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState(String(defaultValue ?? ''));
    const selectedValue = controlled ? String(value ?? '') : internalValue;
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [placement, setPlacement] = React.useState<PopoverPlacement | null>(null);
    const prefersReduced = useHydratedReducedMotion();

    const options = React.useMemo(
      () =>
        flattenOptions(children).flatMap((child) => {
          if (!React.isValidElement<SelectOption>(child) || child.type !== 'option') return [];
          return [
            {
              value: String(child.props.value ?? ''),
              disabled: child.props.disabled,
              label: child.props.children,
            },
          ];
        }),
      [children]
    );
    const selectedIndex = options.findIndex((option) => option.value === selectedValue);
    const selected = options[selectedIndex];

    React.useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement);

    React.useEffect(() => {
      if (!open) {
        setPlacement(null);
        return;
      }
      const selectedOptionIndex = options.findIndex(
        (option) => option.value === selectedValue && !option.disabled
      );
      setActiveIndex(
        selectedOptionIndex >= 0
          ? selectedOptionIndex
          : options.findIndex((option) => !option.disabled)
      );
      listRef.current?.focus({ preventScroll: true });
    }, [open, options, selectedValue]);

    // Scroll only inside the listbox container so opening never jumps the page or parent dialog
    React.useEffect(() => {
      if (!open || activeIndex < 0) return;
      const list = listRef.current;
      const activeEl = document.getElementById(`${listId}-${activeIndex}`);
      if (!list || !activeEl) return;

      const padding = 6;
      const elTop = activeEl.offsetTop;
      const elBottom = elTop + activeEl.offsetHeight;
      const viewTop = list.scrollTop;
      const viewBottom = viewTop + list.clientHeight;

      if (elTop < viewTop + padding) {
        list.scrollTop = Math.max(0, elTop - padding);
      } else if (elBottom > viewBottom - padding) {
        list.scrollTop = elBottom - list.clientHeight + padding;
      }
    }, [open, activeIndex, listId, placement]);

    React.useLayoutEffect(() => {
      if (!open) return;

      const positionPopover = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Close if trigger scrolled completely out of the viewport
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          setOpen(false);
          return;
        }

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const gap = 6;
        const edgeMargin = 12;
        const capHeight = 224;
        const estimatedHeight = Math.min(capHeight, Math.max(56, options.length * 44 + 12));

        const width = Math.min(rect.width, viewportWidth - edgeMargin * 2);
        const left = Math.max(edgeMargin, Math.min(rect.left, viewportWidth - width - edgeMargin));

        const spaceBelow = viewportHeight - rect.bottom - gap - edgeMargin;
        const spaceAbove = rect.top - gap - edgeMargin;

        // Prefer opening below when the list fits cleanly or below has at least as much room as above
        const openBelow = spaceBelow >= Math.min(estimatedHeight, 152) || spaceBelow >= spaceAbove;

        if (openBelow) {
          const maxHeight = Math.min(capHeight, Math.max(96, spaceBelow));
          setPlacement({
            direction: 'down',
            style: {
              position: 'fixed',
              top: rect.bottom + gap,
              left,
              width,
              maxHeight,
              zIndex: 110,
            },
          });
        } else {
          // Anchor bottom edge directly above the trigger so short lists never float detached
          const maxHeight = Math.min(capHeight, Math.max(96, spaceAbove));
          setPlacement({
            direction: 'up',
            style: {
              position: 'fixed',
              bottom: Math.max(edgeMargin, viewportHeight - rect.top + gap),
              left,
              width,
              maxHeight,
              zIndex: 110,
            },
          });
        }
      };

      positionPopover();
      window.addEventListener('resize', positionPopover);
      window.addEventListener('scroll', positionPopover, true);
      return () => {
        window.removeEventListener('resize', positionPopover);
        window.removeEventListener('scroll', positionPopover, true);
      };
    }, [open, options.length]);

    React.useEffect(() => {
      if (!open) return;
      const onPointerDown = (event: PointerEvent) => {
        if (
          event.target instanceof Node &&
          !rootRef.current?.contains(event.target) &&
          !listRef.current?.contains(event.target)
        ) {
          setOpen(false);
        }
      };
      const onEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      };
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onEscape, true);
      return () => {
        document.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('keydown', onEscape, true);
      };
    }, [open]);

    function choose(option: (typeof options)[number]) {
      if (option.disabled) return;
      if (!controlled) setInternalValue(option.value);
      onChange?.({ target: { value: option.value } } as React.ChangeEvent<HTMLSelectElement>);
      setOpen(false);
      buttonRef.current?.focus();
    }

    function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      const available = options
        .map((option, index) => (option.disabled ? -1 : index))
        .filter((index) => index >= 0);
      if (!available.length) return;
      const currentPosition = Math.max(0, available.indexOf(activeIndex));
      let nextIndex: number | null = null;
      if (event.key === 'ArrowDown') nextIndex = available[(currentPosition + 1) % available.length];
      if (event.key === 'ArrowUp')
        nextIndex = available[(currentPosition - 1 + available.length) % available.length];
      if (event.key === 'Home') nextIndex = available[0];
      if (event.key === 'End') nextIndex = available[available.length - 1];
      if (nextIndex !== null) {
        event.preventDefault();
        setActiveIndex(nextIndex);
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const option = options[activeIndex];
        if (option) choose(option);
      }
      if (event.key === 'Tab') {
        setOpen(false);
      }
    }

    const portalTarget =
      typeof document !== 'undefined'
        ? buttonRef.current?.closest('dialog') ?? document.body
        : null;

    return (
      <div ref={rootRef} className="relative w-full">
        {name && !required && <input type="hidden" name={name} value={selectedValue} />}
        {required && !disabled && (
          <input
            type="text"
            tabIndex={-1}
            aria-hidden="true"
            required
            readOnly
            name={name}
            value={selectedValue}
            onChange={() => {}}
            onInvalid={(event) => {
              event.preventDefault();
              setOpen(true);
              buttonRef.current?.focus();
            }}
            className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
          />
        )}
        <button
          {...props}
          ref={buttonRef}
          id={id}
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-required={required || undefined}
          aria-disabled={disabled || undefined}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            'flex min-h-11 w-full items-center justify-between gap-2.5 rounded-lg border border-border-input bg-surface px-3.5 py-2 text-left text-base text-text-primary transition-[border-color,box-shadow] duration-150 hover:border-[#BDB6AB]',
            'focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-primary/12',
            'aria-[invalid=true]:border-status-danger aria-[invalid=true]:focus-visible:ring-status-danger/15',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60',
            className
          )}
        >
          <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-text-muted')}>
            {selected?.label ?? options[0]?.label ?? 'Pilih opsi'}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'h-4 w-4 shrink-0 text-text-muted transition-transform duration-150',
              open && 'rotate-180'
            )}
          />
        </button>
        {open &&
          portalTarget &&
          createPortal(
            <m.div
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={0}
              aria-label={ariaLabel}
              aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
              onKeyDown={handleListKeyDown}
              initial={
                prefersReduced
                  ? false
                  : { opacity: 0, y: placement?.direction === 'up' ? 4 : -4 }
              }
              animate={{ opacity: placement ? 1 : 0, y: 0 }}
              transition={
                prefersReduced
                  ? { duration: 0.01 }
                  : { duration: MOTION_DURATION.fast, ease: MOTION_EASE }
              }
              style={
                placement?.style ?? {
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  visibility: 'hidden',
                  zIndex: 110,
                }
              }
              className="overflow-y-auto overscroll-contain rounded-lg border border-border-subtle bg-surface p-1 shadow-md focus:outline-none"
            >
              {options.map((option, index) => (
                <div
                  key={`${option.value}-${index}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === selectedValue}
                  aria-disabled={option.disabled || undefined}
                  onPointerMove={() => !option.disabled && setActiveIndex(index)}
                  onClick={(event) => {
                    event.stopPropagation();
                    choose(option);
                  }}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary transition-colors',
                    index === activeIndex && 'bg-brand-soft text-brand-hover',
                    option.value === selectedValue && 'font-semibold',
                    option.disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <span className="min-w-0 flex-1">{option.label}</span>
                  {option.value === selectedValue && (
                    <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-primary" />
                  )}
                </div>
              ))}
            </m.div>,
            portalTarget
          )}
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
