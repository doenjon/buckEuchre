/**
 * @module components/BugReportModal
 * @description Modal for reporting bugs with console logs
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { submitBugReport } from '@/services/api';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConsoleMessage {
  timestamp: string;
  level: string;
  message: string;
  args: any[];
}

// Access the console messages from the ConsoleLogger component
// We'll need to expose this via a module-level function
let getConsoleMessages: () => ConsoleMessage[] = () => [];

export function setConsoleMessagesGetter(getter: () => ConsoleMessage[]) {
  getConsoleMessages = getter;
}

export function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please describe the issue');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Get console logs
      const consoleLogs = getConsoleMessages();
      const logsText = consoleLogs
        .map(msg => `[${msg.timestamp}] ${msg.level.toUpperCase()}: ${msg.message}`)
        .join('\n');

      await submitBugReport({
        description: description.trim(),
        logs: logsText,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });

      setSuccess(true);
      setTimeout(() => {
        setDescription('');
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error submitting bug report:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit bug report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[99999]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container - centered */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        {/* Modal */}
        <div className="pointer-events-auto w-full max-w-lg bg-gray-900 border border-white/20 rounded-lg shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">Report a Bug</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Success Message */}
          {success && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded text-emerald-200 text-sm">
              Thank you! Your bug report has been submitted.
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="bug-description" className="text-base text-white">
              What happened?
            </Label>
            <p className="text-sm text-gray-400">
              Please describe the issue you encountered. Recent console logs will be included automatically.
            </p>
            <textarea
              ref={textareaRef}
              id="bug-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you were doing when the issue occurred..."
              className="w-full h-32 px-3 py-2 bg-gray-800 border border-white/20 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 resize-none"
              disabled={submitting || success}
            />
            <p className="text-xs text-gray-500">
              Tip: Press Ctrl+Enter (or Cmd+Enter) to submit
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-4 p-6 border-t border-white/10 flex-shrink-0">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-white/30 text-white hover:bg-white/20"
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !description.trim() || success}
            variant="primary"
            className="flex-1"
          >
            {submitting ? (
              'Submitting...'
            ) : success ? (
              'Submitted!'
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit
              </>
            )}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );

  // Render to document.body using portal to escape any parent z-index constraints
  return createPortal(modalContent, document.body);
}
