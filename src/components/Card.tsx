import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'purple';
  onClick?: () => void;
}

export function Card({ children, className = '', variant = 'default', onClick }: CardProps) {
  const variants = {
    default: 'bg-white dark:bg-gray-800 shadow-sm',
    purple: 'bg-purple-bg dark:bg-primary/20',
  };

  return (
    <div
      className={`rounded-2xl p-4 ${variants[variant]} ${onClick ? 'cursor-pointer active:scale-98' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
