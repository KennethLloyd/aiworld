import { useBlocker } from '@tanstack/react-router';

import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';

export function useUnsavedChangesBlocker(isDirty: boolean) {
  return useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
    enableBeforeUnload: isDirty,
  });
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
        Your draft has not been saved. Continue editing or discard the draft?
      </p>
    </Modal>
  );
}
