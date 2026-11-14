import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount rendered trees and reset storage between tests.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
