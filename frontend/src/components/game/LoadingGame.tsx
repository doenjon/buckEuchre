/**
 * @module components/game/LoadingGame
 * @description Loading state component with dramatic Netflix-style animation
 */

interface LoadingGameProps {
  message?: string;
}

export function LoadingGame({ message = 'Loading game...' }: LoadingGameProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black overflow-hidden">
      {/* Subtle background glow effect */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent animate-pulse" />

      {/* Main content with dramatic entrance */}
      <div className="relative z-10 flex flex-col items-center gap-8 animate-dramatic-entrance">
        {/* Logo/Title with scale animation */}
        <div className="relative">
          {/* Glow effect behind text */}
          <div className="absolute inset-0 blur-2xl bg-primary/30 animate-glow" />

          {/* Main title */}
          <h1 className="relative text-6xl md:text-8xl font-black tracking-tighter text-white drop-shadow-2xl">
            BUCK
            <span className="block text-primary animate-shimmer">EUCHRE</span>
          </h1>
        </div>

        {/* Loading indicator - minimalist dots */}
        <div className="flex gap-2 mt-4">
          <div className="w-3 h-3 rounded-full bg-primary animate-bounce-delay-0" />
          <div className="w-3 h-3 rounded-full bg-primary animate-bounce-delay-100" />
          <div className="w-3 h-3 rounded-full bg-primary animate-bounce-delay-200" />
        </div>

        {/* Message */}
        {message && (
          <p className="text-gray-400 text-sm md:text-base tracking-wide uppercase font-medium animate-fade-in-delayed">
            {message}
          </p>
        )}
      </div>

      <style>{`
        @keyframes dramatic-entrance {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes glow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }

        @keyframes shimmer {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }

        @keyframes fade-in-delayed {
          0% {
            opacity: 0;
          }
          60% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes bounce-delay {
          0%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-12px);
          }
        }

        .animate-dramatic-entrance {
          animation: dramatic-entrance 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }

        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }

        .animate-fade-in-delayed {
          animation: fade-in-delayed 1.5s ease-out forwards;
        }

        .animate-bounce-delay-0 {
          animation: bounce-delay 1.4s ease-in-out infinite;
        }

        .animate-bounce-delay-100 {
          animation: bounce-delay 1.4s ease-in-out 0.2s infinite;
        }

        .animate-bounce-delay-200 {
          animation: bounce-delay 1.4s ease-in-out 0.4s infinite;
        }

        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }
      `}</style>
    </div>
  );
}
