import { useEffect, useRef } from 'react';

/**
 * Custom hook for managing focus within a modal or dialog
 * Traps focus within the element and restores focus to the previous element when closed
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(isOpen: boolean) {
  const ref = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Store the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    const element = ref.current;
    if (!element) return;

    // Get all focusable elements within the modal
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      // Focus the first focusable element
      (focusableElements[0] as HTMLElement).focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          // Shift + Tab: if focused on first element, move to last
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          // Tab: if focused on last element, move to first
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }

      // Escape key to close modal (handled by Radix by default)
      if (event.key === 'Escape') {
        // Focus will be restored by the cleanup effect
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      // Restore focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen]);

  return ref;
}