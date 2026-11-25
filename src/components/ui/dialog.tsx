'use client';

import * as React from 'react';
import { AnimatePresence, m } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOTION_DURATION, MOTION_EASE } from '@/components/motion/motion-tokens';
import { useHydratedReducedMotion } from '@/components/motion/use-hydrated-reduced-motion';

interface DialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  titleId: string;
  descriptionId: string;
  hasDescription: boolean;
  setHasDescription: (value: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType>({
  open: false,
  setOpen: () => {},
  contentId: '',
  titleId: '',
  descriptionId: '',
  hasDescription: false,
  setHasDescription: () => {},
});

export function Dialog({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [hasDescription, setHasDescription] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const id = React.useId();

  return (
    <DialogContext.Provider
      value={{
        open,
        setOpen,
        contentId: `dialog-${id}`,
        titleId: `dialog-title-${id}`,
        descriptionId: `dialog-desc-${id}`,
        hasDescription,
        setHasDescription,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  children,
  className,
  asChild,
}: {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}) {
  const { open, setOpen, contentId } = React.useContext(DialogContext);

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: React.MouseEventHandler }>;
    return React.cloneElement(child, {
      'aria-haspopup': 'dialog',
      'aria-expanded': open,
      'aria-controls': contentId,
      onClick: (event: React.MouseEvent) => {
        child.props.onClick?.(event);
        if (!event.defaultPrevented) setOpen(true);
      },
    } as Partial<typeof child.props>);
  }

  return (
    <button
      className={className}
      onClick={() => setOpen(true)}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={contentId}
    >
      {children}
    </button>
  );
}

const dialogSizes = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
} as const;

export interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  size?: keyof typeof dialogSizes;
  showCloseButton?: boolean;
  'aria-label'?: string;
}

function DialogModal({
  children,
  className,
  size = 'md',
  showCloseButton = true,
  'aria-label': ariaLabel,
}: DialogContentProps) {
  const { setOpen, contentId, titleId, descriptionId, hasDescription } =
    React.useContext(DialogContext);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const prefersReduced = useHydratedReducedMotion();

  React.useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (dialog.isConnected && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) {
        dialog.close();
      }
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      id={contentId}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      aria-describedby={hasDescription ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        setOpen(false);
      }}
      className="fixed inset-0 z-50 m-0 flex h-dvh w-screen max-h-none max-w-none items-end justify-center bg-transparent p-0 backdrop:bg-transparent sm:items-center sm:p-4"
    >
      <m.div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        initial={prefersReduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={prefersReduced ? undefined : { opacity: 0 }}
        transition={{ duration: MOTION_DURATION.fast }}
        className="fixed inset-0 bg-stone-950/45"
      />
      <m.div
        initial={prefersReduced ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReduced ? undefined : { opacity: 0, y: 14 }}
        transition={
          prefersReduced
            ? { duration: 0.01 }
            : { duration: MOTION_DURATION.normal, ease: MOTION_EASE }
        }
        className={cn(
          'relative z-10 max-h-[90dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-xl border border-border-subtle bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-text-primary shadow-lg',
          'sm:max-h-[85dvh] sm:w-[92vw] sm:rounded-xl sm:p-6',
          dialogSizes[size],
          className
        )}
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1 w-9 rounded-full bg-border-subtle sm:hidden"
        />
        {children}
        {showCloseButton && (
          <button
            onClick={() => setOpen(false)}
            aria-label="Tutup dialog"
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary sm:right-4 sm:top-4"
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </m.div>
    </dialog>
  );
}

export function DialogContent(props: DialogContentProps) {
  const { open } = React.useContext(DialogContext);

  return (
    <AnimatePresence>
      {open ? <DialogModal key="dialog-modal" {...props} /> : null}
    </AnimatePresence>
  );
}

export function DialogHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('mb-4 space-y-1 pr-11', className)}>{children}</div>;
}

export function DialogTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { titleId } = React.useContext(DialogContext);
  return (
    <h2 id={titleId} className={cn('text-lg font-semibold tracking-tight text-text-primary', className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { descriptionId, setHasDescription } = React.useContext(DialogContext);

  React.useEffect(() => {
    setHasDescription(true);
    return () => setHasDescription(false);
  }, [setHasDescription]);

  return (
    <p id={descriptionId} className={cn('text-sm text-text-secondary', className)}>
      {children}
    </p>
  );
}

export function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DialogClose({
  children,
  asChild,
  className,
}: {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}) {
  const { setOpen } = React.useContext(DialogContext);

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: React.MouseEventHandler }>;
    return React.cloneElement(child, {
      onClick: (event: React.MouseEvent) => {
        child.props.onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      },
    } as Partial<typeof child.props>);
  }

  return (
    <button type="button" onClick={() => setOpen(false)} className={className}>
      {children}
    </button>
  );
}
