import { UserProfile } from '../../types';
import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { DEFAULT_USER } from '../seedData';

export class UserRepository {
  static getProfile(): UserProfile {
    const saved = StorageAdapter.getItem<UserProfile>(STORAGE_KEYS.USER_PROFILE, DEFAULT_USER);
    return {
      ...DEFAULT_USER,
      ...saved,
      tickerPreferences: {
        ...DEFAULT_USER.tickerPreferences,
        ...(saved?.tickerPreferences || {}),
      },
      vehiclePreferences: {
        ...DEFAULT_USER.vehiclePreferences,
        ...(saved?.vehiclePreferences || {}),
      },
      budgetPreferences: {
        ...DEFAULT_USER.budgetPreferences,
        ...(saved?.budgetPreferences || {}),
      },
      religiousDetails: {
        ...DEFAULT_USER.religiousDetails,
        ...(saved?.religiousDetails || {}),
      },
      foodPreferences: {
        ...DEFAULT_USER.foodPreferences,
        ...(saved?.foodPreferences || {}),
      },
      educationPreferences: {
        ...DEFAULT_USER.educationPreferences,
        ...(saved?.educationPreferences || {}),
      },
    };
  }

  static saveProfile(profile: UserProfile): void {
    StorageAdapter.setItem(STORAGE_KEYS.USER_PROFILE, profile);
  }

  static updateProfile(partial: Partial<UserProfile>): UserProfile {
    const current = this.getProfile();
    const updated: UserProfile = { ...current, ...partial };
    this.saveProfile(updated);
    return updated;
  }
}
