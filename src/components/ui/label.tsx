import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  requiredMark?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, requiredMark, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium leading-snug text-text-primary',
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {requiredMark && (
        <span aria-hidden="true" className="text-status-danger">
          *
        </span>
      )}
    </label>
  )
);
Label.displayName = 'Label';

export { Label };
