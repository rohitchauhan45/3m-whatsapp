'use client';

import { useEffect, useRef } from 'react';

type MapPosition = { lat: number; lng: number };

type LocationSearchProps = Readonly<{
  map: google.maps.Map;
  onLocationSelect: (position: MapPosition, address: string) => void;
  onError?: (message: string) => void;
}>;

export default function LocationSearch({
  map,
  onLocationSelect,
  onError,
}: LocationSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onLocationSelect);
  const onErrorRef = useRef(onError);

  onSelectRef.current = onLocationSelect;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!containerRef.current) return;

    let autocompleteElement: google.maps.places.PlaceAutocompleteElement | null = null;
    let cancelled = false;

    async function init() {
      const { PlaceAutocompleteElement } = (await google.maps.importLibrary(
        'places',
      )) as google.maps.PlacesLibrary;

      if (cancelled || !containerRef.current) return;

      const center = map.getCenter();
      autocompleteElement = new PlaceAutocompleteElement({
        placeholder: 'Search location name or address',
        requestedRegion: 'in',
        includedRegionCodes: ['in'],
        locationBias: center ?? undefined,
        origin: center ?? undefined,
      });

      autocompleteElement.style.width = '100%';
      autocompleteElement.style.colorScheme = 'light';

      containerRef.current.replaceChildren(autocompleteElement);

      autocompleteElement.addEventListener('gmp-select', async (event) => {
        const placeEvent = event as google.maps.places.PlacePredictionSelectEvent;

        try {
          const place = placeEvent.placePrediction.toPlace();
          await place.fetchFields({
            fields: ['location', 'formattedAddress', 'displayName'],
          });

          if (!place.location) {
            onErrorRef.current?.(
              'No location found for that search. Try a different place name.',
            );
            return;
          }

          const lat = place.location.lat();
          const lng = place.location.lng();
          const address =
            place.formattedAddress?.trim() || place.displayName?.trim() || '';

          map.setCenter(place.location);
          map.setZoom(17);

          onSelectRef.current({ lat, lng }, address);
        } catch (error) {
          console.error('Place select failed', error);
          onErrorRef.current?.('Could not load place details. Please try again.');
        }
      });
    }

    init().catch((error) => {
      console.error('PlaceAutocompleteElement init failed', error);
      onErrorRef.current?.(
        'Place search could not be loaded. Enable Places API (New) on your Google Cloud API key.',
      );
    });

    return () => {
      cancelled = true;
      if (autocompleteElement) {
        autocompleteElement.remove();
        autocompleteElement = null;
      }
    };
  }, [map]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl border border-gray-200 bg-white shadow-lg [&_gmp-place-autocomplete]:w-full [&_gmp-place-autocomplete]:bg-white"
    />
  );
}
