import React from 'react';
import { useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * Component that runs accessibility tests using axe-core
 * Only runs in development mode
 */
export function AccessibilityTester() {
  useEffect(() => {
    if (import.meta.env.MODE === 'development') {
      const runAxe = async () => {
        try {
          const axe = await import('@axe-core/react');
          axe.default(React, ReactDOM, 1000);
          console.log('Accessibility testing with axe-core enabled');
        } catch (error) {
          console.warn('Could not load axe-core for accessibility testing:', error);
        }
      };

      runAxe();
    }
  }, []);

  return null;
}