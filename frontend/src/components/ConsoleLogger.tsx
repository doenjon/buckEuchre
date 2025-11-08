/**
 * @module components/ConsoleLogger
 * @description Component that captures console messages and allows copying them
 */

import { useEffect, useState, useRef } from 'react';
import { Copy, Check } from 'lucide-react';

interface ConsoleMessage {
  timestamp: string;
  level: string;
  message: string;
  args: any[];
}

export function ConsoleLogger() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [copied, setCopied] = useState(false);
  const messagesRef = useRef<ConsoleMessage[]>([]);
  const MAX_MESSAGES = 50;

  useEffect(() => {
    // Store original console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    const originalDebug = console.debug;

    const captureMessage = (level: string, ...args: any[]) => {
      const timestamp = new Date().toISOString();
      const message = args
        .map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      const consoleMessage: ConsoleMessage = {
        timestamp,
        level,
        message,
        args,
      };

      // Add to messages array
      messagesRef.current = [...messagesRef.current, consoleMessage].slice(-MAX_MESSAGES);
      setMessages([...messagesRef.current]);
    };

    // Override console methods
    console.log = (...args: any[]) => {
      captureMessage('log', ...args);
      originalLog(...args);
    };

    console.error = (...args: any[]) => {
      captureMessage('error', ...args);
      originalError(...args);
    };

    console.warn = (...args: any[]) => {
      captureMessage('warn', ...args);
      originalWarn(...args);
    };

    console.info = (...args: any[]) => {
      captureMessage('info', ...args);
      originalInfo(...args);
    };

    console.debug = (...args: any[]) => {
      captureMessage('debug', ...args);
      originalDebug(...args);
    };

    // Cleanup: restore original console methods
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
      console.debug = originalDebug;
    };
  }, []);

  const handleCopy = async () => {
    const text = messages
      .map(msg => `[${msg.timestamp}] ${msg.level.toUpperCase()}: ${msg.message}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy console messages:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="fixed bottom-2 left-2 z-[9999] flex items-center gap-1.5 rounded-md bg-slate-800/90 border border-slate-700/50 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700/90 hover:text-slate-100 transition-colors backdrop-blur-sm shadow-lg"
      title={`Copy last ${messages.length} console messages`}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>{messages.length}</span>
        </>
      )}
    </button>
  );
}

