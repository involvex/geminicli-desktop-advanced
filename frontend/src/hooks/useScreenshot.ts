import { useEffect, useCallback } from 'react';

interface ScreenshotOptions {
  onScreenshot: (imageData: string) => void;
  enabled: boolean;
}

export function useScreenshot({ onScreenshot, enabled }: ScreenshotOptions) {
  const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
    if (!enabled) return;

    // Print Screen key
    if (event.key === 'PrintScreen') {
      event.preventDefault();
      
      try {
        // Try to read from clipboard after a short delay
        setTimeout(async () => {
          try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
              if (item.types.includes('image/png')) {
                const blob = await item.getType('image/png');
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === 'string') {
                    onScreenshot(reader.result);
                  }
                };
                reader.readAsDataURL(blob);
                break;
              }
            }
          } catch (error) {
            console.warn('Could not read screenshot from clipboard:', error);
          }
        }, 100);
      } catch (error) {
        console.error('Screenshot capture failed:', error);
      }
    }
  }, [enabled, onScreenshot]);

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    if (!enabled) return;

    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              onScreenshot(reader.result);
            }
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  }, [enabled, onScreenshot]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePaste);
    };
  }, [enabled, handleKeyDown, handlePaste]);
}