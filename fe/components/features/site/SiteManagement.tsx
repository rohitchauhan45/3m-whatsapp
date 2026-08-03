'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Crosshair, Loader2, MapPin, MoreVertical, Plus } from 'lucide-react';
import SiteMapPicker, { SITE_MAP_HEIGHT_PX } from '@/components/features/site/SiteMapPicker';
import { useToast } from '@/lib/providers/toast-provider';
import { usePageHeader } from '@/lib/utils/page-header-context';
import { ui } from '@/lib/utils/ui-classes';
import {
  createSite,
  fetchSites,
  formatSiteApiError,
  geocodeSiteLocation,
  type Site,
} from '@/lib/services/siteService';
import { cachedQueryOptions } from '@/lib/query-config';
import { queryKeys } from '@/lib/query-keys';

type ViewMode = 'list' | 'create';

type MapPosition = { lat: number; lng: number };

const DEFAULT_CENTER: MapPosition = { lat: 20.5937, lng: 78.9629 };
const ADDRESS_MAX_CHARS_PER_LINE = 35;
const ADDRESS_MAX_LINES = 3;

function wrapWordsByLength(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);

    if (word.length > maxChars) {
      lines.push(`${word.slice(0, maxChars - 1)}…`);
      current = '';
    } else {
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function formatAddressDisplayLines(
  address: string,
  maxCharsPerLine = ADDRESS_MAX_CHARS_PER_LINE,
  maxLines = ADDRESS_MAX_LINES,
): string[] {
  const trimmed = address.trim();
  if (!trimmed) return [];

  const segments = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  const builtLines: string[] = [];
  let currentLine = '';

  const appendSegment = (segment: string) => {
    const candidate = currentLine ? `${currentLine}, ${segment}` : segment;

    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
      return;
    }

    if (currentLine) {
      builtLines.push(currentLine);
      currentLine = '';
    }

    if (segment.length <= maxCharsPerLine) {
      currentLine = segment;
      return;
    }

    const wrapped = wrapWordsByLength(segment, maxCharsPerLine);
    if (wrapped.length === 0) return;

    builtLines.push(...wrapped.slice(0, -1));
    currentLine = wrapped[wrapped.length - 1] ?? '';
  };

  if (segments.length === 0) {
    builtLines.push(...wrapWordsByLength(trimmed, maxCharsPerLine));
  } else {
    for (const segment of segments) {
      appendSegment(segment);
    }
    if (currentLine) builtLines.push(currentLine);
  }

  if (builtLines.length <= maxLines) {
    return builtLines;
  }

  const visible = builtLines.slice(0, maxLines);
  const lastIndex = visible.length - 1;
  const lastLine = visible[lastIndex];

  if (lastLine.endsWith('…')) {
    return visible;
  }

  visible[lastIndex] =
    lastLine.length >= maxCharsPerLine
      ? `${lastLine.slice(0, maxCharsPerLine - 1)}…`
      : `${lastLine}…`;

  return visible;
}

function formatSiteCreatedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSiteStatusLabel(status: string): string {
  if (status === 'active') return 'Active';
  if (status === 'inactive') return 'Inactive';
  if (status === 'deleted') return 'Deleted';
  return status;
}

function SiteCard({ site }: Readonly<{ site: Site }>) {
  const addressLines = formatAddressDisplayLines(site.address);

  return (
    <Link
      href={`/sites/${site.id}`}
      className="block rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-gray-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-500">
            <Building2 size={23} className="text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[20px] font-semibold text-slate-700 leading-tight">{site.name}</h3>
            <p className="text-sm text-gray-500">{formatSiteStatusLabel(site.status)}</p>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
          aria-label="Site options"
          onClick={(e) => e.preventDefault()}
        >
          <MoreVertical size={18} />
        </button>
      </div>

      <div className="space-y-4 border-t border-gray-100 px-7 py-4">
        <div className="flex items-start gap-3">
          <MapPin size={21} className="mt-0.5 shrink-0 text-blue-500" strokeWidth={2} />
          <div className="min-w-0 space-y-0.5">
            {addressLines.map((line, index) => (
              <p
                key={`${site.id}-address-${index}`}
                className="text-[15px] leading-relax text-gray-700"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Crosshair size={17} className="shrink-0 text-blue-500" strokeWidth={2} />
          <p className="text-[14px] tabular-nums text-gray-600">
            {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}
          </p>
        </div>
      </div>

      <div className="border-t border-gray-100 px-6 py-3">
        <p className="text-[13px] text-gray-500">Created : {formatSiteCreatedDate(site.createdAt)}</p>
      </div>
    </Link>
  );
}

export default function SiteManagement() {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const { setBreadcrumb, setOnBack } = usePageHeader();
  const [view, setView] = useState<ViewMode>('list');
  const [siteName, setSiteName] = useState('');
  const [position, setPosition] = useState<MapPosition | null>(null);
  const [address, setAddress] = useState('');
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'loading' | 'ready' | 'denied' | 'error'
  >('idle');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const geocodeRequestId = useRef(0);

  const sitesQuery = useQuery({
    queryKey: queryKeys.sites,
    queryFn: fetchSites,
    ...cachedQueryOptions,
  });

  const sites = sitesQuery.data?.data ?? [];

  useEffect(() => {
    if (view === 'create') {
      setBreadcrumb('Site / Add Site');
      setOnBack(() => setView('list'));
    } else {
      setBreadcrumb('Site');
      setOnBack(null);
    }
    return () => {
      setOnBack(null);
    };
  }, [view, setBreadcrumb, setOnBack]);

  const resolveAddress = useCallback(async (lat: number, lng: number) => {
    const requestId = geocodeRequestId.current + 1;
    geocodeRequestId.current = requestId;

    const result = await geocodeSiteLocation(lat, lng);
    if (geocodeRequestId.current !== requestId) return;

    if (!result.success || !result.data?.address) {
      setAddress('');
      showError(result.message || 'Could not resolve address for this point');
      return;
    }

    setAddress(result.data.address);
  }, [showError]);

  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationMessage('Location is not supported in this browser.');
      setPosition(DEFAULT_CENTER);
      resolveAddress(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
      return;
    }

    setLocationStatus('loading');
    setLocationMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(next);
        setLocationStatus('ready');
        resolveAddress(next.lat, next.lng);
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        setLocationStatus(denied ? 'denied' : 'error');
        setLocationMessage(
          denied
            ? 'Location permission was denied. You can still tap the map to pick a site location.'
            : 'Could not read your location. Tap the map to pick a site location.',
        );
        setPosition(DEFAULT_CENTER);
        resolveAddress(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [resolveAddress]);

  useEffect(() => {
    if (view !== 'create') return;
    setSiteName('');
    setAddress('');
    setPosition(null);
    setLocationStatus('idle');
    setLocationMessage(null);
    requestUserLocation();
  }, [view, requestUserLocation]);

  const handlePositionChange = useCallback(
    (next: MapPosition, addressFromPlace?: string) => {
      setPosition(next);
      if (addressFromPlace?.trim()) {
        setAddress(addressFromPlace.trim());
        return;
      }
      resolveAddress(next.lat, next.lng);
    },
    [resolveAddress],
  );

  const createMutation = useMutation({
    mutationFn: createSite,
    onSuccess: (res) => {
      if (!res.success) {
        showError(res.message || 'Failed to create site');
        return;
      }
      showToast(res.message || 'Site created', 'success');
      queryClient.invalidateQueries({ queryKey: queryKeys.sites });
      setView('list');
    },
    onError: (error) => showError(formatSiteApiError(error, 'Failed to create site')),
  });

  const openCreate = () => setView('create');

  const handleCreate = () => {
    const name = siteName.trim();
    if (!name) {
      showError('Site name is required');
      return;
    }
    if (!position) {
      showError('Please select a location on the map');
      return;
    }
    if (!address.trim()) {
      showError('Address could not be resolved. Try moving the marker or pick another point.');
      return;
    }

    createMutation.mutate({
      name,
      address: address.trim(),
      latitude: position.lat,
      longitude: position.lng,
    });
  };

  if (view === 'create') {
    return (
      <div className="animate-fade-in flex flex-col min-h-[calc(100dvh-12rem)]">
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <label htmlFor="site-name" className="mb-2 block text-sm font-medium text-gray-700">
            Site name
          </label>
          <input
            id="site-name"
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="e.g. Main warehouse"
            className={ui.inputEditable}
            autoComplete="off"
          />
          {address && (
            <p className="mt-3 text-sm text-gray-500">
              <span className="font-medium text-gray-700">Address: </span>
              {address}
            </p>
          )}
          {locationMessage && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {locationMessage}
            </p>
          )}
        </div>

        <div className="relative shrink-0" style={{ height: SITE_MAP_HEIGHT_PX }}>
          <SiteMapPicker
            position={position}
            onPositionChange={handlePositionChange}
            resolvingAddress={locationStatus === 'loading' && !!position}
          />
          {locationStatus === 'loading' && !position && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 size={18} className="animate-spin" />
                Requesting location permission…
              </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-30">
          <button
            type="button"
            onClick={handleCreate}
            disabled={createMutation.isPending || !siteName.trim() || !position || !address.trim()}
            className={ui.btnPrimaryLg}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating…
              </>
            ) : (
              'Create'
            )}
          </button>
        </div>
      </div>
    );
  }

  const isLoading = sitesQuery.isLoading;
  const isEmpty = !isLoading && sites.length === 0;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-end mb-5">
        <button type="button" onClick={openCreate} className={ui.btnPrimary}>
          <Plus size={16} />
          Add Site
        </button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[480px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/50">
          <Loader2 className="animate-spin text-gray-400" size={28} />
        </div>
      ) : isEmpty ? (
        <div
          className="flex min-h-[520px] w-full items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/40 px-8 py-16"
        >
          <div className="text-center max-w-md">
            <MapPin className="mx-auto mb-4 text-gray-300" size={40} strokeWidth={1.5} />
            <p className="text-lg font-medium text-gray-700">No site yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Please create a site first so you can assign locations for your team.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </div>
  );
}
