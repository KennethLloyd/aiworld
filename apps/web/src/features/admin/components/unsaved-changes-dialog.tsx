import { useBlocker } from '@tanstack/react-router';
import { useRef } from 'react';

import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';

export function useUnsavedChangesBlocker(isDirty: boolean) {
  const allowNavigationRef = useRef(false);
  const blocker = useBlocker({
    shouldBlockFn: () => {
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return false;
      }
      return isDirty;
    },
    withResolver: true,
    enableBeforeUnload: isDirty,
  });

  return {
    ...blocker,
    allowNextNavigation: () => {
      allowNavigationRef.current = true;
    },
  };
}

export interface UnsavedChangesDialogProps {
  open: boolean;
  onContinue: () => void;
  onDiscard: () => void;
}

export function UnsavedChangesDialog({
  open,
  onContinue,
  onDiscard,
}: UnsavedChangesDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onContinue}
      title="Unsaved changes"
      size="wide"
      footer={
        <>
          <Button variant="ghost" onClick={onContinue}>
            Continue editing
          </Button>
          <Button variant="danger" onClick={onDiscard}>
            Discard changes
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink/70">
        Unsaved changes. Continue editing or discard?
      </p>
    </Modal>
  );
}
