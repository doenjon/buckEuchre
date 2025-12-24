import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getUserSettings, updateUserSettings, resetUserSettings } from '@/services/api';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { checkAuth } = useAuth();
  const navigate = useNavigate();
  const settingsStore = useSettingsStore();

  // Local state for form
  const [formData, setFormData] = useState({
    showCardOverlay: settingsStore.showCardOverlay,
    showTooltips: settingsStore.showTooltips,
    autoSortHand: settingsStore.autoSortHand,
    bidSpeed: settingsStore.bidSpeed,
    animationSpeed: settingsStore.animationSpeed,
    soundEffects: settingsStore.soundEffects,
    showDebugConsole: settingsStore.showDebugConsole,
  });

  useEffect(() => {
    if (!checkAuth()) {
      navigate('/login');
      return;
    }

    const fetchSettings = async () => {
      try {
        setLoading(true);
        const settings = await getUserSettings();

        // Update both local form state and store
        const newSettings = {
          showCardOverlay: settings.showCardOverlay,
          showTooltips: settings.showTooltips,
          autoSortHand: settings.autoSortHand,
          bidSpeed: settings.bidSpeed,
          animationSpeed: settings.animationSpeed,
          soundEffects: settings.soundEffects,
          showDebugConsole: settings.showDebugConsole,
        };

        setFormData(newSettings);
        settingsStore.setSettings(newSettings);
      } catch (err) {
        console.error('Error fetching settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [checkAuth, navigate]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const updatedSettings = await updateUserSettings(formData);
      // Update store with the complete settings from the server
      settingsStore.setSettings({
        showCardOverlay: updatedSettings.showCardOverlay,
        showTooltips: updatedSettings.showTooltips,
        autoSortHand: updatedSettings.autoSortHand,
        bidSpeed: updatedSettings.bidSpeed,
        animationSpeed: updatedSettings.animationSpeed,
        soundEffects: updatedSettings.soundEffects,
        showDebugConsole: updatedSettings.showDebugConsole,
      });

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const settings = await resetUserSettings();

      const newSettings = {
        showCardOverlay: settings.showCardOverlay,
        showTooltips: settings.showTooltips,
        autoSortHand: settings.autoSortHand,
        bidSpeed: settings.bidSpeed,
        animationSpeed: settings.animationSpeed,
        soundEffects: settings.soundEffects,
        showDebugConsole: settings.showDebugConsole,
      };

      setFormData(newSettings);
      settingsStore.setSettings(newSettings);

      setSuccess('Settings reset to defaults!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error resetting settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-green-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-emerald-700">Loading settings...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-green-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Settings Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-emerald-800 mb-2">Settings</h1>
            <p className="text-emerald-700">Customize your Buck Euchre experience</p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <Card className="p-4 mb-6 bg-red-50 border-red-200">
              <p className="text-red-700 font-medium">{error}</p>
            </Card>
          )}
          {success && (
            <Card className="p-4 mb-6 bg-emerald-50/80 border-emerald-200 backdrop-blur-sm">
              <p className="text-emerald-700 font-medium">{success}</p>
            </Card>
          )}

          {/* Display Settings */}
          <Card className="p-6 mb-6 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
            <h2 className="text-xl font-semibold text-emerald-800 mb-4">Display</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showCardOverlay" className="text-base">
                    Show Card Overlay
                  </Label>
                  <p className="text-sm text-emerald-600">
                    Display trump suit, bid info, and game phase
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
                <div className="space-y-0.5">
                  <Label htmlFor="showTooltips" className="text-base">
                    Show Tooltips
                  </Label>
                  <p className="text-sm text-emerald-600">
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
                <div className="space-y-0.5">
                  <Label htmlFor="autoSortHand" className="text-base">
                    Auto-Sort Hand
                  </Label>
                  <p className="text-sm text-emerald-600">
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
          </Card>

          {/* Animation Settings */}
          <Card className="p-6 mb-6 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
            <h2 className="text-xl font-semibold text-emerald-800 mb-4">Animation</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="bidSpeed" className="text-base">
                    Bid Speed
                  </Label>
                  <p className="text-sm text-emerald-600">
                    Speed of bidding animations
                  </p>
                </div>
                <Select
                  value={formData.bidSpeed}
                  onValueChange={(value) =>
                    setFormData({ ...formData, bidSpeed: value as 'slow' | 'normal' | 'fast' })
                  }
                >
                  <SelectTrigger id="bidSpeed" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">Slow</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="fast">Fast</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="animationSpeed" className="text-base">
                    Animation Speed
                  </Label>
                  <p className="text-sm text-emerald-600">
                    Speed of card animations and transitions
                  </p>
                </div>
                <Select
                  value={formData.animationSpeed}
                  onValueChange={(value) =>
                    setFormData({ ...formData, animationSpeed: value as 'slow' | 'normal' | 'fast' })
                  }
                >
                  <SelectTrigger id="animationSpeed" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">Slow</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="fast">Fast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Audio Settings */}
          <Card className="p-6 mb-6 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
            <h2 className="text-xl font-semibold text-emerald-800 mb-4">Audio</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="soundEffects" className="text-base">
                    Sound Effects
                  </Label>
                  <p className="text-sm text-emerald-600">
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
          </Card>

          {/* Debug Settings */}
          <Card className="p-6 mb-6 bg-white/80 backdrop-blur-sm border-emerald-200/50 shadow-lg">
            <h2 className="text-xl font-semibold text-emerald-800 mb-4">Debug</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showDebugConsole" className="text-base">
                    Show Debug Console
                  </Label>
                  <p className="text-sm text-emerald-600">
                    Display console logger for copying debug logs
                  </p>
                </div>
                <Switch
                  id="showDebugConsole"
                  checked={formData.showDebugConsole}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, showDebugConsole: checked })
                  }
                />
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="primary"
              className="flex-1"
            >
              {saving ? 'Saving...' : 'SAVE SETTINGS'}
            </Button>
            <Button
              onClick={handleReset}
              disabled={saving}
              variant="primary"
              className="flex-1"
            >
              RESET TO DEFAULTS
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
