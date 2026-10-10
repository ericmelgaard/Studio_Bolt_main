import { useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 2000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm z-[200] animate-fade-in" />
      <div className="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto animate-scale-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[380px]">
            <div className="flex items-center gap-3 p-5">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="flex-1 text-gray-900 dark:text-white font-medium text-sm">{message}</p>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Dismiss" className="h-8 w-8 flex-shrink-0">
                <X />
              </Button>
            </div>
            <div className="h-1 bg-gray-100 dark:bg-gray-700">
              <div className="h-full bg-emerald-500 animate-progress" style={{ animationDuration: `${duration}ms` }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
