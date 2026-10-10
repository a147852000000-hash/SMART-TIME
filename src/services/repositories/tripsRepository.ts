import { FavoritePlace, RecentTrip } from '../../types';
import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { DEFAULT_FAVORITE_PLACES, DEFAULT_RECENT_TRIPS } from '../seedData';

export class TripsRepository {
  // Favorite Places
  static getFavoritePlaces(): FavoritePlace[] {
    return StorageAdapter.getItem<FavoritePlace[]>(STORAGE_KEYS.FAVORITE_PLACES, DEFAULT_FAVORITE_PLACES);
  }

  static saveFavoritePlaces(places: FavoritePlace[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.FAVORITE_PLACES, places);
  }

  static addFavoritePlace(place: FavoritePlace): FavoritePlace[] {
    const list = this.getFavoritePlaces();
    const updated = [...list, place];
    this.saveFavoritePlaces(updated);
    return updated;
  }

  // Recent Trips
  static getRecentTrips(): RecentTrip[] {
    return StorageAdapter.getItem<RecentTrip[]>(STORAGE_KEYS.RECENT_TRIPS, DEFAULT_RECENT_TRIPS);
  }

  static saveRecentTrips(trips: RecentTrip[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.RECENT_TRIPS, trips);
  }

  static addRecentTrip(trip: RecentTrip): RecentTrip[] {
    const list = this.getRecentTrips();
    const updated = [trip, ...list].slice(0, 10);
    this.saveRecentTrips(updated);
    return updated;
  }
}
