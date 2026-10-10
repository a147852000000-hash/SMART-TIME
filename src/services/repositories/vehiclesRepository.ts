import { Vehicle, FuelRecord, MaintenanceRecord, VehicleAccidentRecord } from '../../types';
import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { DEFAULT_VEHICLES, DEFAULT_FUEL_RECORDS, DEFAULT_MAINTENANCE_RECORDS } from '../seedData';

export class VehiclesRepository {
  // Vehicles
  static getVehicles(): Vehicle[] {
    return StorageAdapter.getItem<Vehicle[]>(STORAGE_KEYS.VEHICLES, DEFAULT_VEHICLES);
  }

  static saveVehicles(vehicles: Vehicle[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.VEHICLES, vehicles);
  }

  static addVehicle(vehicle: Vehicle): Vehicle[] {
    const list = this.getVehicles();
    const updated = [...list, vehicle];
    this.saveVehicles(updated);
    return updated;
  }

  static updateVehicle(vehicle: Vehicle): Vehicle[] {
    const list = this.getVehicles();
    const updated = list.map((v) => (v.id === vehicle.id ? vehicle : v));
    this.saveVehicles(updated);
    return updated;
  }

  static deleteVehicle(id: string): Vehicle[] {
    const list = this.getVehicles();
    const updated = list.filter((v) => v.id !== id);
    this.saveVehicles(updated);
    return updated;
  }

  // Fuel Records
  static getFuelRecords(): FuelRecord[] {
    return StorageAdapter.getItem<FuelRecord[]>(STORAGE_KEYS.FUEL_RECORDS, DEFAULT_FUEL_RECORDS);
  }

  static saveFuelRecords(records: FuelRecord[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.FUEL_RECORDS, records);
  }

  static addFuelRecord(record: FuelRecord): FuelRecord[] {
    const list = this.getFuelRecords();
    const updated = [record, ...list];
    this.saveFuelRecords(updated);
    return updated;
  }

  // Maintenance Records
  static getMaintenanceRecords(): MaintenanceRecord[] {
    return StorageAdapter.getItem<MaintenanceRecord[]>(STORAGE_KEYS.MAINTENANCE_RECORDS, DEFAULT_MAINTENANCE_RECORDS);
  }

  static saveMaintenanceRecords(records: MaintenanceRecord[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.MAINTENANCE_RECORDS, records);
  }

  static addMaintenanceRecord(record: MaintenanceRecord): MaintenanceRecord[] {
    const list = this.getMaintenanceRecords();
    const updated = [record, ...list];
    this.saveMaintenanceRecords(updated);
    return updated;
  }

  // Accident Records
  static getAccidentRecords(): VehicleAccidentRecord[] {
    return StorageAdapter.getItem<VehicleAccidentRecord[]>(STORAGE_KEYS.ACCIDENT_RECORDS, []);
  }

  static saveAccidentRecords(records: VehicleAccidentRecord[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.ACCIDENT_RECORDS, records);
  }

  static addAccidentRecord(record: VehicleAccidentRecord): VehicleAccidentRecord[] {
    const list = this.getAccidentRecords();
    const updated = [record, ...list];
    this.saveAccidentRecords(updated);
    return updated;
  }

  static deleteAccidentRecord(id: string): VehicleAccidentRecord[] {
    const list = this.getAccidentRecords();
    const updated = list.filter((r) => r.id !== id);
    this.saveAccidentRecords(updated);
    return updated;
  }
}
