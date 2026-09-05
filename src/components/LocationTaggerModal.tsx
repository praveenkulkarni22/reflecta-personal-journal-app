import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Search, 
  Crosshair, 
  X, 
  Check, 
  Compass, 
  ExternalLink, 
  Key, 
  Navigation,
  Globe,
  Sparkles
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { JournalLocation } from '../types';
import { useTheme } from '../context/ThemeContext';
import { getCurrentUserToken } from '../lib/firebase';

interface LocationTaggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (location: JournalLocation) => void;
  currentLocation?: JournalLocation;
}

// Preset sanctuary spots for rapid mindful journaling
const SANCTUARY_PRESETS: { name: string; address: string; lat: number; lng: number }[] = [
  { name: 'Kyoto Zen Gardens', address: 'Kyoto, Japan', lat: 35.0116, lng: 135.7681 },
  { name: 'Big Sur Pacific Coast', address: 'Highway 1, Big Sur, CA, USA', lat: 36.2704, lng: -121.8081 },
  { name: 'Central Park Conservatory', address: 'New York, NY, USA', lat: 40.7937, lng: -73.9521 },
  { name: 'Swiss Alpine Valley', address: 'Lauterbrunnen, Switzerland', lat: 46.5935, lng: 7.9090 },
  { name: 'Home Writing Sanctuary', address: 'Quiet Study / Personal Haven', lat: 37.7749, lng: -122.4194 },
  { name: 'Reykjavik Nordic Haven', address: 'Reykjavik, Iceland', lat: 64.1466, lng: -21.9426 }
];

export const LocationTaggerModal: React.FC<LocationTaggerModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
  currentLocation
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('reflecta_maps_api_key') || '' : '';
  const defaultApiKey = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) || storedKey || '';
  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [showKeyConfig, setShowKeyConfig] = useState(!defaultApiKey);

  // Fetch API key dynamically from server secrets if not populated yet
  useEffect(() => {
    const fetchServerKey = async () => {
      try {
        const token = await getCurrentUserToken();
        const res = await fetch('/api/config/maps', {
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.apiKey) {
            setApiKey(data.apiKey);
            setShowKeyConfig(false);
          }
        }
      } catch {
        // Graceful fallback
      }
    };

    if (!apiKey) {
      fetchServerKey();
    }
  }, [apiKey]);

  const [locationName, setLocationName] = useState(currentLocation?.name || '');
  const [address, setAddress] = useState(currentLocation?.address || '');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>({
    lat: currentLocation?.lat ?? 37.7749,
    lng: currentLocation?.lng ?? -122.4194
  });
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detectionError, setDetectionError] = useState<string | null>(null);

  useEffect(() => {
    if (currentLocation) {
      setLocationName(currentLocation.name);
      setAddress(currentLocation.address || '');
      if (currentLocation.lat && currentLocation.lng) {
        setCoordinates({ lat: currentLocation.lat, lng: currentLocation.lng });
      }
    }
  }, [currentLocation, isOpen]);

  // Browser Geolocation Detection
  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setDetectionError('Geolocation is not supported by your current browser.');
      return;
    }

    setIsDetectingLocation(true);
    setDetectionError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(5));
        const lng = parseFloat(position.coords.longitude.toFixed(5));
        setCoordinates({ lat, lng });
        if (!locationName) {
          setLocationName('Current Reflection Sanctuary');
        }
        setAddress(`${lat}° N, ${lng}° W (Detected GPS Coordinates)`);
        setIsDetectingLocation(false);
      },
      (error) => {
        setIsDetectingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          setDetectionError('Location permission was denied in browser settings.');
        } else {
          setDetectionError('Unable to retrieve current location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSelectPreset = (preset: typeof SANCTUARY_PRESETS[0]) => {
    setLocationName(preset.name);
    setAddress(preset.address);
    setCoordinates({ lat: preset.lat, lng: preset.lng });
  };

  const handleConfirm = () => {
    if (!locationName.trim()) {
      setLocationName('Reflection Spot');
    }
    onSelectLocation({
      name: locationName.trim() || 'Reflection Sanctuary',
      address: address.trim() || undefined,
      lat: coordinates.lat,
      lng: coordinates.lng
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isDark 
              ? 'bg-neutral-900 border-white/[0.1] text-neutral-100 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]' 
              : 'bg-white border-black/[0.08] text-neutral-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]'
          }`}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg sm:text-xl font-medium">Tag Reflection Location</h3>
                <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Anchor this journal entry to a mindful place with Google Maps Platform
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark 
                  ? 'hover:bg-neutral-800 border-white/[0.08] text-neutral-400 hover:text-white' 
                  : 'hover:bg-neutral-100 border-black/[0.06] text-neutral-500 hover:text-black'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            
            {/* Quick Action: Current Location Detection & Presets */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleDetectCurrentLocation}
                disabled={isDetectingLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-medium transition-all cursor-pointer shadow-sm"
              >
                <Crosshair className={`w-3.5 h-3.5 ${isDetectingLocation ? 'animate-spin' : ''}`} />
                <span>{isDetectingLocation ? 'Detecting GPS...' : 'Detect Current Location'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowKeyConfig(!showKeyConfig)}
                className={`text-[11px] font-mono flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity cursor-pointer ${
                  isDark ? 'text-neutral-300' : 'text-neutral-600'
                }`}
              >
                <Key className="w-3 h-3" />
                <span>{apiKey ? 'Google Maps API Key (Active)' : 'Configure Maps API Key / Demo'}</span>
              </button>
            </div>

            {detectionError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {detectionError}
              </div>
            )}

            {/* Google Maps API Key Panel (Prototyping / Production) */}
            {showKeyConfig && (
              <div className={`p-3.5 rounded-2xl border text-xs space-y-2.5 ${
                isDark ? 'bg-neutral-950/60 border-teal-500/20' : 'bg-teal-50/70 border-teal-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Google Maps Platform Integration</span>
                  </span>
                  <a
                    href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] underline text-teal-700 dark:text-teal-400 flex items-center gap-1 hover:opacity-80"
                  >
                    <span>Get Free Maps Demo Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  To render the live interactive Google Map with AdvancedMarkerElement, paste your key below or use the free prototyping demo key. Coordinates and locations work seamlessly in all modes.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy... (Paste Google Maps API Key)"
                    className={`flex-1 px-3 py-1.5 text-xs font-mono rounded-xl border outline-none ${
                      isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (apiKey.trim()) {
                        localStorage.setItem('reflecta_maps_api_key', apiKey.trim());
                      }
                      setShowKeyConfig(false);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-xl bg-teal-600 text-white font-semibold cursor-pointer hover:bg-teal-500 transition-colors"
                  >
                    Apply & Save
                  </button>
                </div>
              </div>
            )}

            {/* Location Details Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] font-mono uppercase tracking-wider mb-1 ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}>
                  Sanctuary / Place Name
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. Kyoto Zen Gardens, Lake Tahoe Cabin..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none transition-colors ${
                    isDark ? 'bg-neutral-950 border-neutral-700 focus:border-teal-500' : 'bg-white border-neutral-300 focus:border-teal-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-mono uppercase tracking-wider mb-1 ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}>
                  Address / Context (Optional)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Kyoto, Japan or GPS Coordinates..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none transition-colors ${
                    isDark ? 'bg-neutral-950 border-neutral-700 focus:border-teal-500' : 'bg-white border-neutral-300 focus:border-teal-500'
                  }`}
                />
              </div>
            </div>

            {/* Coordinates Display */}
            <div className="flex items-center justify-between text-[11px] font-mono px-3 py-1.5 rounded-xl border bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.06] dark:border-white/[0.06]">
              <span className="flex items-center gap-1.5 opacity-70">
                <Navigation className="w-3.5 h-3.5 text-teal-500" />
                <span>Pinned Coordinates:</span>
              </span>
              <span className="font-semibold text-teal-700 dark:text-teal-400">
                {coordinates.lat.toFixed(4)}° N, {coordinates.lng.toFixed(4)}° E
              </span>
            </div>

            {/* Quick Mindful Sanctuary Place Presets */}
            <div>
              <span className={`block text-[10px] font-mono uppercase tracking-wider mb-1.5 ${
                isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`}>
                Or pick a mindful sanctuary haven:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SANCTUARY_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-2.5 py-1 rounded-full text-xs transition-all border cursor-pointer ${
                      locationName === preset.name
                        ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/50 font-semibold'
                        : isDark
                          ? 'bg-neutral-950/60 text-neutral-400 border-white/[0.06] hover:text-white'
                          : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:text-neutral-900'
                    }`}
                  >
                    📍 {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Google Map Viewer Surface */}
            <div className="relative rounded-2xl overflow-hidden border border-black/[0.08] dark:border-white/[0.08] h-52 sm:h-64 bg-neutral-100 dark:bg-neutral-950">
              {apiKey ? (
                <APIProvider apiKey={apiKey}>
                  <Map
                    style={{ width: '100%', height: '100%' }}
                    defaultCenter={coordinates}
                    center={coordinates}
                    defaultZoom={12}
                    zoom={12}
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    onClick={(e) => {
                      if (e.detail?.latLng) {
                        const newLat = parseFloat(e.detail.latLng.lat.toFixed(5));
                        const newLng = parseFloat(e.detail.latLng.lng.toFixed(5));
                        setCoordinates({ lat: newLat, lng: newLng });
                        if (!address) {
                          setAddress(`${newLat}° N, ${newLng}° E`);
                        }
                      }
                    }}
                  >
                    <AdvancedMarker position={coordinates}>
                      <Pin 
                        background="#f59e0b" 
                        borderColor="#78350f" 
                        glyphColor="#ffffff" 
                      />
                    </AdvancedMarker>
                  </Map>
                </APIProvider>
              ) : (
                /* Prototyping interactive styled canvas fallback if no key provided yet */
                <div 
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;
                    const newLat = parseFloat((coordinates.lat + (0.5 - y) * 0.1).toFixed(4));
                    const newLng = parseFloat((coordinates.lng + (x - 0.5) * 0.1).toFixed(4));
                    setCoordinates({ lat: newLat, lng: newLng });
                  }}
                  className="w-full h-full relative cursor-crosshair flex flex-col items-center justify-center p-4 text-center select-none"
                  style={{
                    backgroundImage: isDark
                      ? 'radial-gradient(#333 1px, transparent 1px), linear-gradient(to bottom, #18181b, #09090b)'
                      : 'radial-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #f8fafc, #f1f5f9)',
                    backgroundSize: '24px 24px, 100% 100%'
                  }}
                >
                  <div className="relative z-10 flex flex-col items-center gap-2 max-w-sm">
                    <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/30 animate-bounce">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <span className="font-serif font-medium text-sm">
                      {locationName || 'Pinned Reflection Location'}
                    </span>
                    <span className="font-mono text-xs text-teal-600 dark:text-teal-400">
                      {coordinates.lat}° N, {coordinates.lng}° E
                    </span>
                    <p className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      Click anywhere on this sanctuary grid to reposition pin marker.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                isDark 
                  ? 'hover:bg-neutral-800 border-white/[0.08] text-neutral-300' 
                  : 'hover:bg-neutral-100 border-neutral-300 text-neutral-700'
              }`}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-semibold text-xs shadow-md shadow-teal-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Tag This Location</span>
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
