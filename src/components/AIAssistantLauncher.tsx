import { lazy, Suspense, useRef, useState } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

const AIAssistantPanel = lazy(() => import('./AIAssistantPanel'));

export default function AIAssistantLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const openAssistant = () => {
    setHasOpened(true);
    setIsOpen(true);
  };

  const closeAssistant = () => {
    setIsOpen(false);
    window.setTimeout(() => launcherRef.current?.focus(), 220);
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            ref={launcherRef}
            type="button"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={openAssistant}
            className="ai-assistant-launcher"
            aria-expanded={isOpen}
            aria-controls="ai-assistant-panel"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>AI Assistant</span>
          </motion.button>
        )}
      </AnimatePresence>

      {hasOpened && (
        <Suspense
          fallback={
            <div className="ai-assistant-panel ai-assistant-panel-fallback" aria-label="Opening AI Assistant">
              <LoaderCircle className="h-5 w-5 animate-spin text-[var(--brand-accent)]" />
            </div>
          }
        >
          <AIAssistantPanel open={isOpen} onClose={closeAssistant} />
        </Suspense>
      )}
    </>
  );
}
