/**
 * @module components/game/PlayerStatusBadge
 * @description Badge showing player connection status
 */

import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';
import type { Player } from '@buck-euchre/shared';

interface PlayerStatusBadgeProps {
  player: Player;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PlayerStatusBadge({ 
  player, 
  showIcon = true,
  size = 'md' 
}: PlayerStatusBadgeProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  
  if (player.connected) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
        {showIcon && <Wifi className={`${iconSize} mr-1`} />}
        Connected
      </Badge>
    );
  }

  return (
    <Badge variant="destructive">
      {showIcon && <WifiOff className={`${iconSize} mr-1`} />}
      Disconnected
    </Badge>
  );
}
