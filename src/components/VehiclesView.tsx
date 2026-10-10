import React, { useState } from 'react';
import {
  Car,
  Fuel,
  Wrench,
  Plus,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Edit,
  Trash2,
  TrendingDown,
  Sparkles,
  Camera,
  ShieldCheck,
  Shield,
} from 'lucide-react';
import {
  Vehicle,
  FuelRecord,
  MaintenanceRecord,
  MaintenanceSystemType,
  Language,
  VehicleAccidentRecord,
} from '../types';
import { translations } from '../services/i18n';
import { VehiclesRepository } from '../services';
import { VehicleCameraModal } from './VehicleCameraModal';

interface VehiclesViewProps {
  language: Language;
  currency: string;
  vehicles: Vehicle[];
  fuelRecords: FuelRecord[];
  maintenanceRecords: MaintenanceRecord[];
  onUpdateVehicles: (vehicles: Vehicle[]) => void;
  onUpdateFuel: (fuel: FuelRecord[]) => void;
  onUpdateMaintenance: (maint: MaintenanceRecord[]) => void;
}

export const VehiclesView: React.FC<VehiclesViewProps> = ({
  language,
  currency,
  vehicles,
  fuelRecords,
  maintenanceRecords,
  onUpdateVehicles,
  onUpdateFuel,
  onUpdateMaintenance,
}) => {
  const t = translations[language];
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'fuel' | 'maintenance' | 'accidents'>('overview');

  // Camera & Accidents state
  const [accidentRecords, setAccidentRecords] = useState<VehicleAccidentRecord[]>(() => {
    return VehiclesRepository.getAccidentRecords();
  });
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraModalMode, setCameraModalMode] = useState<'accident' | 'odometer'>('accident');

  const openAccidentCamera = () => {
    setCameraModalMode('accident');
    setIsCameraModalOpen(true);
  };

  const openOdometerCamera = () => {
    setCameraModalMode('odometer');
    setIsCameraModalOpen(true);
  };

  // Modal states
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddFuelModal, setShowAddFuelModal] = useState(false);
  const [showAddMaintModal, setShowAddMaintModal] = useState(false);

  // Form states - Vehicle
  const [vehName, setVehName] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehYear, setVehYear] = useState('2023');
  const [vehPlate, setVehPlate] = useState('');
  const [vehFuelType, setVehFuelType] = useState('95');
  const [vehMileage, setVehMileage] = useState('25000');

  // Form states - Fuel
  const [fuelLiters, setFuelLiters] = useState('40');
  const [fuelPrice, setFuelPrice] = useState('15');
  const [fuelMileage, setFuelMileage] = useState('');
  const [fuelStation, setFuelStation] = useState('');
  const [fuelDate, setFuelDate] = useState(new Date().toISOString().split('T')[0]);

  // Form states - Maintenance (10 Categories)
  const [maintSystem, setMaintSystem] = useState<MaintenanceSystemType>('oil');
  const [maintTitle, setMaintTitle] = useState('');
  const [maintCost, setMaintCost] = useState('1500');
  const [maintCurrentKm, setMaintCurrentKm] = useState('');
  const [maintNextKm, setMaintNextKm] = useState('');
  const [maintCenter, setMaintCenter] = useState('');
  const [maintDate, setMaintDate] = useState(new Date().toISOString().split('T')[0]);

  const currentVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
  const vehFuelRecords = fuelRecords.filter((f) => f.vehicleId === currentVehicle?.id);
  const vehMaintRecords = maintenanceRecords.filter((m) => m.vehicleId === currentVehicle?.id);

  // Fuel analytics
  const totalFuelCost = vehFuelRecords.reduce((sum, r) => sum + r.totalCost, 0);
  const totalFuelLiters = vehFuelRecords.reduce((sum, r) => sum + r.liters, 0);
  const totalMaintCost = vehMaintRecords.reduce((sum, r) => sum + r.cost, 0);

  // 10 Maintenance System labels
  const maintenanceSystemsList: { type: MaintenanceSystemType; labelAr: string; labelEn: string; icon: string }[] = [
    { type: 'oil', labelAr: 'زيت المحرك والفلتر', labelEn: 'Engine Oil & Filter', icon: '🛢️' },
    { type: 'transmission', labelAr: 'زيت الفتيس (الجير)', labelEn: 'Transmission Fluid', icon: '⚙️' },
    { type: 'tires', labelAr: 'الإطارات والترصيص', labelEn: 'Tires & Alignment', icon: '🛞' },
    { type: 'brakes', labelAr: 'الفرامل وتيل الفرامل', labelEn: 'Brakes & Pads', icon: '🛑' },
    { type: 'battery', labelAr: 'البطارية والدينامو', labelEn: 'Battery & Alternator', icon: '🔋' },
    { type: 'air_filter', labelAr: 'فلتر الهواء', labelEn: 'Air Filter', icon: '💨' },
    { type: 'ac_filter', labelAr: 'فلتر التكييف', labelEn: 'Cabin AC Filter', icon: '❄️' },
    { type: 'spark_plugs', labelAr: 'البوجيهات (شمعات الإشعال)', labelEn: 'Spark Plugs', icon: '⚡' },
    { type: 'coolant', labelAr: 'مياه التبريد والردياتير', labelEn: 'Radiator Coolant', icon: '🌡️' },
    { type: 'inspection', labelAr: 'الفحص الدوري الشامل', labelEn: 'Periodic Inspection', icon: '🔍' },
  ];

  // Save new vehicle
  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehName.trim()) return;

    const newVeh: Vehicle = {
      id: 'veh_' + Date.now(),
      name: vehName,
      model: vehModel,
      year: parseInt(vehYear) || 2023,
      plateNumber: vehPlate,
      fuelType: vehFuelType,
      currentMileage: parseInt(vehMileage) || 0,
      color: '#0284c7',
    };

    const updated = [newVeh, ...vehicles];
    onUpdateVehicles(updated);
    VehiclesRepository.saveVehicles(updated);
    setSelectedVehicleId(newVeh.id);
    setShowAddVehicleModal(false);
    setVehName('');
  };

  // Save new fuel
  const handleSaveFuel = (e: React.FormEvent) => {
    e.preventDefault();
    const liters = parseFloat(fuelLiters) || 0;
    const price = parseFloat(fuelPrice) || 0;
    const mileage = parseInt(fuelMileage) || currentVehicle?.currentMileage || 0;

    const newRec: FuelRecord = {
      id: 'fuel_' + Date.now(),
      vehicleId: currentVehicle.id,
      liters,
      pricePerLiter: price,
      totalCost: liters * price,
      mileage,
      date: fuelDate,
      stationName: fuelStation,
    };

    const updated = [newRec, ...fuelRecords];
    onUpdateFuel(updated);
    VehiclesRepository.saveFuelRecords(updated);

    // Update vehicle mileage if higher
    if (mileage > currentVehicle.currentMileage) {
      const updatedVehs = vehicles.map((v) => (v.id === currentVehicle.id ? { ...v, currentMileage: mileage } : v));
      onUpdateVehicles(updatedVehs);
      VehiclesRepository.saveVehicles(updatedVehs);
    }

    setShowAddFuelModal(false);
  };

  // Save new maintenance
  const handleSaveMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(maintCost) || 0;
    const curKm = parseInt(maintCurrentKm) || currentVehicle?.currentMileage || 0;
    const nextKm = parseInt(maintNextKm) || curKm + 10000;

    const newRec: MaintenanceRecord = {
      id: 'maint_' + Date.now(),
      vehicleId: currentVehicle.id,
      systemType: maintSystem,
      title: maintTitle || maintenanceSystemsList.find((s) => s.type === maintSystem)?.labelAr || 'صيانة',
      cost,
      currentMileage: curKm,
      nextMileageDue: nextKm,
      date: maintDate,
      serviceCenter: maintCenter,
    };

    const updated = [newRec, ...maintenanceRecords];
    onUpdateMaintenance(updated);
    VehiclesRepository.saveMaintenanceRecords(updated);
    setShowAddMaintModal(false);
  };

  return (
    <div className="space-y-6" id="vehicles-module">
      {/* Top Header & Car Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-sky-500 text-white shadow-md shadow-sky-500/20">
              <Car className="w-5 h-5" />
            </span>
            {t.vehicles}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar'
              ? 'متابعة سجل الوقود، حساب استهلاك البنزين، ومواعيد الصيانة الدورية لـ 10 أنظمة أساسية'
              : 'Track fuel efficiency, mileage, and 10 critical maintenance systems'}
          </p>
        </div>

        {/* Vehicle Tabs & Add Button */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {vehicles.map((veh) => (
            <button
              key={veh.id}
              onClick={() => setSelectedVehicleId(veh.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedVehicleId === veh.id
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              🚗 {veh.name}
            </button>
          ))}
          <button
            onClick={() => setShowAddVehicleModal(true)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed border-sky-400 text-sky-600 dark:text-sky-400 text-xs font-bold hover:bg-sky-50 dark:hover:bg-sky-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'إضافة سيارة' : 'Add Car'}</span>
          </button>
        </div>
      </div>

      {currentVehicle ? (
        <div className="space-y-6">
          {/* Vehicle Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500">{language === 'ar' ? 'العداد الحالي' : 'Odometer'}</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono-num mt-1">
                {currentVehicle.currentMileage.toLocaleString()} <span className="text-xs font-normal">كم</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{currentVehicle.plateNumber}</div>
            </div>

            <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500">{language === 'ar' ? 'إجمالي تكلفة الوقود' : 'Total Fuel Cost'}</div>
              <div className="text-2xl font-black text-accent-600 dark:text-accent-400 font-mono-num mt-1">
                {totalFuelCost.toLocaleString()} <span className="text-xs font-normal">{currency}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {totalFuelLiters} لتر (بنزين {currentVehicle.fuelType})
              </div>
            </div>

            <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500">{language === 'ar' ? 'إجمالي الصيانة' : 'Total Maintenance'}</div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono-num mt-1">
                {totalMaintCost.toLocaleString()} <span className="text-xs font-normal">{currency}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {vehMaintRecords.length} {language === 'ar' ? 'عمليات صيانة مسجلة' : 'maintenance records'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500">{language === 'ar' ? 'المعدل التقديري' : 'Fuel Efficiency'}</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono-num mt-1">
                13.8 <span className="text-xs font-normal">كم/لتر</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {language === 'ar' ? 'استهلاك ممتاز واقتصادي' : 'Eco rating: Great'}
              </div>
            </div>
          </div>

          {/* Sub-Tabs: Overview, Fuel, Maintenance, Accidents */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveSubTab('overview')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeSubTab === 'overview'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {language === 'ar' ? 'فحص الأنظمة والصيانة' : '10 Systems Health'}
              </button>
              <button
                onClick={() => setActiveSubTab('fuel')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeSubTab === 'fuel'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {language === 'ar' ? 'سجل تزويد الوقود' : 'Fuel Log'}
              </button>
              <button
                onClick={() => setActiveSubTab('maintenance')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeSubTab === 'maintenance'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {language === 'ar' ? 'سجل الفواتير والصيانة' : 'Maintenance History'}
              </button>
              <button
                onClick={() => setActiveSubTab('accidents')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeSubTab === 'accidents'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? '🚨 توثيق الحوادث بالكاميرا' : 'Accidents & Camera'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={openAccidentCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 font-extrabold text-xs border border-red-500/30 transition-all active:scale-95"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? '🚨 تصوير حادث (مؤقت)' : 'Accident Camera'}</span>
              </button>
              <button
                type="button"
                onClick={openOdometerCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-500/10 hover:bg-accent-500/20 text-accent-600 dark:text-accent-400 font-bold text-xs border border-accent-500/30 transition-all active:scale-95"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? '📸 تصوير العداد' : 'Odometer Scan'}</span>
              </button>
            </div>
          </div>

          {/* 10 Systems Grid */}
          {activeSubTab === 'overview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {language === 'ar' ? 'حالة الأنظمة العشرة ومواعيد التغيير القادمة' : '10 Essential Systems Status'}
                </h3>
                <button
                  onClick={() => setShowAddMaintModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'تسجيل صيانة جديدة' : 'Record Service'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {maintenanceSystemsList.map((sys) => {
                  const lastRec = vehMaintRecords.find((r) => r.systemType === sys.type);
                  const remainingKm = lastRec ? lastRec.nextMileageDue - currentVehicle.currentMileage : 10000;
                  const isDueSoon = remainingKm < 2000;

                  return (
                    <div
                      key={sys.type}
                      className={`p-4 rounded-2xl border transition-all ${
                        isDueSoon
                          ? 'bg-accent-50/70 dark:bg-accent-950/30 border-accent-400 dark:border-accent-500'
                          : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="text-2xl mb-2">{sys.icon}</div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        {language === 'ar' ? sys.labelAr : sys.labelEn}
                      </h4>

                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 font-mono-num text-xs">
                        <div className="text-[11px] text-slate-400">
                          {language === 'ar' ? 'متبقي للتغيير:' : 'Remaining:'}
                        </div>
                        <div
                          className={`font-extrabold text-sm ${
                            isDueSoon ? 'text-accent-600 dark:text-accent-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {remainingKm.toLocaleString()} كم
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fuel Tab */}
          {activeSubTab === 'fuel' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {language === 'ar' ? 'سجل تفويلات البنزين' : 'Fueling Log'}
                </h3>
                <button
                  onClick={() => setShowAddFuelModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-xs shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'إضافة تفويلة' : 'Add Fuel'}</span>
                </button>
              </div>

              <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {vehFuelRecords.map((f) => (
                    <div key={f.id} className="p-4 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {f.liters} لتر • {f.stationName || 'محطة وقود'}
                        </div>
                        <div className="text-slate-400 mt-0.5 font-mono-num">
                          {f.date} • عداد {f.mileage.toLocaleString()} كم
                        </div>
                      </div>
                      <div className="font-bold font-mono-num text-accent-600 dark:text-accent-400 text-sm">
                        {f.totalCost.toLocaleString()} {currency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Maintenance History */}
          {activeSubTab === 'maintenance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {language === 'ar' ? 'سجل الفواتير والصيانة' : 'Maintenance Records'}
                </h3>
                <button
                  onClick={() => setShowAddMaintModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'تسجيل صيانة' : 'Record Service'}</span>
                </button>
              </div>

              <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {vehMaintRecords.map((m) => (
                    <div key={m.id} className="p-4 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{m.title}</div>
                        <div className="text-slate-400 mt-0.5 font-mono-num">
                          {m.date} • {m.serviceCenter || 'مركز الخدمة'} • عند {m.currentMileage.toLocaleString()} كم (القادم:{' '}
                          {m.nextMileageDue.toLocaleString()} كم)
                        </div>
                      </div>
                      <div className="font-bold font-mono-num text-rose-600 dark:text-rose-400 text-sm">
                        {m.cost.toLocaleString()} {currency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Accidents SubTab */}
          {activeSubTab === 'accidents' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-6 rounded-3xl bg-gradient-to-r from-red-500/10 via-slate-900/50 to-accent-500/10 border border-red-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-start">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'توثيق وتصوير الحوادث الميدانية مع مؤقت زمني' : 'Field Accident Documentation & Timer'}</span>
                  </div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white">
                    {language === 'ar' ? 'سجل حوادث المركبة والخزنة الرقمية' : 'Accident Records & Digital Vault'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
                    {language === 'ar'
                      ? 'التقاط صور الحوادث فورا مع مؤقت عد تنازلي (3 / 5 / 10 ثواني) وحفظها المشفر في الخزنة الرقمية للرجوع لها عند الحاجة.'
                      : 'Capture accident photos with countdown timer, saved securely in the digital vault.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={openAccidentCamera}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white font-black text-xs shadow-lg shadow-red-900/40 hover:brightness-110 active:scale-95 transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{language === 'ar' ? '🚨 تصوير حادث (مؤقت زمني)' : '🚨 Capture Accident (Timer)'}</span>
                  </button>
                </div>
              </div>

              {accidentRecords.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                    <Camera className="w-7 h-7" />
                  </div>
                  <h5 className="font-bold text-slate-800 dark:text-white text-sm">
                    {language === 'ar' ? 'لا توجد حوادث مسجلة لهذه المركبة' : 'No accident records found'}
                  </h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {language === 'ar'
                      ? 'استخدم زر الكاميرا بالأعلى لالتقاط صور أي حوادث أو خدوش بالسيارة وحفظها مباشرة.'
                      : 'Use the camera button to document vehicle damages with photos and timers.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {accidentRecords.map((acc) => (
                    <div
                      key={acc.id}
                      className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col justify-between"
                    >
                      <div className="relative h-44 bg-slate-900">
                        {acc.photoDataUrl ? (
                          <img src={acc.photoDataUrl} alt={acc.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500">
                            <Camera className="w-8 h-8" />
                          </div>
                        )}
                        {acc.savedToVault && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-emerald-900/80 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{language === 'ar' ? 'الخزنة' : 'Vault'}</span>
                          </span>
                        )}
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-slate-300 text-[10px] font-mono">
                          {acc.dateTime}
                        </span>
                      </div>

                      <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          <h6 className="font-bold text-sm text-slate-900 dark:text-white">{acc.title}</h6>
                          {acc.location && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">📍 {acc.location}</p>
                          )}
                          {acc.notes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 p-2 rounded-xl bg-slate-50 dark:bg-slate-900">
                              {acc.notes}
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-xs font-mono-num font-black text-rose-500">
                            {acc.estimatedDamage ? `${acc.estimatedDamage.toLocaleString()} ${currency}` : (language === 'ar' ? 'تلفيات غير محددة' : 'N/A')}
                          </span>
                          <button
                            onClick={() => {
                              const updated = accidentRecords.filter(x => x.id !== acc.id);
                              setAccidentRecords(updated);
                              VehiclesRepository.saveAccidentRecords(updated);
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16">
          <Car className="w-12 h-12 text-slate-400 mx-auto mb-2 opacity-50" />
          <p className="text-slate-500 text-sm">{language === 'ar' ? 'أضف أول سيارة للبدء' : 'Add your first car'}</p>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-sky-500" />
              <span>{language === 'ar' ? 'إضافة سيارة جديدة' : 'Add New Car'}</span>
            </h3>
            <form onSubmit={handleSaveVehicle} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'اسم ونوع السيارة' : 'Car Name'} *</label>
                <input
                  type="text"
                  required
                  value={vehName}
                  onChange={(e) => setVehName(e.target.value)}
                  placeholder="مثال: تويوتا كورولا"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'سنة الصنع' : 'Year'}</label>
                  <input
                    type="number"
                    value={vehYear}
                    onChange={(e) => setVehYear(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'نوع البنزين' : 'Fuel Type'}</label>
                  <select
                    value={vehFuelType}
                    onChange={(e) => setVehFuelType(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="92">بنزين 92</option>
                    <option value="95">بنزين 95</option>
                    <option value="80">بنزين 80</option>
                    <option value="Diesel">ديزل / سولار</option>
                    <option value="Electric">كهرباء (EV)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'رقم اللوحة' : 'Plate'}</label>
                  <input
                    type="text"
                    value={vehPlate}
                    onChange={(e) => setVehPlate(e.target.value)}
                    placeholder="أ ب ج ١٢٣"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'العداد الحالي (كم)' : 'Mileage'}</label>
                  <input
                    type="number"
                    value={vehMileage}
                    onChange={(e) => setVehMileage(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="px-4 py-2 rounded-xl border"
                >
                  {t.cancel}
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-sky-500 text-white font-bold">
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Fuel Modal */}
      {showAddFuelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Fuel className="w-5 h-5 text-accent-500" />
              <span>{language === 'ar' ? 'تسجيل تفويلة وقود' : 'Add Fuel Entry'}</span>
            </h3>
            <form onSubmit={handleSaveFuel} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'اللترات' : 'Liters'} *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={fuelLiters}
                    onChange={(e) => setFuelLiters(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'سعر اللتر' : 'Price / L'} *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={fuelPrice}
                    onChange={(e) => setFuelPrice(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num font-bold"
                  />
                </div>
              </div>
              <div className="p-3 bg-accent-50 dark:bg-accent-950/40 rounded-xl text-accent-800 dark:text-accent-300 font-bold font-mono-num text-sm text-center">
                {language === 'ar' ? 'الإجمالي:' : 'Total:'}{' '}
                {((parseFloat(fuelLiters) || 0) * (parseFloat(fuelPrice) || 0)).toFixed(2)} {currency}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'العداد الحالي (كم)' : 'Mileage'}</label>
                  <input
                    type="number"
                    value={fuelMileage}
                    onChange={(e) => setFuelMileage(e.target.value)}
                    placeholder={currentVehicle.currentMileage.toString()}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'التاريخ' : 'Date'}</label>
                  <input
                    type="date"
                    value={fuelDate}
                    onChange={(e) => setFuelDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'اسم المحطة' : 'Station'}</label>
                <input
                  type="text"
                  value={fuelStation}
                  onChange={(e) => setFuelStation(e.target.value)}
                  placeholder="مثال: شل، موبيل، وطنية..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddFuelModal(false)}
                  className="px-4 py-2 rounded-xl border"
                >
                  {t.cancel}
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-accent-500 text-white font-bold">
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Maintenance Modal */}
      {showAddMaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-sky-500" />
              <span>{language === 'ar' ? 'تسجيل صيانة دورية' : 'Record Service'}</span>
            </h3>
            <form onSubmit={handleSaveMaintenance} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'النظام' : 'System'}</label>
                <select
                  value={maintSystem}
                  onChange={(e) => setMaintSystem(e.target.value as MaintenanceSystemType)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                >
                  {maintenanceSystemsList.map((s) => (
                    <option key={s.type} value={s.type}>
                      {s.icon} {language === 'ar' ? s.labelAr : s.labelEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">{language === 'ar' ? 'بيان الصيانة' : 'Description'} *</label>
                <input
                  type="text"
                  required
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  placeholder="مثال: تغيير زيت 10,000 كم وفلتر أصلي"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'التكلفة' : 'Cost'} ({currency})</label>
                  <input
                    type="number"
                    value={maintCost}
                    onChange={(e) => setMaintCost(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{language === 'ar' ? 'العداد القادم (كم)' : 'Next KM'}</label>
                  <input
                    type="number"
                    value={maintNextKm}
                    onChange={(e) => setMaintNextKm(e.target.value)}
                    placeholder={(currentVehicle.currentMileage + 10000).toString()}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-num"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMaintModal(false)}
                  className="px-4 py-2 rounded-xl border"
                >
                  {t.cancel}
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-sky-500 text-white font-bold">
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle Camera & Accident / Odometer Scanner Modal */}
      <VehicleCameraModal
        isOpen={isCameraModalOpen}
        initialMode={cameraModalMode}
        onClose={() => setIsCameraModalOpen(false)}
        currency={currency}
        language={language}
        onAccidentSaved={(newAcc) => {
          const updated = [newAcc, ...accidentRecords];
          setAccidentRecords(updated);
          VehiclesRepository.saveAccidentRecords(updated);
          setActiveSubTab('accidents');
        }}
        onOdometerCaptured={(km) => {
          if (currentVehicle) {
            setFuelMileage(km.toString());
            setMaintCurrentKm(km.toString());
            if (km > currentVehicle.currentMileage) {
              const updatedVehs = vehicles.map((v) =>
                v.id === currentVehicle.id ? { ...v, currentMileage: km } : v
              );
              onUpdateVehicles(updatedVehs);
              VehiclesRepository.saveVehicles(updatedVehs);
            }
          }
        }}
      />
    </div>
  );
};
