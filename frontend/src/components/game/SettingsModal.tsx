/**
 * @module components/game/SettingsModal
 * @description Quick settings modal for in-game use
 */

import { useEffect, useState } from 'react';
import { X, Bug } from 'lucide-react';
import { getUserSettings, updateUserSettings } from '@/services/api';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BugReportModal } from '@/components/BugReportModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBugReport, setShowBugReport] = useState(false);
  const settingsStore = useSettingsStore();

  // Local state for important settings only
  const [formData, setFormData] = useState({
    showCardOverlay: settingsStore.showCardOverlay,
    showBidOverlay: settingsStore.showBidOverlay,
    showFoldOverlay: settingsStore.showFoldOverlay,
    showSuitOverlay: settingsStore.showSuitOverlay,
    showTooltips: settingsStore.showTooltips,
    autoSortHand: settingsStore.autoSortHand,
    soundEffects: settingsStore.soundEffects,
  });

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const settings = await getUserSettings();
      const newSettings = {
        showCardOverlay: settings.showCardOverlay,
        showBidOverlay: settings.showBidOverlay,
        showFoldOverlay: settings.showFoldOverlay,
        showSuitOverlay: settings.showSuitOverlay,
        showTooltips: settings.showTooltips,
        autoSortHand: settings.autoSortHand,
        soundEffects: settings.soundEffects,
      };
      setFormData(newSettings);
      settingsStore.setSettings({
        ...settingsStore,
        ...newSettings,
      });
    } catch (err) {
      console.error('Error loading settings:', err);
      // Use store defaults if API fails
    }
  };

  const handleSave = async () => {
    if (saving) return;

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const updatedSettings = await updateUserSettings(formData);
      // Update store with the complete settings from the server
      settingsStore.setSettings({
        showCardOverlay: updatedSettings.showCardOverlay,
        showBidOverlay: updatedSettings.showBidOverlay,
        showFoldOverlay: updatedSettings.showFoldOverlay,
        showSuitOverlay: updatedSettings.showSuitOverlay,
        showTooltips: updatedSettings.showTooltips,
        autoSortHand: updatedSettings.autoSortHand,
        bidSpeed: updatedSettings.bidSpeed,
        animationSpeed: updatedSettings.animationSpeed,
        soundEffects: updatedSettings.soundEffects,
        showDebugConsole: updatedSettings.showDebugConsole,
      });
      setSuccess('Settings saved!');
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-gray-900 border border-white/20 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Quick Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded text-emerald-200 text-sm">
              {success}
            </div>
          )}

          {/* Display Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Display
            </h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="showCardOverlay" className="text-base text-white">
                  Show Card Overlay
                </Label>
                <p className="text-sm text-gray-400">
                  Display AI analysis on playable cards
                </p>
              </div>
              <Switch
                id="showCardOverlay"
                checked={formData.showCardOverlay}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, showCardOverlay: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="showBidOverlay" className="text-base text-white">
                  Show Bid Overlay
                </Label>
                <p className="text-sm text-gray-400">
                  Display AI analysis on bid options
                </p>
              </div>
              <Switch
                id="showBidOverlay"
                checked={formData.showBidOverlay}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, showBidOverlay: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="showFoldOverlay" className="text-base text-white">
                  Show Fold Overlay
                </Label>
                <p className="text-sm text-gray-400">
                  Display AI analysis on fold/stay decisions
                </p>
              </div>
              <Switch
                id="showFoldOverlay"
                checked={formData.showFoldOverlay}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, showFoldOverlay: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="showSuitOverlay" className="text-base text-white">
                  Show Suit Overlay
                </Label>
                <p className="text-sm text-gray-400">
                  Display AI analysis on trump suit selection
                </p>
              </div>
              <Switch
                id="showSuitOverlay"
                checked={formData.showSuitOverlay}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, showSuitOverlay: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="showTooltips" className="text-base text-white">
                  Show Tooltips
                </Label>
                <p className="text-sm text-gray-400">
                  Display helpful hints and explanations
                </p>
              </div>
              <Switch
                id="showTooltips"
                checked={formData.showTooltips}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, showTooltips: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="autoSortHand" className="text-base text-white">
                  Auto-Sort Hand
                </Label>
                <p className="text-sm text-gray-400">
                  Automatically organize cards by suit and rank
                </p>
              </div>
              <Switch
                id="autoSortHand"
                checked={formData.autoSortHand}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, autoSortHand: checked })
                }
              />
            </div>
          </div>

          {/* Audio Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Audio
            </h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="soundEffects" className="text-base text-white">
                  Sound Effects
                </Label>
                <p className="text-sm text-gray-400">
                  Play sounds for game actions
                </p>
              </div>
              <Switch
                id="soundEffects"
                checked={formData.soundEffects}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, soundEffects: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 space-y-3">
          {/* Bug Report Button */}
          <Button
            onClick={() => setShowBugReport(true)}
            variant="outline"
            className="w-full border-orange-500/50 text-orange-300 hover:bg-orange-500/20 hover:border-orange-500"
          >
            <Bug className="h-4 w-4 mr-2" />
            Report a Bug
          </Button>

          {/* Save/Cancel Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-white/30 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="primary"
              className="flex-1"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Bug Report Modal */}
      <BugReportModal
        isOpen={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
    </div>
  );
}

