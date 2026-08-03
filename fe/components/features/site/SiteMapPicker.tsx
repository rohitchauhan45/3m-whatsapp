'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, type Libraries } from '@react-google-maps/api';
import { Loader2, MapPin } from 'lucide-react';
import LocationSearch from '@/components/features/site/LocationSearch';

export const SITE_MAP_HEIGHT_PX = 560;

const MAP_CONTAINER_STYLE: React.CSSProperties = {
  width: '100%',
  height: `${SITE_MAP_HEIGHT_PX}px`,
  minHeight: `${SITE_MAP_HEIGHT_PX}px`,
};
const MAP_LIBRARIES: Libraries = ['marker'];
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID';

type MapPosition = { lat: number; lng: number };

type SiteMapPickerProps = Readonly<{
  position: MapPosition | null;
  onPositionChange: (position: MapPosition, addressFromPlace?: string) => void;
  resolvingAddress?: boolean;
}>;

function readMarkerPosition(
  value: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined,
): MapPosition | null {
  if (!value) return null;
  if (typeof (value as google.maps.LatLng).lat === 'function') {
    const latLng = value as google.maps.LatLng;
    return { lat: latLng.lat(), lng: latLng.lng() };
  }
  const literal = value as google.maps.LatLngLiteral;
  if (typeof literal.lat === 'number' && typeof literal.lng === 'number') {
    return { lat: literal.lat, lng: literal.lng };
  }
  return null;
}

export default function SiteMapPicker({
  position,
  onPositionChange,
  resolvingAddress = false,
}: SiteMapPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'site-map-script',
    googleMapsApiKey: apiKey,
    libraries: MAP_LIBRARIES,
    version: 'weekly',
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [markerError, setMarkerError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      const lat = event.latLng?.lat();
      const lng = event.latLng?.lng();
      if (lat == null || lng == null) return;
      setSearchError(null);
      onPositionChange({ lat, lng });
    },
    [onPositionChange],
  );

  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      setMapInstance(map);
      setMapReady(true);
      setMarkerError(null);

      if (position) {
        map.panTo(position);
      }

      window.setTimeout(() => {
        google.maps.event.trigger(map, 'resize');
        if (position) map.panTo(position);
      }, 0);
    },
    [position],
  );

  const handleMapUnmount = useCallback(() => {
    mapRef.current = null;
    setMapInstance(null);
    setMapReady(false);
    if (markerRef.current) {
      markerRef.current.map = null;
      markerRef.current = null;
    }
  }, []);

  const handleLocationSelect = useCallback(
    (next: MapPosition, address: string) => {
      setSearchError(null);
      onPositionChange(next, address || undefined);
    },
    [onPositionChange],
  );

  const handleSearchError = useCallback((message: string) => {
    setSearchError(message);
  }, []);

  useEffect(() => {
    if (!position || !mapRef.current) return;
    mapRef.current.panTo(position);
  }, [position]);

  useEffect(() => {
    if (!isLoaded || !mapReady || !mapRef.current || !position) return;

    let cancelled = false;

    async function syncAdvancedMarker() {
      try {
        const { AdvancedMarkerElement } = (await google.maps.importLibrary(
          'marker',
        )) as google.maps.MarkerLibrary;

        if (cancelled || !mapRef.current || !position) return;

        if (!markerRef.current) {
          const marker = new AdvancedMarkerElement({
            map: mapRef.current,
            position,
            gmpDraggable: true,
          });

          marker.addListener('dragend', () => {
            const next = readMarkerPosition(marker.position);
            if (next) onPositionChange(next);
          });

          markerRef.current = marker;
          setMarkerError(null);
          return;
        }

        markerRef.current.map = mapRef.current;
        markerRef.current.position = position;
      } catch (error) {
        console.error('Advanced marker failed to load', error);
        setMarkerError('Map marker could not be loaded. Check Maps JavaScript API and Map Tiles API.');
      }
    }

    syncAdvancedMarker();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, mapReady, position, onPositionChange]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
  }, []);

  if (!apiKey) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 px-6 text-center"
        style={{ height: SITE_MAP_HEIGHT_PX }}
      >
        <div className="max-w-md space-y-2">
          <MapPin className="mx-auto text-gray-400" size={32} />
          <p className="text-sm font-medium text-gray-800">Google Maps API key is missing</p>
          <p className="text-sm text-gray-500">
            Add <code className="text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to{' '}
            <code className="text-xs">fe/.env</code> and restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-red-100 bg-red-50 px-6 text-center text-sm text-red-700"
        style={{ height: SITE_MAP_HEIGHT_PX }}
      >
        Could not load Google Maps script. Check your API key, billing, and HTTP referrer restrictions
        for <code className="text-xs">http://localhost:4005/*</code>.
      </div>
    );
  }

  if (!isLoaded || !position) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-gray-200 bg-gray-50"
        style={{ height: SITE_MAP_HEIGHT_PX }}
      >
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl border border-gray-200 bg-gray-100"
      style={{ height: SITE_MAP_HEIGHT_PX }}
    >
      {mapInstance && (
        <div className="absolute left-4 right-4 top-4 z-[1000] overflow-visible">
          <LocationSearch
            map={mapInstance}
            onLocationSelect={handleLocationSelect}
            onError={handleSearchError}
          />
          {searchError && (
            <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">
              {searchError}
            </p>
          )}
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={position}
          zoom={16}
          onClick={handleMapClick}
          onLoad={handleMapLoad}
          onUnmount={handleMapUnmount}
          options={{
            mapId: MAP_ID,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        />
      </div>

      {resolvingAddress && (
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-gray-100 bg-white/95 px-3 py-2 text-sm text-gray-600 shadow-sm">
          <Loader2 size={16} className="animate-spin text-brand-primary" />
          Resolving address…
        </div>
      )}
      {markerError && (
        <div className="absolute bottom-4 left-4 right-4 z-10 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {markerError}
        </div>
      )}
    </div>
  );
}
