import { render, act } from '@testing-library/react';
import { ThemeProvider } from '../context/ThemeContext';
import { useTheme } from './useTheme';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Helper component to access hook and report values
const TestComponent = ({
  onTheme,
}: {
  onTheme: (theme: string, toggle: () => void) => void;
}) => {
  const { theme, toggleTheme } = useTheme();
  onTheme(theme, toggleTheme);
  return null;
};

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Reset document attribute
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  describe('throws when used outside ThemeProvider', () => {
    it('throws error when useTheme is called without ThemeProvider', () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      // Attempt to render component using useTheme without ThemeProvider
      expect(() => {
        render(<TestComponent onTheme={() => {}} />);
      }).toThrow('useTheme must be used within ThemeProvider');

      consoleError.mockRestore();
    });
  });

  describe('provides correct default theme', () => {
    it('defaults to light theme when no stored theme in localStorage', () => {
      let capturedTheme: string | undefined;

      render(
        <ThemeProvider>
          <TestComponent
            onTheme={(theme) => {
              capturedTheme = theme;
            }}
          />
        </ThemeProvider>
      );

      expect(capturedTheme).toBe('light');
    });

    it('uses dark theme when localStorage has dark', () => {
      localStorage.setItem('theme', 'dark');

      let capturedTheme: string | undefined;

      render(
        <ThemeProvider>
          <TestComponent
            onTheme={(theme) => {
              capturedTheme = theme;
            }}
          />
        </ThemeProvider>
      );

      expect(capturedTheme).toBe('dark');
    });

    it('uses light theme when localStorage has light', () => {
      localStorage.setItem('theme', 'light');

      let capturedTheme: string | undefined;

      render(
        <ThemeProvider>
          <TestComponent
            onTheme={(theme) => {
              capturedTheme = theme;
            }}
          />
        </ThemeProvider>
      );

      expect(capturedTheme).toBe('light');
    });

    it('defaults to light when localStorage has invalid value', () => {
      localStorage.setItem('theme', 'invalid');

      let capturedTheme: string | undefined;

      render(
        <ThemeProvider>
          <TestComponent
            onTheme={(theme) => {
              capturedTheme = theme;
            }}
          />
        </ThemeProvider>
      );

      expect(capturedTheme).toBe('light');
    });
  });

  describe('toggleTheme works correctly', () => {
    it('toggles from light to dark', async () => {
      let capturedTheme: string | undefined;
      let capturedToggle: (() => void) | undefined;

      const { rerender } = render(
        <ThemeProvider>
          <TestComponent
            onTheme={(theme, toggle) => {
              capturedTheme = theme;
              capturedToggle = toggle;
            }}
          />
        </ThemeProvider>
      );

      expect(capturedTheme).toBe('light');
      expect(capturedToggle).toBeDefined();

      // Toggle to dark
      await act(async () => {
        capturedToggle!();
      });

      // Rerender to get updated theme
      rerender(
        <ThemeProvider>
          <TestComponent
            onTheme={(theme) => {
              capturedTheme = theme;
            }}
          />
        </ThemeProvider>
      );

      expect(capturedTheme).toBe('dark');
    });

    it('toggles from dark back to light', async () => {
      localStorage.setItem('theme', 'dark');

      let capturedTheme: string | undefined;
      let capturedToggle: (() => void) | undefined;

      const { rerender } = render(
        <ThemeProvider>
          <TestComponent
            onTheme={(theme, toggle) => {
              capturedTheme = theme;
              capturedToggle = toggle;
            }}
          />
        </ThemeProvider>
      );

      expect(capturedTheme).toBe('dark');

      // Toggle to light
      await act(async () => {
        capturedToggle!();
      });

      // Rerender to get updated theme
      rerender(
        <ThemeProvider>
          <TestComponent
            onTheme={(theme) => {
              capturedTheme = theme;
            }}
          />
        </ThemeProvider>
      );

      expect(capturedTheme).toBe('light');
    });

    it('can toggle multiple times', async () => {
      let capturedTheme: string | undefined;
      let capturedToggle: (() => void) | undefined;

      const { rerender } = render(
        <ThemeProvider>
          <TestComponent
            onTheme={(theme, toggle) => {
              capturedTheme = theme;
              capturedToggle = toggle;
            }}
          />
        </ThemeProvider>
      );

      // light -> dark
      await act(async () => {
        capturedToggle!();
      });

      rerender(
        <ThemeProvider>
          <TestComponent
            onTheme={(theme) => {
              capturedTheme = theme;
            }}
          />
        </ThemeProvider>
      );
      expect(capturedTheme).toBe('dark');

      // dark -> light
      await act(async () => {
        capturedToggle!();
      });

      rerender(
        <ThemeProvider>
          <TestComponent
            onTheme={(theme) => {
              capturedTheme = theme;
            }}
          />
        </ThemeProvider>
      );
      expect(capturedTheme).toBe('light');
    });
  });

  describe('persists to localStorage', () => {
    it('saves theme to localStorage on initial render', () => {
      render(
        <ThemeProvider>
          <TestComponent onTheme={() => {}} />
        </ThemeProvider>
      );

      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('saves dark theme to localStorage when set', () => {
      localStorage.setItem('theme', 'dark');

      render(
        <ThemeProvider>
          <TestComponent onTheme={() => {}} />
        </ThemeProvider>
      );

      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('updates localStorage when toggling theme', async () => {
      let capturedToggle: (() => void) | undefined;

      render(
        <ThemeProvider>
          <TestComponent
            onTheme={(_, toggle) => {
              capturedToggle = toggle;
            }}
          />
        </ThemeProvider>
      );

      expect(localStorage.getItem('theme')).toBe('light');

      // Toggle to dark
      await act(async () => {
        capturedToggle!();
      });

      expect(localStorage.getItem('theme')).toBe('dark');

      // Toggle back to light
      await act(async () => {
        capturedToggle!();
      });

      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('reads from localStorage on initial load', () => {
      // Set up localStorage before rendering
      localStorage.setItem('theme', 'dark');

      render(
        <ThemeProvider>
          <TestComponent onTheme={() => {}} />
        </ThemeProvider>
      );

      // The provider should read from localStorage and use 'dark'
      expect(localStorage.getItem('theme')).toBe('dark');
    });
  });

  describe('sets data-theme attribute on document', () => {
    it('sets data-theme to light on initial render', () => {
      render(
        <ThemeProvider>
          <TestComponent onTheme={() => {}} />
        </ThemeProvider>
      );

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('sets data-theme to dark when theme is dark', () => {
      localStorage.setItem('theme', 'dark');

      render(
        <ThemeProvider>
          <TestComponent onTheme={() => {}} />
        </ThemeProvider>
      );

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('updates data-theme when toggling', async () => {
      let capturedToggle: (() => void) | undefined;

      render(
        <ThemeProvider>
          <TestComponent
            onTheme={(_, toggle) => {
              capturedToggle = toggle;
            }}
          />
        </ThemeProvider>
      );

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      await act(async () => {
        capturedToggle!();
      });

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});