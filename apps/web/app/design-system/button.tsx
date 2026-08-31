import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'medium' | 'small';
};

export function Button({ variant = 'primary', size = 'medium', className, ...props }: ButtonProps) {
  return (
    <button
      className={['ds-button', className].filter(Boolean).join(' ')}
      data-size={size}
      data-variant={variant}
      type="button"
      {...props}
    />
  );
}
