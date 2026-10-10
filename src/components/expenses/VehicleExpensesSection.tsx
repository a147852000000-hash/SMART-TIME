import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Car,
  Fuel,
  Wrench,
  Plus,
  Trash2,
  Edit2,
  Camera,
  FileSpreadsheet,
  Printer,
  X,
  CheckCircle2,
} from 'lucide-react';
import { formatMoney, isDateInMonth } from '../../services/financeCalculations';
import { Language, VehicleAccidentRecord } from '../../types';
import { VehicleCameraModal } from '../VehicleCameraModal';
import { financeService } from '../../services/financeService';

export interface VehicleFuelRecord {
  id: string;
  fuelType: string;
  price: number;
  liters?: number;
  unit?: string;
  odometer: number;
  dateTime: string;
  odometerPhotoUrl?: string;
}

export interface VehicleMaintenanceRecord {
  id: string;
  maintenanceType: string;
  description: string;
  supplyName: string;
  supplyPrice: number;
  laborDescription: string;
  laborPrice: number;
  total: number;
  date: string;
}


export interface VehicleOilFilterRecord {
  id: string;
  serviceType: string;
  oilIntervalKm?: 5000 | 10000;
  oilBrand?: string;
  productName?: string;
  quantity?: number;
  price: number;
  odometer?: number;
  odometerPhotoUrl?: string;
  notes?: string;
  date: string;
}

interface VehicleExpensesSectionProps {
  language: Language;
  currency: string;
  selectedMonth: string;
  onBack: () => void;
  accidentList?: VehicleAccidentRecord[];
  onSaveAccidents?: (list: VehicleAccidentRecord[]) => void;
  onOpenCamera?: (mode: 'accident' | 'odometer') => void;
}

const EGYPT_FUEL_PRICES: Record<string, { price: string; numeric: number; unit: string }> = {
  'بنزين 80': { price: '20.75', numeric: 20.75, unit: 'لتر' },
  'بنزين 92': { price: '22.25', numeric: 22.25, unit: 'لتر' },
  'بنزين 95': { price: '24.00', numeric: 24, unit: 'لتر' },
  'السولار': { price: '20.50', numeric: 20.5, unit: 'لتر' },
  'الغاز الطبيعي للسيارات': { price: '13.00', numeric: 13, unit: 'متر مكعب' },
  'شحن كهرباء منزلي': { price: '0.68 – 2.89', numeric: 0.68, unit: 'كيلوواط / ساعة' },
  'شحن كهرباء بطيء (AC)': { price: '4.05', numeric: 4.05, unit: 'كيلوواط / ساعة' },
  'شحن كهرباء سريع (DC)': { price: '7.81', numeric: 7.81, unit: 'كيلوواط / ساعة' },
};

const fuelOptions = Object.keys(EGYPT_FUEL_PRICES);

export const VehicleExpensesSection: React.FC<VehicleExpensesSectionProps> = ({
  language,
  currency,
  selectedMonth,
  onBack,
}) => {
  const isAr = language === 'ar';
  const [fuelList, setFuelList] = useState<VehicleFuelRecord[]>([]);
  const [maintList, setMaintList] = useState<VehicleMaintenanceRecord[]>([]);
  const [oilFilterList, setOilFilterList] = useState<VehicleOilFilterRecord[]>([]);
  const loadCanonicalVehicleExpenses = async () => {
    const [fuelRows, maintRows, oilRows] = await Promise.all([
      financeService.getExpenses({ type: 'vehicle_fuel' }),
      financeService.getExpenses({ type: 'vehicle_maint' }),
      financeService.getExpenses({ type: 'vehicle_oil' }),
    ]);
    const parse = (x:any) => { try{return x.notes?JSON.parse(String(x.notes)):{};}catch{return{};} };
    setFuelList(fuelRows.map(x=>{const m=parse(x);return{id:String(x.id),fuelType:String(x.title||'وقود'),price:Number(x.amount)||0,liters:m.liters,unit:m.unit,odometer:Number(m.odometer)||0,dateTime:String(x.date||'').replace(' ','T'),odometerPhotoUrl:m.odometerPhotoUrl};}));
    setMaintList(maintRows.map(x=>{const m=parse(x);return{id:String(x.id),maintenanceType:String(x.title||'صيانة'),description:m.description||'',supplyName:m.supplyName||'',supplyPrice:Number(m.supplyPrice)||0,laborDescription:m.laborDescription||'',laborPrice:Number(m.laborPrice)||0,total:Number(x.amount)||0,date:String(x.date||'').slice(0,10)};}));
    setOilFilterList(oilRows.map(x=>{const m=parse(x);return{id:String(x.id),serviceType:String(x.title||'خدمة'),oilIntervalKm:m.oilIntervalKm,oilBrand:m.oilBrand,productName:m.productName,quantity:m.quantity,price:Number(x.amount)||0,odometer:m.odometer,odometerPhotoUrl:m.odometerPhotoUrl,notes:m.notes,date:String(x.date||'').slice(0,10)};}));
  };
  useEffect(()=>{void loadCanonicalVehicleExpenses();},[]);
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const [screen, setScreen] = useState<'menu' | 'fuel' | 'maintenance' | 'oils'>('menu');
  const [oilTab, setOilTab] = useState<'oil' | 'filters'>('oil');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [editingFuelId, setEditingFuelId] = useState<string | null>(null);
  const [fuelType, setFuelType] = useState('بنزين 92');
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');
  const [fuelOdometerPhoto, setFuelOdometerPhoto] = useState<string | undefined>();
  const [fuelDateTime, setFuelDateTime] = useState(new Date().toISOString().slice(0, 16));
  const [isOdometerCameraOpen, setIsOdometerCameraOpen] = useState(false);
  const [odometerCameraTarget, setOdometerCameraTarget] = useState<'fuel' | 'oil'>('fuel');

  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);
  const [editingMaintId, setEditingMaintId] = useState<string | null>(null);
  const MAINTENANCE_TYPES = [
    'سمكرة وهيكل',
    'دوكو ودهان',
    'ميكانيكا',
    'كهرباء وإلكترونيات',
    'عفشة',
    'نظام التبريد والرادياتير',
    'شكمان ونظام العادم',
    'تكييف وتبريد الصالون',
    'ضبط زوايا وترصيص',
    'إصلاح وتغيير الإطارات',
    'فحص كمبيوتر وتشخيص أعطال',
    'تنجيد وفرش داخلي',
    'عناية وتلميع (ديتيلنج)',
    'زجاج',
  ];

  const [maintType, setMaintType] = useState('سمكرة وهيكل');
  const [maintDesc, setMaintDesc] = useState('');
  const [supplyName, setSupplyName] = useState('');
  const [supplyPrice, setSupplyPrice] = useState('');
  const [laborDesc, setLaborDesc] = useState('');
  const [laborPrice, setLaborPrice] = useState('');
  const [maintDate, setMaintDate] = useState(new Date().toISOString().split('T')[0]);

  const OIL_FILTER_TYPES = [
    'تغيير زيت المحرك',
    'تغيير فلتر زيت المحرك',
    'تغيير زيت الفتيس (ناقل الحركة)',
    'تغيير فلتر زيت الفتيس',
    'تغيير زيت الكورونة / الدفرنشيل',
    'تغيير / تزويد زيت الفرامل',
    'تغيير / تزويد زيت الباور (التوجيه)',
    'تغيير فلتر هواء المحرك',
    'تغيير فلتر تكييف الصالون',
    'تغيير فلتر الوقود (بنزين / سولار)',
    'غسيل دورة المحرك الداخلية (Engine Flush)',
    'تغيير / تزويد سائل الرادياتير',
    'تشحيم النقاط والمفصلات',
  ];
  const OIL_BRANDS = ['موبيل', 'شل', 'كاسترول', 'توتال', 'فالفولين', 'ليكوي مولي', 'أخرى'];
  const [isOilModalOpen, setIsOilModalOpen] = useState(false);
  const [editingOilId, setEditingOilId] = useState<string | null>(null);
  const [oilServiceType, setOilServiceType] = useState('تغيير زيت المحرك');
  const [oilIntervalKm, setOilIntervalKm] = useState<5000 | 10000>(5000);
  const [oilBrand, setOilBrand] = useState('موبيل');
  const [oilProductName, setOilProductName] = useState('');
  const [oilQuantity, setOilQuantity] = useState('');
  const [oilPrice, setOilPrice] = useState('');
  const [oilOdometer, setOilOdometer] = useState('');
  const [oilOdometerPhoto, setOilOdometerPhoto] = useState<string | undefined>();
  const [oilNotes, setOilNotes] = useState('');
  const [oilDate, setOilDate] = useState(new Date().toISOString().split('T')[0]);

  const currentMonthFuel = useMemo(() => fuelList.filter((f) => isDateInMonth(f.dateTime, selectedMonth)), [fuelList, selectedMonth]);
  const currentMonthMaint = useMemo(() => maintList.filter((m) => isDateInMonth(m.date, selectedMonth)), [maintList, selectedMonth]);
  const fuelTotal = currentMonthFuel.reduce((s, f) => s + (Number(f.price) || 0), 0);
  const maintTotal = currentMonthMaint.reduce((s, m) => s + (Number(m.total) || 0), 0);
  const currentMonthOil = useMemo(() => oilFilterList.filter((o) => isDateInMonth(o.date, selectedMonth)), [oilFilterList, selectedMonth]);
  const oilTotal = currentMonthOil.reduce((s, o) => s + (Number(o.price) || 0), 0);

  const selectedFuelPrice = EGYPT_FUEL_PRICES[fuelType];

  const openFuelForm = (record?: VehicleFuelRecord) => {
    setEditingFuelId(record?.id || null);
    setFuelType(record?.fuelType || 'بنزين 92');
    setFuelLiters(record?.liters != null ? String(record.liters) : (record ? String((Number(record.price) || 0) / (EGYPT_FUEL_PRICES[record.fuelType]?.numeric || 1)) : ''));
    setFuelOdometer(record ? String(record.odometer || '') : '');
    setFuelOdometerPhoto(record?.odometerPhotoUrl);
    setFuelDateTime(record?.dateTime || new Date().toISOString().slice(0, 16));
    setIsFuelModalOpen(true);
  };

  const handleSaveFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    const liters = parseFloat(fuelLiters);
    const rate = EGYPT_FUEL_PRICES[fuelType]?.numeric || 0;
    const amount = liters * rate;
    if (!Number.isFinite(liters) || liters <= 0 || rate <= 0) { window.alert(isAr ? 'من فضلك أدخل عدد اللترات / الوحدات بشكل صحيح.' : 'Please enter a valid quantity.'); return; }

    const item: VehicleFuelRecord = {
      id: editingFuelId || `fuel_${Date.now()}`,
      fuelType,
      price: amount,
      odometer: parseFloat(fuelOdometer) || 0,
      odometerPhotoUrl: fuelOdometerPhoto,
      dateTime: fuelDateTime,
    };

    try {
      const notes=JSON.stringify({liters,unit:EGYPT_FUEL_PRICES[fuelType]?.unit,odometer:item.odometer,odometerPhotoUrl:item.odometerPhotoUrl});
      if(editingFuelId) await financeService.updateCanonicalFinanceExpense(editingFuelId,{type:'vehicle_fuel',title:item.fuelType,category:item.fuelType,amount:item.price,date:item.dateTime.slice(0,10),notes});
      else await financeService.addExpense({type:'vehicle_fuel',title:item.fuelType,category:item.fuelType,amount:item.price,date:item.dateTime.slice(0,10),notes});
      await loadCanonicalVehicleExpenses(); setIsFuelModalOpen(false);
    } catch(error){window.alert(error instanceof Error?error.message:'تعذر حفظ الوقود.');}
  };

  const openMaintenanceForm = (record?: VehicleMaintenanceRecord) => {
    setEditingMaintId(record?.id || null);
    setMaintType(record?.maintenanceType || 'سمكرة وهيكل');
    setMaintDesc(record?.description || '');
    setSupplyName(record?.supplyName || '');
    setSupplyPrice(record ? String(record.supplyPrice) : '');
    setLaborDesc(record?.laborDescription || '');
    setLaborPrice(record ? String(record.laborPrice) : '');
    setMaintDate(record?.date || new Date().toISOString().split('T')[0]);
    setIsMaintModalOpen(true);
  };


  const openOilForm = (record?: VehicleOilFilterRecord) => {
    setEditingOilId(record?.id || null);
    setOilServiceType(record?.serviceType || (oilTab === 'filters' ? 'تغيير فلتر زيت المحرك' : 'تغيير زيت المحرك'));
    setOilIntervalKm(record?.oilIntervalKm === 10000 ? 10000 : 5000);
    setOilBrand(record?.oilBrand || 'موبيل');
    setOilProductName(record?.productName || '');
    setOilQuantity(record?.quantity != null ? String(record.quantity) : '');
    setOilPrice(record ? String(record.price) : '');
    setOilOdometer(record?.odometer != null ? String(record.odometer) : '');
    setOilOdometerPhoto(record?.odometerPhotoUrl);
    setOilNotes(record?.notes || '');
    setOilDate(record?.date || new Date().toISOString().split('T')[0]);
    setIsOilModalOpen(true);
  };

  const handleSaveOil = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(oilPrice);
    if (!Number.isFinite(amount) || amount <= 0) { window.alert(isAr ? 'من فضلك أدخل تكلفة صحيحة أكبر من صفر.' : 'Please enter a valid cost greater than zero.'); return; }
    const item: VehicleOilFilterRecord = {
      id: editingOilId || `oil_${Date.now()}`,
      serviceType: oilServiceType,
      oilIntervalKm: oilServiceType === 'تغيير زيت المحرك' ? oilIntervalKm : undefined,
      oilBrand: oilServiceType === 'تغيير زيت المحرك' ? oilBrand : undefined,
      productName: oilProductName.trim() || undefined,
      quantity: parseFloat(oilQuantity) || undefined,
      price: amount,
      odometer: parseFloat(oilOdometer) || undefined,
      odometerPhotoUrl: oilOdometerPhoto,
      notes: oilNotes.trim() || undefined,
      date: oilDate,
    };
    try {
      const notes=JSON.stringify({oilIntervalKm:item.oilIntervalKm,oilBrand:item.oilBrand,productName:item.productName,quantity:item.quantity,odometer:item.odometer,odometerPhotoUrl:item.odometerPhotoUrl,notes:item.notes});
      if(editingOilId) await financeService.updateCanonicalFinanceExpense(editingOilId,{type:'vehicle_oil',title:item.serviceType,category:item.serviceType,amount:item.price,date:item.date,notes});
      else await financeService.addExpense({type:'vehicle_oil',title:item.serviceType,category:item.serviceType,amount:item.price,date:item.date,notes});
      await loadCanonicalVehicleExpenses(); setIsOilModalOpen(false);
    } catch(error){window.alert(error instanceof Error?error.message:'تعذر حفظ الزيوت والفلاتر.');}
  };

  const handleSaveMaint = async (e: React.FormEvent) => {
    e.preventDefault();
    const sPrice = parseFloat(supplyPrice) || 0;
    const lPrice = parseFloat(laborPrice) || 0;
    const total = sPrice + lPrice;
    if (!maintType) { window.alert(isAr ? 'من فضلك اختر نوع الصيانة.' : 'Please select maintenance type.'); return; }
    if (total <= 0) { window.alert(isAr ? 'من فضلك أدخل سعر قطع الغيار أو المصنعية.' : 'Please enter a spare-parts or labor cost.'); return; }

    const item: VehicleMaintenanceRecord = {
      id: editingMaintId || `maint_${Date.now()}`,
      maintenanceType: maintType,
      description: maintDesc.trim(),
      supplyName: supplyName.trim(),
      supplyPrice: sPrice,
      laborDescription: laborDesc.trim(),
      laborPrice: lPrice,
      total,
      date: maintDate,
    };

    try {
      const notes=JSON.stringify({description:item.description,supplyName:item.supplyName,supplyPrice:item.supplyPrice,laborDescription:item.laborDescription,laborPrice:item.laborPrice});
      if(editingMaintId) await financeService.updateCanonicalFinanceExpense(editingMaintId,{type:'vehicle_maint',title:item.maintenanceType,category:item.maintenanceType,amount:item.total,date:item.date,notes});
      else await financeService.addExpense({type:'vehicle_maint',title:item.maintenanceType,category:item.maintenanceType,amount:item.total,date:item.date,notes});
      await loadCanonicalVehicleExpenses(); setIsMaintModalOpen(false);
    } catch(error){window.alert(error instanceof Error?error.message:'تعذر حفظ الصيانة.');}
  };

  const getExportData = (kind: 'fuel' | 'maintenance' | 'oils') => {
    if (kind === 'fuel') return {
      title: 'سجلات الوقود',
      headers: ['نوع الوقود', 'الكمية', 'الوحدة', 'التاريخ والوقت', 'قراءة العداد (كم)', 'التكلفة (جنيه)'],
      rows: fuelList.map((f) => [f.fuelType, f.liters ?? ((Number(f.price) || 0) / (EGYPT_FUEL_PRICES[f.fuelType]?.numeric || 1)), f.unit || EGYPT_FUEL_PRICES[f.fuelType]?.unit || 'لتر', f.dateTime.replace('T', ' '), f.odometer, f.price]),
      filename: `fuel-expenses-${selectedMonth}`,
    };
    if (kind === 'maintenance') return {
      title: 'سجلات الصيانة',
      headers: ['نوع الصيانة', 'التاريخ', 'التفاصيل', 'قطعة الغيار', 'سعر القطعة', 'وصف المصنعية', 'المصنعية', 'الإجمالي'],
      rows: maintList.map((m) => [m.maintenanceType, m.date, m.description, m.supplyName, m.supplyPrice, m.laborDescription, m.laborPrice, m.total]),
      filename: `maintenance-expenses-${selectedMonth}`,
    };
    return {
      title: 'سجلات تغيير الزيوت والفلاتر',
      headers: ['نوع الخدمة', 'فترة زيت المحرك (كم)', 'ماركة الزيت', 'اسم المنتج', 'الكمية', 'التاريخ', 'قراءة العداد', 'التكلفة', 'ملاحظات'],
      rows: oilFilterList.map((o) => [o.serviceType, o.oilIntervalKm || '', o.oilBrand || '', o.productName || '', o.quantity || '', o.date, o.odometer || '', o.price, o.notes || '']),
      filename: `oil-filter-expenses-${selectedMonth}`,
    };
  };

  const downloadBlob = (content: BlobPart, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const exportExcel = (kind: 'fuel' | 'maintenance' | 'oils') => {
    const data = getExportData(kind);
    const table = `<table border="1" dir="rtl"><tr>${data.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>${data.rows.map((row) => `<tr>${row.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</table>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial}table{border-collapse:collapse;width:100%}th,td{padding:8px;border:1px solid #999;text-align:right}th{font-weight:bold}</style></head><body><h2>${escapeHtml(data.title)} - SMART TIME v25.7</h2>${table}</body></html>`;
    downloadBlob('\uFEFF' + html, 'application/vnd.ms-excel;charset=utf-8', `${data.filename}.xls`);
    setExportMenuOpen(false);
  };

  const exportWord = (kind: 'fuel' | 'maintenance' | 'oils') => {
    const data = getExportData(kind);
    const table = `<table><tr>${data.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>${data.rows.map((row) => `<tr>${row.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</table>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial;direction:rtl}h2{text-align:center}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:7px;text-align:right}th{font-weight:bold;background:#eee}</style></head><body><h2>${escapeHtml(data.title)} - SMART TIME v25.7</h2>${table}</body></html>`;
    downloadBlob('\uFEFF' + html, 'application/msword;charset=utf-8', `${data.filename}.doc`);
    setExportMenuOpen(false);
  };

  const exportPdf = (kind: 'fuel' | 'maintenance' | 'oils') => {
    const data = getExportData(kind);
    const table = `<table><thead><tr>${data.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${data.rows.map((row) => `<tr>${row.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) { window.alert(isAr ? 'اسمح بفتح النوافذ المنبثقة ثم أعد المحاولة.' : 'Please allow popups and try again.'); return; }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;direction:rtl;color:#111}h1{text-align:center;font-size:20px}p{font-size:11px;text-align:center;color:#555}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #555;padding:5px;text-align:right}th{font-weight:bold;background:#eee}</style></head><body><h1>${escapeHtml(data.title)} - SMART TIME v25.7</h1><p>الشهر: ${escapeHtml(selectedMonth)}</p>${table}<script>window.onload=function(){setTimeout(function(){window.print()},300)};<\/script></body></html>`);
    win.document.close();
    setExportMenuOpen(false);
  };

  const printSection = () => window.print();

  const pageTitle = screen === 'fuel' ? 'الوقود' : screen === 'maintenance' ? 'الصيانة' : screen === 'oils' ? 'تغيير الزيوت' : 'سيارتي';

  if (screen === 'menu') {
    return (
      <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95">
            <BackIcon className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">سيارتي</h1>
            <p className="text-xs text-slate-500">إدارة الوقود والصيانة والزيوت بسهولة</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => setScreen('fuel')} className="text-right bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:-translate-y-1 hover:border-teal-300 transition-all group">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Fuel className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">الوقود</h2>
            <p className="text-sm text-slate-500 mt-1">تسجيل التفويلات وقراءة العداد والأسعار المعتمدة</p>
            <div className="mt-4 text-xs font-bold text-teal-600">{fuelList.length} سجل وقود</div>
          </button>

          <button onClick={() => setScreen('maintenance')} className="text-right bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:-translate-y-1 hover:border-cyan-300 transition-all group">
            <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Wrench className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">الصيانة</h2>
            <p className="text-sm text-slate-500 mt-1">قطع الغيار والمصنعية وتاريخ كل عملية صيانة</p>
            <div className="mt-4 text-xs font-bold text-cyan-600">{maintList.length} سجل صيانة</div>
          </button>

          <button onClick={() => setScreen('oils')} className="text-right bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:-translate-y-1 hover:border-emerald-300 transition-all group">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Fuel className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">تغيير الزيوت</h2>
            <p className="text-sm text-slate-500 mt-1">متابعة تغيير الزيوت والفلاتر وقراءة العداد</p>
            <div className="mt-4 text-xs font-bold text-emerald-600">{oilFilterList.length} سجل زيوت وفلاتر</div>
          </button>
        </div>
      </div>
    );
  }

  const isFuelScreen = screen === 'fuel';
  const filteredFuel = fuelList.filter((f) => `${f.fuelType} ${f.dateTime}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredMaint = maintList.filter((m) => `${m.maintenanceType} ${m.description} ${m.supplyName}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredOil = oilFilterList.filter((o) => {
    const isFilter = o.serviceType.startsWith('تغيير فلتر');
    if (oilTab === 'filters' && !isFilter) return false;
    if (oilTab === 'oil' && isFilter) return false;
    return `${o.serviceType} ${o.oilBrand || ''} ${o.productName || ''} ${o.notes || ''}`.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen('menu')} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95">
            <BackIcon className="w-5 h-5" />
          </button>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isFuelScreen ? 'bg-teal-50 text-teal-600' : 'bg-cyan-50 text-cyan-600'}`}>
            {isFuelScreen ? <Fuel className="w-6 h-6" /> : <Wrench className="w-6 h-6" />}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">{pageTitle}</h1>
            <p className="text-xs text-slate-500">{isFuelScreen ? 'سجلات الوقود وقراءة العداد' : 'سجلات الصيانة وقطع الغيار'}</p>
          </div>
        </div>

        {screen === 'oils' && (
          <div className="mt-4 grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <button onClick={() => setOilTab('oil')} className={`py-2.5 rounded-xl font-black text-sm ${oilTab === 'oil' ? 'bg-white dark:bg-slate-900 text-emerald-700 shadow-sm' : 'text-slate-500'}`}>تغيير الزيوت</button>
            <button onClick={() => setOilTab('filters')} className={`py-2.5 rounded-xl font-black text-sm ${oilTab === 'filters' ? 'bg-white dark:bg-slate-900 text-emerald-700 shadow-sm' : 'text-slate-500'}`}>تغيير فلاتر</button>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => isFuelScreen ? openFuelForm() : screen === 'oils' ? openOilForm() : openMaintenanceForm()}
            className={`flex-1 py-3 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 ${isFuelScreen ? 'bg-teal-500 hover:bg-teal-600' : 'bg-cyan-600 hover:bg-cyan-700'}`}
          >
            <Plus className="w-5 h-5" />
            {isFuelScreen ? 'إضافة وقود' : screen === 'oils' ? (oilTab === 'oil' ? 'إضافة تغيير زيت' : 'إضافة تغيير فلتر') : 'إضافة صيانة'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 font-bold">{isFuelScreen ? 'إجمالي الوقود هذا الشهر' : screen === 'oils' ? 'إجمالي الزيوت والفلاتر هذا الشهر' : 'إجمالي الصيانة هذا الشهر'}</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatMoney(isFuelScreen ? fuelTotal : screen === 'oils' ? oilTotal : maintTotal)} <span className="text-xs font-semibold text-slate-500">{currency}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 font-bold">عدد السجلات</span>
          <div className="text-2xl font-black text-teal-600 mt-1">{isFuelScreen ? fuelList.length : screen === 'oils' ? oilFilterList.length : maintList.length}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-2">
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث في السجلات..." className="flex-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm" />
        <div className="flex gap-2">
          <div className="relative">
            <button type="button" onClick={() => setExportMenuOpen((v) => !v)} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs flex items-center gap-1.5"><FileSpreadsheet className="w-4 h-4" /> تصدير</button>
            {exportMenuOpen && (
              <div className="absolute left-0 top-full mt-2 z-30 w-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-1.5">
                <button type="button" onClick={() => exportPdf(isFuelScreen ? 'fuel' : screen === 'oils' ? 'oils' : 'maintenance')} className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs">📄 تصدير PDF</button>
                <button type="button" onClick={() => exportExcel(isFuelScreen ? 'fuel' : screen === 'oils' ? 'oils' : 'maintenance')} className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs">📊 تصدير Excel</button>
                <button type="button" onClick={() => exportWord(isFuelScreen ? 'fuel' : screen === 'oils' ? 'oils' : 'maintenance')} className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs">📝 تصدير Word</button>
              </div>
            )}
          </div>
          <button onClick={printSection} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs flex items-center gap-1.5"><Printer className="w-4 h-4" /> طباعة</button>
        </div>
      </div>

      {isFuelScreen ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {filteredFuel.length === 0 ? (
            <div className="p-10 text-center text-slate-400"><Fuel className="w-10 h-10 mx-auto mb-2" /><p className="text-sm">لا توجد سجلات وقود</p></div>
          ) : filteredFuel.map((f) => (
            <div key={f.id} className="p-4 border-b last:border-b-0 border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center shrink-0"><Fuel className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <div className="font-black text-slate-900 dark:text-white">{f.fuelType}</div>
                  <div className="text-[11px] text-slate-500">{f.dateTime.replace('T', ' ')} • {Number(f.liters != null ? f.liters : ((Number(f.price) || 0) / (EGYPT_FUEL_PRICES[f.fuelType]?.numeric || 1))).toLocaleString()} {f.unit || EGYPT_FUEL_PRICES[f.fuelType]?.unit || 'لتر'} • العداد: {Number(f.odometer || 0).toLocaleString()} كم</div>
                  {f.odometerPhotoUrl && <div className="text-[10px] text-teal-600 font-bold mt-0.5">✓ صورة العداد مرفقة</div>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-left"><div className="font-black text-teal-600">{formatMoney(f.price)} {currency}</div><div className="text-[10px] text-slate-400">المبلغ المدفوع</div></div>
                <button onClick={() => openFuelForm(f)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-teal-600" title="تعديل"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => void financeService.deleteCanonicalFinanceExpense(f.id).then(loadCanonicalVehicleExpenses).catch(error=>window.alert(error instanceof Error?error.message:'تعذر حذف الوقود.'))} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-rose-600" title="حذف"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : screen === 'oils' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {filteredOil.length === 0 ? (
            <div className="p-10 text-center text-slate-400"><Wrench className="w-10 h-10 mx-auto mb-2" /><p className="text-sm">لا توجد سجلات زيوت أو فلاتر</p></div>
          ) : filteredOil.map((o) => (
            <div key={o.id} className="p-4 border-b last:border-b-0 border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-black text-slate-900 dark:text-white">{o.serviceType}</div>
                <div className="text-xs text-slate-500 mt-1">{o.serviceType === 'تغيير زيت المحرك' && o.oilIntervalKm ? `زيت ${o.oilIntervalKm.toLocaleString()} كم • ${o.oilBrand || ''}` : (o.productName || o.oilBrand || 'خدمة زيوت وفلاتر')}</div>
                <div className="text-[11px] text-slate-400">{o.date}{o.odometer ? ` • العداد: ${o.odometer.toLocaleString()} كم` : ''}</div>{o.odometerPhotoUrl && <div className="text-[10px] text-emerald-600 font-bold mt-0.5">✓ صورة العداد مرفقة</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0"><div className="font-black text-cyan-600">{formatMoney(o.price)} {currency}</div><button onClick={() => openOilForm(o)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-cyan-600" title="تعديل"><Edit2 className="w-4 h-4" /></button><button onClick={() => void financeService.deleteCanonicalFinanceExpense(o.id).then(loadCanonicalVehicleExpenses).catch(error=>window.alert(error instanceof Error?error.message:'تعذر حذف خدمة الزيت.'))} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-rose-600" title="حذف"><Trash2 className="w-4 h-4" /></button></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {filteredMaint.length === 0 ? (
            <div className="p-10 text-center text-slate-400"><Wrench className="w-10 h-10 mx-auto mb-2" /><p className="text-sm">لا توجد سجلات صيانة</p></div>
          ) : filteredMaint.map((m) => (
            <div key={m.id} className="p-4 border-b last:border-b-0 border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0"><div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 flex items-center justify-center shrink-0"><Wrench className="w-5 h-5" /></div><div className="min-w-0"><div className="font-black text-slate-900 dark:text-white">{m.maintenanceType}</div><div className="text-xs text-slate-500 truncate">{m.description || m.supplyName || 'صيانة'}</div><div className="text-[11px] text-slate-400">{m.date} • قطع: {formatMoney(m.supplyPrice)} + مصنعية: {formatMoney(m.laborPrice)} {currency}</div></div></div>
              <div className="flex items-center gap-2 shrink-0"><div className="font-black text-cyan-600">{formatMoney(m.total)} {currency}</div><button onClick={() => openMaintenanceForm(m)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-cyan-600" title="تعديل"><Edit2 className="w-4 h-4" /></button><button onClick={() => void financeService.deleteCanonicalFinanceExpense(m.id).then(loadCanonicalVehicleExpenses).catch(error=>window.alert(error instanceof Error?error.message:'تعذر حذف الصيانة.'))} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-rose-600" title="حذف"><Trash2 className="w-4 h-4" /></button></div>
            </div>
          ))}
        </div>
      )}

      {isFuelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3"><h3 className="font-black text-lg">{editingFuelId ? 'تعديل سجل الوقود' : 'إضافة وقود'}</h3><button onClick={() => setIsFuelModalOpen(false)}><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSaveFuel} className="space-y-4 text-sm">
              <div><label className="font-bold">نوع الوقود / مصدر الطاقة</label><select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1">{fuelOptions.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div className="rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 p-3 flex items-center justify-between gap-3"><div><div className="text-[11px] text-teal-700 dark:text-teal-300 font-bold">السعر المعتمد في مصر</div><div className="text-xl font-black text-teal-700 dark:text-teal-300">{selectedFuelPrice?.price} جنيه</div></div><div className="text-xs font-bold text-slate-500">{selectedFuelPrice?.unit}</div></div>
              <div><label className="font-bold">عدد اللترات / الوحدة *</label><input type="number" step="0.01" min="0.01" required value={fuelLiters} onChange={(e) => setFuelLiters(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" placeholder={selectedFuelPrice?.unit === 'لتر' ? 'مثال: 25 لتر' : 'أدخل الكمية'} /></div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 border p-3 flex items-center justify-between"><span className="font-bold">التكلفة المحسوبة</span><strong className="text-xl text-teal-600">{((parseFloat(fuelLiters) || 0) * (selectedFuelPrice?.numeric || 0)).toFixed(2)} جنيه</strong></div>
              <div><label className="font-bold flex items-center justify-between">قراءة العداد (كم)<button type="button" onClick={() => { setOdometerCameraTarget('fuel'); setIsOdometerCameraOpen(true); }} className="px-3 py-1.5 rounded-xl bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5"><Camera className="w-4 h-4" /> تصوير العداد</button></label><input type="number" min="0" value={fuelOdometer} onChange={(e) => setFuelOdometer(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" />{fuelOdometerPhoto && <div className="mt-2 flex items-center gap-2 text-xs text-teal-600 font-bold"><CheckCircle2 className="w-4 h-4" /> تم إرفاق صورة العداد</div>}</div>
              <div><label className="font-bold">التاريخ والوقت</label><input type="datetime-local" value={fuelDateTime} onChange={(e) => setFuelDateTime(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" /></div>
              <button type="submit" className="w-full py-3 rounded-2xl bg-teal-500 text-white font-black">{editingFuelId ? 'حفظ التعديل' : 'حفظ الوقود'}</button>
            </form>
          </div>
        </div>
      )}

      {isMaintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3"><h3 className="font-black text-lg">{editingMaintId ? 'تعديل سجل الصيانة' : 'إضافة صيانة'}</h3><button onClick={() => setIsMaintModalOpen(false)}><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSaveMaint} className="space-y-3 text-sm">
              <div><label className="font-bold">نوع الصيانة</label><select value={maintType} onChange={(e) => setMaintType(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1">{MAINTENANCE_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className="font-bold">وصف الصيانة</label><input value={maintDesc} onChange={(e) => setMaintDesc(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" /></div>
              <div><label className="font-bold">اسم قطعة الغيار</label><input value={supplyName} onChange={(e) => setSupplyName(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" /></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="font-bold">سعر قطع الغيار</label><input type="number" step="0.01" value={supplyPrice} onChange={(e) => setSupplyPrice(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" /></div><div><label className="font-bold">أجرة اليد / المصنعية</label><input type="number" step="0.01" value={laborPrice} onChange={(e) => setLaborPrice(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" /></div></div>
              <div><label className="font-bold">وصف المصنعية</label><input value={laborDesc} onChange={(e) => setLaborDesc(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" /></div>
              <div><label className="font-bold">التاريخ</label><input type="date" value={maintDate} onChange={(e) => setMaintDate(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" /></div>
              <button type="submit" className="w-full py-3 rounded-2xl bg-cyan-600 text-white font-black">{editingMaintId ? 'حفظ التعديل' : 'حفظ الصيانة'}</button>
            </form>
          </div>
        </div>
      )}


      {isOilModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3"><h3 className="font-black text-lg">{editingOilId ? 'تعديل سجل الزيوت والفلاتر' : oilTab === 'oil' ? 'إضافة تغيير زيت' : 'إضافة تغيير فلتر'}</h3><button onClick={() => setIsOilModalOpen(false)}><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSaveOil} className="space-y-3 text-sm">
              <div><label className="font-bold">نوع الخدمة</label><select value={oilServiceType} onChange={(e) => setOilServiceType(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1">{(oilTab === 'oil' ? OIL_FILTER_TYPES.filter((x) => x.includes('زيت') || x.includes('غسيل') || x.includes('سائل') || x.includes('تشحيم')) : ['تغيير فلتر زيت المحرك','تغيير فلتر زيت الفتيس','تغيير فلتر هواء المحرك','تغيير فلتر تكييف الصالون','تغيير فلتر الوقود (بنزين / سولار)']).map((x) => <option key={x}>{x}</option>)}</select></div>
              {oilTab === 'oil' && oilServiceType === 'تغيير زيت المحرك' && <>
                <div><label className="font-bold">نوع تغيير زيت المحرك</label><div className="grid grid-cols-2 gap-2 mt-1"><button type="button" onClick={() => setOilIntervalKm(5000)} className={`p-3 rounded-xl border font-black ${oilIntervalKm === 5000 ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 dark:bg-slate-800'}`}>زيت 5,000 كم</button><button type="button" onClick={() => setOilIntervalKm(10000)} className={`p-3 rounded-xl border font-black ${oilIntervalKm === 10000 ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-50 dark:bg-slate-800'}`}>زيت 10,000 كم</button></div></div>
                <div><label className="font-bold">نوع / ماركة الزيت</label><select value={oilBrand} onChange={(e) => setOilBrand(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1">{OIL_BRANDS.map((x) => <option key={x}>{x}</option>)}</select></div>
              </>}
              <div><label className="font-bold">اسم المنتج / الموديل (اختياري)</label><input value={oilProductName} onChange={(e) => setOilProductName(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" placeholder="مثال: Mobil Super 3000" /></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="font-bold">الكمية / العدد</label><input type="number" min="0" step="0.1" value={oilQuantity} onChange={(e) => setOilQuantity(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" /></div><div><label className="font-bold">التكلفة *</label><input type="number" min="0.01" step="0.01" required value={oilPrice} onChange={(e) => setOilPrice(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" /></div></div>
              <div><label className="font-bold flex items-center justify-between">قراءة العداد (كم)<button type="button" onClick={() => { setOdometerCameraTarget('oil'); setIsOdometerCameraOpen(true); }} className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"><Camera className="w-4 h-4" /> تصوير العداد</button></label><input type="number" min="0" value={oilOdometer} onChange={(e) => setOilOdometer(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" /></div>
              <div><label className="font-bold">ملاحظات</label><textarea value={oilNotes} onChange={(e) => setOilNotes(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1 min-h-20" /></div>
              <div><label className="font-bold">التاريخ</label><input type="date" value={oilDate} onChange={(e) => setOilDate(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border mt-1" /></div>
              <button type="submit" className="w-full py-3 rounded-2xl bg-cyan-600 text-white font-black">{editingOilId ? 'حفظ التعديل' : 'حفظ التغيير'}</button>
            </form>
          </div>
        </div>
      )}

      <VehicleCameraModal
        isOpen={isOdometerCameraOpen}
        initialMode="odometer"
        odometerOnly
        onClose={() => setIsOdometerCameraOpen(false)}
        language={language}
        currency={currency}
        onOdometerCaptured={(odometer, photoUrl) => {
          if (odometerCameraTarget === 'fuel') {
            setFuelOdometer(String(odometer || ''));
            setFuelOdometerPhoto(photoUrl);
          } else {
            setOilOdometer(String(odometer || ''));
            setOilOdometerPhoto(photoUrl);
          }
          setIsOdometerCameraOpen(false);
        }}
      />
    </div>
  );
};
