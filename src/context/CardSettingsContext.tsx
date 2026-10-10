import React, { createContext, useContext, useState, useEffect } from 'react';
import { CardPreferences, CardPresetId } from '../types';
import {
  DEFAULT_CARD_PREFERENCES,
  STORAGE_CARD_PREFERENCES_KEY,
  CARD_PRESETS,
} from '../utils/cardDesignHelper';
import { StorageAdapter } from '../services/storageAdapter';

interface CardSettingsContextType {
  preferences: CardPreferences;
  updatePreferences: (newPrefs: Partial<CardPreferences>) => void;
  applyPreset: (presetId: CardPresetId) => void;
  toggleCardVisibility: (cardId: string) => void;
  setCardSize: (cardId: string, size: 'small' | 'medium' | 'large' | 'wide') => void;
  resetToDefaults: () => void;
}

const CardSettingsContext = createContext<CardSettingsContextType | undefined>(undefined);

export const CardSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<CardPreferences>(() => {
    return StorageAdapter.getItem<CardPreferences>(
      STORAGE_CARD_PREFERENCES_KEY,
      DEFAULT_CARD_PREFERENCES
    );
  });

  useEffect(() => {
    StorageAdapter.setItem(STORAGE_CARD_PREFERENCES_KEY, preferences);
  }, [preferences]);

  const updatePreferences = (newPrefs: Partial<CardPreferences>) => {
    setPreferences((prev) => ({
      ...prev,
      ...newPrefs,
      // If manually updated style properties, clear preset identifier unless specified
      activePreset: newPrefs.activePreset !== undefined ? newPrefs.activePreset : prev.activePreset,
    }));
  };

  const applyPreset = (presetId: CardPresetId) => {
    const found = CARD_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setPreferences((prev) => ({
        ...found.preferences,
        hiddenCardIds: prev.hiddenCardIds,
        cardSizes: prev.cardSizes,
        iconSize: prev.iconSize,
        backgroundTheme: prev.backgroundTheme,
      }));
    }
  };

  const toggleCardVisibility = (cardId: string) => {
    setPreferences((prev) => {
      const hidden = prev.hiddenCardIds || [];
      const isHidden = hidden.includes(cardId);
      const newHidden = isHidden ? hidden.filter((id) => id !== cardId) : [...hidden, cardId];
      return {
        ...prev,
        hiddenCardIds: newHidden,
      };
    });
  };

  const setCardSize = (cardId: string, size: 'small' | 'medium' | 'large' | 'wide') => {
    setPreferences((prev) => ({
      ...prev,
      cardSizes: {
        ...(prev.cardSizes || {}),
        [cardId]: size,
      },
    }));
  };

  const resetToDefaults = () => {
    setPreferences(DEFAULT_CARD_PREFERENCES);
    StorageAdapter.setItem(STORAGE_CARD_PREFERENCES_KEY, DEFAULT_CARD_PREFERENCES);
  };

  return (
    <CardSettingsContext.Provider
      value={{
        preferences,
        updatePreferences,
        applyPreset,
        toggleCardVisibility,
        setCardSize,
        resetToDefaults,
      }}
    >
      {children}
    </CardSettingsContext.Provider>
  );
};

export const useCardPreferences = (): CardSettingsContextType => {
  const context = useContext(CardSettingsContext);
  if (!context) {
    throw new Error('useCardPreferences must be used within a CardSettingsProvider');
  }
  return context;
};
