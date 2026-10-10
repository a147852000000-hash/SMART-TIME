import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Crosshair, Route, Loader2, Layers, Maximize2, PlusCircle, ExternalLink } from 'lucide-react';
import { TripLocation } from './types';
import { apiUrl } from '../../services/apiConfig';

interface TripsMapProps {
  pickup: TripLocation | null;
  dropoff: TripLocation | null;
  stops?: TripLocation[];
  onSelectPickup?: () => void;
  onSelectDropoff?: () => void;
  onAddStop?: () => void;
  onSetPickup?: (location: TripLocation) => void;
  onSetDropoff?: (location: TripLocation) => void;
  onSetStop?: (location: TripLocation) => void;
  onEditStop?: (index: number) => void;
  onRemoveStop?: (index: number) => void;
  onCurrentLocation?: (location: TripLocation) => void;
  onOpenGoogleMaps?: () => void;
  onRouteCalculated?: (info: { distanceKm: number; durationMins: number }) => void;
  language?: 'ar' | 'en';
}

const pickupIcon = L.divIcon({
  className: 'smart-trip-marker',
  html: '<div class="smart-trip-marker-pin smart-trip-marker-pickup">📍</div>',
  iconSize: [42, 42],
  iconAnchor: [21, 38],
});

const dropoffIcon = L.divIcon({
  className: 'smart-trip-marker',
  html: '<div class="smart-trip-marker-pin smart-trip-marker-dropoff">🏁</div>',
  iconSize: [42, 42],
  iconAnchor: [21, 38],
});

const createStopIcon = (index: number) =>
  L.divIcon({
    className: 'smart-trip-marker',
    html: `<div style="transform: rotate(-45deg); width: 38px; height: 38px; border-radius: 50% 50% 50% 0; background: #f59e0b; border: 3px solid #fff; box-shadow: 0 5px 14px rgba(15,23,42,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px;"><span style="transform: rotate(45deg); font-weight: 900; color: #ffffff;">${index + 1}</span></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 34],
  });

export const TripsMap: React.FC<TripsMapProps> = ({
  pickup,
  dropoff,
  stops = [],
  onSelectPickup,
  onSelectDropoff,
  onAddStop,
  onSetPickup,
  onSetDropoff,
  onSetStop,
  onEditStop,
  onRemoveStop,
  onCurrentLocation,
  onOpenGoogleMaps,
  onRouteCalculated,
  language = 'ar',
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.Polyline | null>(null);
  const clickPopupRef = useRef<L.Popup | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [mapMode, setMapMode] = useState<'street' | 'satellite' | 'terrain'>('street');
  const [modeOpen, setModeOpen] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm?: number; durationMins?: number } | null>(null);
  const isRtl = language === 'ar';
  const maptilerKey = import.meta.env.VITE_MAPTILER_API_KEY || '';
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userLocationMarkerRef = useRef<L.CircleMarker | null>(null);

  const handlersRef = useRef({ onSetPickup, onSetDropoff, onSetStop, onEditStop, onRemoveStop, isRtl });
  handlersRef.current = { onSetPickup, onSetDropoff, onSetStop, onEditStop, onRemoveStop, isRtl };

  const center = useMemo<[number, number]>(
    () => [pickup?.latitude || 30.0444, pickup?.longitude || 31.2357],
    [pickup?.latitude, pickup?.longitude]
  );

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView(center, 12);

    const tileUrl = maptilerKey
      ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 20,
      attribution: maptilerKey
        ? '&copy; MapTiler &copy; OpenStreetMap contributors'
        : '&copy; OpenStreetMap contributors',
    }).addTo(map);

    markers.current = L.layerGroup().addTo(map);
    leafletMap.current = map;

    // Interactive map click for setting pickup / stop / dropoff
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      const container = document.createElement('div');
      container.dir = handlersRef.current.isRtl ? 'rtl' : 'ltr';
      container.style.padding = '6px';
      container.style.minWidth = '190px';
      container.style.fontFamily = 'inherit';

      const titleEl = document.createElement('div');
      titleEl.style.fontSize = '12px';
      titleEl.style.fontWeight = '800';
      titleEl.style.color = '#0f172a';
      titleEl.style.marginBottom = '10px';
      titleEl.style.lineHeight = '1.4';
      titleEl.textContent = `📍 ${address}`;
      container.appendChild(titleEl);

      const btnGroup = document.createElement('div');
      btnGroup.style.display = 'flex';
      btnGroup.style.flexDirection = 'column';
      btnGroup.style.gap = '6px';

      // 1. Pickup button
      const pickupBtn = document.createElement('button');
      pickupBtn.style.cssText =
        'background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 10px; font-weight: 900; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(16,185,129,0.25);';
      pickupBtn.innerHTML = `<span>📍</span> <span>${
        handlersRef.current.isRtl ? 'تعيين كنقطة انطلاق' : 'Set as Pickup'
      }</span>`;
      pickupBtn.onclick = () => {
        handlersRef.current.onSetPickup?.({
          address: titleEl.dataset.resolvedAddress || address,
          name: handlersRef.current.isRtl ? 'نقطة الانطلاق' : 'Pickup',
          latitude: lat,
          longitude: lng,
        });
        map.closePopup();
      };
      btnGroup.appendChild(pickupBtn);

      // 2. Stop button
      const stopBtn = document.createElement('button');
      stopBtn.style.cssText =
        'background: #f59e0b; color: white; border: none; padding: 8px 12px; border-radius: 10px; font-weight: 900; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(245,158,11,0.25);';
      stopBtn.innerHTML = `<span>🛑</span> <span>${
        handlersRef.current.isRtl ? 'إضافة كنقطة توقف' : 'Add as Stop'
      }</span>`;
      stopBtn.onclick = () => {
        handlersRef.current.onSetStop?.({
          address: titleEl.dataset.resolvedAddress || address,
          name: handlersRef.current.isRtl ? 'نقطة توقف' : 'Stop',
          latitude: lat,
          longitude: lng,
        });
        map.closePopup();
      };
      btnGroup.appendChild(stopBtn);

      // 3. Dropoff button
      const dropoffBtn = document.createElement('button');
      dropoffBtn.style.cssText =
        'background: #f43f5e; color: white; border: none; padding: 8px 12px; border-radius: 10px; font-weight: 900; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(244,63,94,0.25);';
      dropoffBtn.innerHTML = `<span>🏁</span> <span>${
        handlersRef.current.isRtl ? 'تعيين كنقطة وصول' : 'Set as Destination'
      }</span>`;
      dropoffBtn.onclick = () => {
        handlersRef.current.onSetDropoff?.({
          address: titleEl.dataset.resolvedAddress || address,
          name: handlersRef.current.isRtl ? 'نقطة النزول' : 'Destination',
          latitude: lat,
          longitude: lng,
        });
        map.closePopup();
      };
      btnGroup.appendChild(dropoffBtn);

      container.appendChild(btnGroup);

      const popup = L.popup({ offset: [0, -10] })
        .setLatLng([lat, lng])
        .setContent(container)
        .openOn(map);

      clickPopupRef.current = popup;

      // Async reverse geocode to refine address
      try {
        const r = await fetch(apiUrl(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`));
        const d = await r.json();
        if (d && d.address) {
          titleEl.textContent = `📍 ${d.address}`;
          titleEl.dataset.resolvedAddress = d.address;
        }
      } catch {
        /* fallback to coordinates */
      }
    });

    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      userLocationMarkerRef.current?.remove();
      map.remove();
      leafletMap.current = null;
      markers.current = null;
      tileLayerRef.current = null;
      userLocationMarkerRef.current = null;
    };
  }, []);

  // Update Markers when pickup, dropoff, or stops change
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !markers.current) return;
    markers.current.clearLayers();

    const points: L.LatLngExpression[] = [];

    if (pickup) {
      L.marker([pickup.latitude, pickup.longitude], { icon: pickupIcon })
        .bindTooltip(pickup.address || (isRtl ? 'نقطة الانطلاق' : 'Pickup'), { direction: 'top' })
        .addTo(markers.current);
      points.push([pickup.latitude, pickup.longitude]);
    }

    stops.forEach((stop, idx) => {
      const stopMarker = L.marker([stop.latitude, stop.longitude], { icon: createStopIcon(idx) })
        .bindTooltip(`${isRtl ? 'نقطة توقف' : 'Stop'} ${idx + 1}: ${stop.address || stop.name || ''}`, {
          direction: 'top',
        })
        .addTo(markers.current!);

      // Popup for editing or removing the stop directly on map
      const popupDiv = document.createElement('div');
      popupDiv.dir = isRtl ? 'rtl' : 'ltr';
      popupDiv.style.cssText =
        'font-family: inherit; font-size: 12px; padding: 4px; min-width: 190px; text-align: start;';

      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-weight: 900; margin-bottom: 6px; color: #b45309; font-size: 12px;';
      titleEl.innerHTML = `🛑 <strong>${isRtl ? 'نقطة توقف' : 'Stop'} ${idx + 1}</strong>: <span style="color:#0f172a; font-weight:600; display:block; margin-top:2px; font-size:11px;">${
        stop.address || stop.name || ''
      }</span>`;
      popupDiv.appendChild(titleEl);

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display: flex; gap: 6px; margin-top: 6px;';

      const editBtn = document.createElement('button');
      editBtn.style.cssText =
        'flex: 1; background: #0284c7; color: white; border: none; padding: 6px 10px; border-radius: 8px; font-weight: 900; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 2px 6px rgba(2,132,199,0.3);';
      editBtn.innerHTML = `<span>✏️</span> <span>${isRtl ? 'تعديل' : 'Edit'}</span>`;
      editBtn.onclick = () => {
        handlersRef.current.onEditStop?.(idx);
        map.closePopup();
      };
      btnRow.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.style.cssText =
        'flex: 1; background: #f43f5e; color: white; border: none; padding: 6px 10px; border-radius: 8px; font-weight: 900; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 2px 6px rgba(244,63,94,0.3);';
      delBtn.innerHTML = `<span>🗑️</span> <span>${isRtl ? 'حذف' : 'Delete'}</span>`;
      delBtn.onclick = () => {
        handlersRef.current.onRemoveStop?.(idx);
        map.closePopup();
      };
      btnRow.appendChild(delBtn);

      popupDiv.appendChild(btnRow);
      stopMarker.bindPopup(popupDiv, { offset: [0, -10] });

      points.push([stop.latitude, stop.longitude]);
    });

    if (dropoff) {
      L.marker([dropoff.latitude, dropoff.longitude], { icon: dropoffIcon })
        .bindTooltip(dropoff.address || (isRtl ? 'نقطة الوصول' : 'Destination'), { direction: 'top' })
        .addTo(markers.current);
      points.push([dropoff.latitude, dropoff.longitude]);
    }

    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [pickup, dropoff, stops, isRtl]);

  // Calculate & draw route through Pickup -> Stops -> Dropoff
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    routeLayer.current?.remove();
    routeLayer.current = null;
    setRouteInfo(null);

    if (!pickup || !dropoff) return;

    const routeLegs: Array<{ from: TripLocation; to: TripLocation }> = [];
    const allPoints = [pickup, ...stops, dropoff];

    for (let i = 0; i < allPoints.length - 1; i++) {
      routeLegs.push({ from: allPoints[i], to: allPoints[i + 1] });
    }

    let cancelled = false;
    setRouteLoading(true);

    const fetchLegs = async () => {
      try {
        let combinedCoords: [number, number][] = [];
        let totalDistanceKm = 0;
        let totalDurationMins = 0;

        for (const leg of routeLegs) {
          const res = await fetch(
            apiUrl(`/api/maps/route?from=${leg.from.latitude},${leg.from.longitude}&to=${leg.to.latitude},${leg.to.longitude}`)
          );
          if (!res.ok) throw new Error('Leg routing failed');
          const data = await res.json();
          if (data.coordinates?.length) {
            combinedCoords = [...combinedCoords, ...(data.coordinates as [number, number][])];
            totalDistanceKm += Number(data.distanceKm || 0);
            totalDurationMins += Number(data.durationMins || 0);
          }
        }

        if (cancelled || !combinedCoords.length) return;

        const line = L.polyline(combinedCoords, {
          color: '#08a7d8',
          weight: 6,
          opacity: 0.88,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        routeLayer.current = line;
        map.fitBounds(line.getBounds(), { padding: [45, 45] });
        const dist = Math.round(totalDistanceKm * 10) / 10;
        const dur = Math.round(totalDurationMins);
        setRouteInfo({
          distanceKm: dist,
          durationMins: dur,
        });
        onRouteCalculated?.({ distanceKm: dist, durationMins: dur });
      } catch {
        if (!cancelled) {
          // Fallback straight line
          const fallbackCoords = allPoints.map((p) => [p.latitude, p.longitude] as [number, number]);
          const line = L.polyline(fallbackCoords, {
            color: '#08a7d8',
            dashArray: '8, 8',
            weight: 4,
            opacity: 0.7,
          }).addTo(map);
          routeLayer.current = line;
        }
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    };

    fetchLegs();

    return () => {
      cancelled = true;
    };
  }, [pickup?.latitude, pickup?.longitude, dropoff?.latitude, dropoff?.longitude, stops]);

  const changeMapMode = (mode: 'street' | 'satellite' | 'terrain') => {
    const map = leafletMap.current;
    if (!map) return;
    tileLayerRef.current?.remove();
    const urls: Record<typeof mode, string> = maptilerKey
      ? {
          street: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`,
          satellite: `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${maptilerKey}`,
          terrain: `https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${maptilerKey}`,
        }
      : {
          street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          satellite: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
          terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        };
    tileLayerRef.current = L.tileLayer(urls[mode], {
      maxZoom: 20,
      attribution: maptilerKey
        ? '&copy; MapTiler &copy; OpenStreetMap contributors'
        : '&copy; OpenStreetMap contributors',
    }).addTo(map);
    setMapMode(mode);
    setModeOpen(false);
  };

  const fullscreen = () => {
    const el = mapRef.current?.parentElement;
    if (el && document.fullscreenEnabled && !document.fullscreenElement) el.requestFullscreen?.();
    else if (document.fullscreenElement) document.exitFullscreen?.();
  };

  const locateMe = () => {
    const map = leafletMap.current;
    if (!map) return;
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      window.alert(
        isRtl
          ? 'زر موقعي يحتاج اتصال HTTPS. افتح التطبيق عبر HTTPS أو جرّبه على localhost.'
          : 'My location requires HTTPS. Open the app over HTTPS or test it on localhost.'
      );
      return;
    }
    if (!navigator.geolocation) {
      window.alert(
        isRtl ? 'الموقع الجغرافي غير متاح في هذا المتصفح.' : 'Geolocation is not available in this browser.'
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        const latLng: [number, number] = [latitude, longitude];
        map.setView(latLng, 16, { animate: true });
        userLocationMarkerRef.current?.remove();
        userLocationMarkerRef.current = L.circleMarker(latLng, {
          radius: 8,
          color: '#0ea5e9',
          weight: 3,
          fillColor: '#38bdf8',
          fillOpacity: 0.85,
        })
          .bindTooltip(isRtl ? 'موقعي الحالي' : 'My location', { direction: 'top' })
          .addTo(map)
          .openTooltip();

        let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        try {
          const response = await fetch(apiUrl(`/api/maps/reverse-geocode?lat=${latitude}&lng=${longitude}`));
          const data = await response.json();
          if (response.ok && data?.address) address = String(data.address);
        } catch {
          /* coordinates fallback */
        }

        onCurrentLocation?.({
          address,
          name: isRtl ? 'موقعي الحالي' : 'My current location',
          latitude,
          longitude,
        });
      },
      (error) => {
        const message =
          error?.code === 1
            ? isRtl
              ? 'اسمح للمتصفح بالوصول إلى موقعك، ثم اضغط «موقعي» مرة أخرى.'
              : 'Allow browser location access, then tap My location again.'
            : isRtl
            ? 'تعذر تحديد موقعك الحالي. تأكد من تشغيل الموقع على الهاتف.'
            : 'Unable to determine your current location. Make sure location is enabled.';
        window.alert(message);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  return (
    <section className="smart-trips-map-card" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="smart-trips-map-head">
        <div className="flex items-center gap-3">
          <div className="smart-trips-map-icon">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2>{isRtl ? 'خريطة الرحلة' : 'Trip Map'}</h2>
            <p>
              {stops.length > 0
                ? isRtl
                  ? `المسار يمر عبر ${stops.length} نقطة توقف إضافية`
                  : `Route includes ${stops.length} stop point(s)`
                : isRtl
                ? 'خريطة تفاعلية لتحديد المسار ومحطات التوقف بدقة'
                : 'Interactive map for routing and stops'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenGoogleMaps && (
            <button
              type="button"
              onClick={onOpenGoogleMaps}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition-transform active:scale-95"
              title={isRtl ? 'فتح في تطبيق Google Maps GPS' : 'Open in Google Maps GPS'}
            >
              <span className="text-sm">🧭</span>
              <span>Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>
          )}

          <span className="smart-map-live">
            <span /> {maptilerKey ? 'MapTiler Live' : 'OpenStreetMap Live'}
          </span>
        </div>
      </div>

      <div className="smart-map-canvas-wrap">
        <div ref={mapRef} className="smart-map-canvas" />

        {/* Top Floating Controls */}
        <div className="smart-map-top-controls smart-map-top-controls-clean">
          <button
            onClick={() => setModeOpen((v) => !v)}
            className="smart-map-tool"
            title={isRtl ? 'أوضاع الخريطة' : 'Map Layers'}
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={fullscreen}
            className="smart-map-tool"
            title={isRtl ? 'ملء الشاشة' : 'Fullscreen'}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {onAddStop && (
            <button
              onClick={onAddStop}
              className="smart-map-tool !bg-amber-500 hover:!bg-amber-600 !text-white"
              title={isRtl ? 'إضافة نقطة توقف' : 'Add Stop'}
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {modeOpen && (
          <div className="smart-map-mode-menu">
            <button className={mapMode === 'street' ? 'active' : ''} onClick={() => changeMapMode('street')}>
              {isRtl ? 'الخريطة' : 'Street'}
            </button>
            <button className={mapMode === 'satellite' ? 'active' : ''} onClick={() => changeMapMode('satellite')}>
              {isRtl ? 'القمر الصناعي' : 'Satellite'}
            </button>
            <button className={mapMode === 'terrain' ? 'active' : ''} onClick={() => changeMapMode('terrain')}>
              {isRtl ? 'التضاريس' : 'Terrain'}
            </button>
          </div>
        )}

        <button
          onClick={locateMe}
          className="smart-map-locate"
          title={isRtl ? 'موقعي الحالي' : 'My location'}
          aria-label={isRtl ? 'العودة إلى موقعي الحالي' : 'Center on my location'}
        >
          <Crosshair className="w-4 h-4" />
          <span>{isRtl ? 'موقعي' : 'My location'}</span>
        </button>

        {routeLoading && (
          <div className="smart-map-status">
            <Loader2 className="w-4 h-4 animate-spin" /> {isRtl ? 'جاري رسم المسار...' : 'Drawing route...'}
          </div>
        )}

        {routeInfo && (
          <div className="smart-map-route-info">
            <Route className="w-4 h-4" /> {Number(routeInfo.distanceKm || 0).toFixed(1)} كم ·{' '}
            {Math.round(Number(routeInfo.durationMins || 0))} دقيقة
            {stops.length > 0 && (
              <span className="mr-1 bg-amber-400/30 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-black">
                ({stops.length} {isRtl ? 'محطات' : 'stops'})
              </span>
            )}
          </div>
        )}

        {!pickup && !dropoff && (
          <div className="smart-map-empty">
            <MapPin className="w-8 h-8" />
            <b>{isRtl ? 'حدد نقطتي الانطلاق والوصول' : 'Choose pickup and destination'}</b>
          </div>
        )}
      </div>
    </section>
  );
};
