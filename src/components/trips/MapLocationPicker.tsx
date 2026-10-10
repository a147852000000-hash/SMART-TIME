import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiUrl } from '../../services/apiConfig';
import { Crosshair, Check, Loader2, Plus, Trash2, CheckCircle2, GripVertical } from 'lucide-react';
import { TripLocation, LocationPickerMode } from './types';

interface MapLocationPickerProps {
  mode: LocationPickerMode;
  initialLocation?: TripLocation | null;
  onConfirm: (location: TripLocation) => void;
  onConfirmAndAddStop?: (location: TripLocation) => void;
  onDeleteStop?: () => void;
  isEditingStop?: boolean;
  onCancel?: () => void;
  onLocationStateChange?: (state: { address: string; lat: number; lng: number; isGeocoding: boolean }) => void;
  language?: 'ar' | 'en';
}

const pickupDivIcon = L.divIcon({
  className: 'smart-trip-marker',
  html: '<div style="transform: rotate(-45deg); width: 44px; height: 44px; border-radius: 50% 50% 50% 0; background: #10b981; border: 3px solid #fff; box-shadow: 0 6px 18px rgba(16,185,129,0.45); display: flex; align-items: center; justify-content: center; font-size: 20px;"><span style="transform: rotate(45deg);">📍</span></div>',
  iconSize: [44, 44],
  iconAnchor: [22, 40],
});

const dropoffDivIcon = L.divIcon({
  className: 'smart-trip-marker',
  html: '<div style="transform: rotate(-45deg); width: 44px; height: 44px; border-radius: 50% 50% 50% 0; background: #f43f5e; border: 3px solid #fff; box-shadow: 0 6px 18px rgba(244,63,94,0.45); display: flex; align-items: center; justify-content: center; font-size: 20px;"><span style="transform: rotate(45deg);">🏁</span></div>',
  iconSize: [44, 44],
  iconAnchor: [22, 40],
});

const stopDivIcon = L.divIcon({
  className: 'smart-trip-marker',
  html: '<div style="transform: rotate(-45deg); width: 44px; height: 44px; border-radius: 50% 50% 50% 0; background: #f59e0b; border: 3px solid #fff; box-shadow: 0 6px 18px rgba(245,158,11,0.45); display: flex; align-items: center; justify-content: center; font-size: 20px;"><span style="transform: rotate(45deg);">🛑</span></div>',
  iconSize: [44, 44],
  iconAnchor: [22, 40],
});

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  mode,
  initialLocation,
  onConfirm,
  onConfirmAndAddStop,
  onDeleteStop,
  isEditingStop,
  onLocationStateChange,
  language = 'ar',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const isRtl = language === 'ar';
  const key = import.meta.env.VITE_MAPTILER_API_KEY || '';

  const [currentMode, setCurrentMode] = useState<LocationPickerMode>(mode);
  const [successToast, setSuccessToast] = useState<string>('');

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const [selectedPos, setSelectedPos] = useState({
    lat: initialLocation?.latitude || 30.0444,
    lng: initialLocation?.longitude || 31.2357,
  });

  const [address, setAddress] = useState(
    initialLocation?.address ||
      (mode === 'pickup'
        ? (isRtl ? 'مدينة نصر، القاهرة' : 'Nasr City, Cairo')
        : mode === 'dropoff'
        ? (isRtl ? 'التجمع الخامس، القاهرة الجديدة' : '5th Settlement, New Cairo')
        : (isRtl ? 'نقطة توقف إضافية' : 'Intermediate Stop'))
  );
  const [loading, setLoading] = useState(false);

  // Draggable floating actions bar state
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  const getActiveIcon = useCallback((m: LocationPickerMode) => {
    if (m === 'pickup') return pickupDivIcon;
    if (m === 'stop') return stopDivIcon;
    return dropoffDivIcon;
  }, []);

  const reverse = useCallback(
    async (lat: number, lng: number) => {
      setLoading(true);
      onLocationStateChange?.({ address, lat, lng, isGeocoding: true });
      try {
        const r = await fetch(apiUrl(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`));
        const d = await r.json();
        if (d && d.address) {
          setAddress(d.address);
          onLocationStateChange?.({ address: d.address, lat, lng, isGeocoding: false });
          if (marker.current) {
            marker.current.bindTooltip(d.address, { direction: 'top', permanent: false }).openTooltip();
          }
        } else {
          const fallback = `موقع محدد (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
          setAddress(fallback);
          onLocationStateChange?.({ address: fallback, lat, lng, isGeocoding: false });
        }
      } catch {
        const fallback = `موقع محدد (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
        setAddress(fallback);
        onLocationStateChange?.({ address: fallback, lat, lng, isGeocoding: false });
      } finally {
        setLoading(false);
      }
    },
    [onLocationStateChange, address]
  );

  const select = useCallback(
    (lat: number, lng: number, doReverse = true) => {
      setSelectedPos({ lat, lng });
      const initialFallback = `موقع محدد (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      setAddress(initialFallback);
      onLocationStateChange?.({ address: initialFallback, lat, lng, isGeocoding: doReverse });

      const activeIcon = getActiveIcon(currentMode);

      if (marker.current) {
        marker.current.setLatLng([lat, lng]);
        marker.current.setIcon(activeIcon);
      } else if (map.current) {
        marker.current = L.marker([lat, lng], { icon: activeIcon, draggable: true }).addTo(map.current);
        marker.current.on('dragend', (e) => {
          const p = (e.target as L.Marker).getLatLng();
          select(p.lat, p.lng, true);
        });
      }

      map.current?.setView([lat, lng], Math.max(map.current.getZoom(), 14));
      if (doReverse) reverse(lat, lng);
    },
    [currentMode, reverse, getActiveIcon, onLocationStateChange]
  );

  const selectRef = useRef(select);
  selectRef.current = select;

  useEffect(() => {
    if (!mapRef.current || map.current) return;
    const m = L.map(mapRef.current, { zoomControl: true }).setView([selectedPos.lat, selectedPos.lng], 14);
    const tileUrl = key
      ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${key}`
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    L.tileLayer(tileUrl, {
      maxZoom: 20,
      attribution: key ? '&copy; MapTiler &copy; OpenStreetMap' : '&copy; OpenStreetMap contributors',
    }).addTo(m);

    const activeIcon = currentMode === 'pickup' ? pickupDivIcon : currentMode === 'stop' ? stopDivIcon : dropoffDivIcon;
    const initialMarker = L.marker([selectedPos.lat, selectedPos.lng], {
      icon: activeIcon,
      draggable: true,
    }).addTo(m);

    initialMarker.on('dragend', (e) => {
      const p = (e.target as L.Marker).getLatLng();
      selectRef.current(p.lat, p.lng, true);
    });

    marker.current = initialMarker;

    m.on('click', (e: L.LeafletMouseEvent) => {
      selectRef.current(e.latlng.lat, e.latlng.lng, true);
    });

    map.current = m;
    setTimeout(() => m.invalidateSize(), 150);

    // Initial trigger to report state
    onLocationStateChange?.({
      address,
      lat: selectedPos.lat,
      lng: selectedPos.lng,
      isGeocoding: false,
    });

    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  const gps = () => {
    if (!navigator.geolocation) {
      alert(isRtl ? 'الموقع الجغرافي غير متاح' : 'Geolocation unavailable');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        select(p.coords.latitude, p.coords.longitude, true);
      },
      () => {
        setLoading(false);
        alert(isRtl ? 'تعذر الحصول على موقعك الحالي' : 'Unable to get your location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const buildFinalLocation = (): TripLocation => {
    const finalAddress = address?.trim() || `${selectedPos.lat.toFixed(5)}, ${selectedPos.lng.toFixed(5)}`;
    const finalName =
      currentMode === 'pickup'
        ? isRtl
          ? 'نقطة الانطلاق'
          : 'Pickup Point'
        : currentMode === 'stop'
        ? isRtl
          ? isEditingStop
            ? 'تعديل نقطة التوقف'
            : 'نقطة توقف'
          : isEditingStop
          ? 'Edit Stop'
          : 'Stop Point'
        : isRtl
        ? 'نقطة النزول'
        : 'Dropoff Point';
    return {
      address: finalAddress,
      name: finalName,
      latitude: selectedPos.lat,
      longitude: selectedPos.lng,
    };
  };

  const handleSaveAndContinue = () => {
    onConfirm(buildFinalLocation());
  };

  // تاب نقطة إضافية: يحفظ النقطة الحالية وينتقل فوراً لاختيار نقطة التوقف التالية على الخريطة
  const handleSaveAndAddStop = () => {
    const loc = buildFinalLocation();
    if (onConfirmAndAddStop) {
      onConfirmAndAddStop(loc);
    } else {
      onConfirm(loc);
    }

    setCurrentMode('stop');
    setSuccessToast(
      isRtl
        ? '✓ تم حفظ النقطة! انقر على الخريطة لاختيار مكان النقطة التالية'
        : '✓ Saved! Click on map to place the next stop'
    );
    if (marker.current) {
      marker.current.setIcon(stopDivIcon);
    }
    setTimeout(() => {
      setSuccessToast('');
    }, 4000);
  };

  // --- Dragging Handlers for Action Buttons Bar ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    e.stopPropagation();
    const container = containerRef.current;
    const dock = e.currentTarget;
    if (!container || !dock) return;

    const containerRect = container.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();

    const currentX = dragPos ? dragPos.x : dockRect.left - containerRect.left;
    const currentY = dragPos ? dragPos.y : dockRect.top - containerRect.top;

    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentX,
      initialY: currentY,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();

    const container = containerRef.current;
    const dock = e.currentTarget;
    if (!container || !dock) return;

    const containerRect = container.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    let newX = dragStartRef.current.initialX + deltaX;
    let newY = dragStartRef.current.initialY + deltaY;

    const minX = 8;
    const maxX = containerRect.width - dockRect.width - 8;
    const minY = 8;
    const maxY = containerRect.height - dockRect.height - 8;

    newX = Math.max(minX, Math.min(newX, maxX));
    newY = Math.max(minY, Math.min(newY, maxY));

    setDragPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[460px] sm:h-[500px] rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 select-none"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* الخريطة التفاعلية */}
      <div ref={mapRef} className="w-full h-full" />

      {/* تنبيه سريع عند الانتقال للنقطة التالية */}
      {successToast && (
        <div className="absolute top-3 inset-x-4 z-[700] flex justify-center pointer-events-none animate-bounce">
          <div className="bg-emerald-600 text-white font-black text-xs px-3.5 py-1.5 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{successToast}</span>
          </div>
        </div>
      )}

      {/* زر الموقع الحالي العائم في الركن العلوي */}
      <div className="absolute top-3 end-3 z-[600]">
        <button
          type="button"
          onClick={gps}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md border border-slate-200 dark:border-slate-700 text-xs font-black text-cyan-700 dark:text-cyan-400 hover:scale-105 active:scale-95 transition-all"
          title={isRtl ? 'تحديد موقعي الحالي بدقة' : 'My location'}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600" /> : <Crosshair className="w-3.5 h-3.5 text-cyan-600" />}
          <span>{isRtl ? 'موقعي' : 'GPS'}</span>
        </button>
      </div>

      {/* أزرار الحفظ والإضافة العائمة والقابلة للتحريك والسحب على الخريطة */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={
          dragPos
            ? {
                position: 'absolute',
                left: `${dragPos.x}px`,
                top: `${dragPos.y}px`,
                zIndex: 600,
              }
            : {
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 600,
              }
        }
        className="pointer-events-auto backdrop-blur-xl bg-slate-950/90 text-white p-1.5 sm:p-2 rounded-2xl border border-white/20 shadow-2xl flex items-center gap-1.5 cursor-grab active:cursor-grabbing touch-none select-none"
        title={isRtl ? 'اسحب من أي مكان في هذا الشريط لتحريك الأزرار على الخريطة' : 'Drag to reposition anywhere on map'}
      >
        {/* مقبض سحب وتحريك */}
        <div
          className="flex items-center text-slate-400 hover:text-slate-200 px-1 cursor-grab"
          title={isRtl ? 'اسحب للتحريك' : 'Drag handle'}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* زر حذف نقطة التوقف إن وجد */}
        {isEditingStop && onDeleteStop && (
          <button
            type="button"
            onClick={onDeleteStop}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl font-black text-xs text-white bg-rose-600 hover:bg-rose-500 shadow-md transition-all active:scale-95 whitespace-nowrap"
            title={isRtl ? 'حذف هذه النقطة من المسار' : 'Delete Stop'}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isRtl ? 'حذف' : 'Delete'}</span>
          </button>
        )}

        {/* زر صغير: حفظ + نقطة إضافية */}
        <button
          type="button"
          onClick={handleSaveAndAddStop}
          className="flex items-center gap-1 px-3 py-2 rounded-xl font-black text-xs text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-md transition-all active:scale-95 whitespace-nowrap"
          title={isRtl ? 'حفظ هذا المكان والانتقال لتحديد نقطة توقف إضافية' : 'Save & Add Next Stop'}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isRtl ? 'حفظ + نقطة إضافية' : '+ نقطة'}</span>
        </button>

        {/* زر صغير: حفظ ومتابعة */}
        <button
          type="button"
          onClick={handleSaveAndContinue}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black text-xs text-white shadow-md transition-all active:scale-95 whitespace-nowrap ${
            currentMode === 'pickup'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
              : currentMode === 'stop'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950'
              : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
          }`}
          title={isRtl ? 'حفظ ومتابعة الرحلة' : 'Save & Continue'}
        >
          <Check className="w-3.5 h-3.5" />
          <span>{isRtl ? 'حفظ ومتابعة' : 'حفظ ومتابعة'}</span>
        </button>
      </div>
    </div>
  );
};
