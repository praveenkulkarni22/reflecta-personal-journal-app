import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Search, 
  Crosshair, 
  X, 
  Check, 
  Key, 
  Navigation,
  Globe,
  ExternalLink
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { JournalLocation } from '../types';
import { useTheme } from '../context/ThemeContext';
import { getCurrentUserToken } from '../lib/firebase';
import { decode, isFull, isShort, isValid, recoverNearest } from '@erikmichelson/open-location-code-ts';

interface LocationTaggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (location: JournalLocation) => void;
  currentLocation?: JournalLocation;
}

// Comprehensive global sanctuary and place presets for lightning-fast autocomplete & search
const GLOBAL_PLACES_DATABASE = [
  { name: 'Kyoto Zen Gardens', address: 'Kyoto, Japan', lat: 35.0116, lng: 135.7681 },
  { name: 'Big Sur Pacific Coast', address: 'Highway 1, Big Sur, CA, USA', lat: 36.2704, lng: -121.8081 },
  { name: 'Central Park Conservatory', address: 'New York, NY, USA', lat: 40.7937, lng: -73.9521 },
  { name: 'Swiss Alpine Valley', address: 'Lauterbrunnen, Switzerland', lat: 46.5935, lng: 7.9090 },
  { name: 'Reykjavik Nordic Haven', address: 'Reykjavik, Iceland', lat: 64.1466, lng: -21.9426 },
  { name: 'Ubud Sacred Monkey Forest', address: 'Ubud, Bali, Indonesia', lat: -8.5158, lng: 115.2625 },
  { name: 'Parisian Seine Riverside', address: 'Paris, France', lat: 48.8566, lng: 2.3522 },
  { name: 'Tokyo Tower Sanctuary', address: 'Tokyo, Japan', lat: 35.6586, lng: 139.7454 },
  { name: 'London Hyde Park', address: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { name: 'Sedona Red Rock Vortex', address: 'Sedona, AZ, USA', lat: 34.8697, lng: -111.7610 },
  { name: 'Maui Coastal Retreat', address: 'Maui, Hawaii, USA', lat: 20.7984, lng: -156.3319 },
  { name: 'Vancouver Pacific Sanctuary', address: 'Vancouver, BC, Canada', lat: 49.2827, lng: -123.1207 }
];

// Interactive Leaflet Map Component (100% reliable pan, zoom, drag marker, click to drop marker)
const InteractiveLeafletMap: React.FC<{
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
}> = ({ lat, lng, onLocationChange }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapInstanceRef.current) {
      const map = (L as any).map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 13,
        zoomControl: true,
        attributionControl: false
      });

      (L as any).tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      const customIcon = (L as any).divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="background-color: #0d9488; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">📍</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = (L as any).marker([lat, lng], { draggable: true, icon: customIcon }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onLocationChange(parseFloat(pos.lat.toFixed(5)), parseFloat(pos.lng.toFixed(5)));
      });

      map.on('click', (e: any) => {
        const { lat: newLat, lng: newLng } = e.latlng;
        marker.setLatLng([newLat, newLng]);
        onLocationChange(parseFloat(newLat.toFixed(5)), parseFloat(newLng.toFixed(5)));
      });

      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([lat, lng], mapInstanceRef.current.getZoom(), { animate: true });
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
    }
  }, [lat, lng]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  return <div ref={mapContainerRef} className="w-full h-full z-10" />;
};

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
  const [showKeyConfig, setShowKeyConfig] = useState(false);

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
          }
        }
      } catch {
        // Fallback
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
  const [gpsOrPlusCode, setGpsOrPlusCode] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (currentLocation) {
        setLocationName(currentLocation.name);
        setAddress(currentLocation.address || '');
        if (currentLocation.lat && currentLocation.lng) {
          setCoordinates({ lat: currentLocation.lat, lng: currentLocation.lng });
          setGpsOrPlusCode(`${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`);
        }
      } else {
        handleDetectCurrentLocation();
      }
    }
  }, [currentLocation, isOpen]);

  // Reverse geocoding helper to pinpoint and tag relevant place names dynamically
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const token = await getCurrentUserToken();
      const url = `/api/geocode/reverse?lat=${lat}&lon=${lng}`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const addr = data.address || {};
          const placeName = addr.tourism || addr.amenity || addr.historic || addr.railway || addr.place || addr.shop || addr.building || addr.road || addr.suburb || addr.city || '';
          
          let displayPlaceName = '';
          if (placeName) {
            displayPlaceName = placeName.charAt(0).toUpperCase() + placeName.slice(1);
          } else {
            displayPlaceName = data.display_name.split(',').slice(0, 2).join(',');
          }
          
          setLocationName(displayPlaceName || 'Reflection Spot');
          setAddress(data.display_name || `${lat}° N, ${lng}° E`);
        }
      } else {
        setLocationName('Reflection Spot');
        setAddress(`${lat}° N, ${lng}° E`);
      }
    } catch (e) {
      console.error('Reverse geocode error:', e);
      setLocationName('Reflection Spot');
      setAddress(`${lat}° N, ${lng}° E`);
    }
  };

  // Sync GPS coordinate input field with coordinates when they change from the map or suggestions
  useEffect(() => {
    setGpsOrPlusCode(`${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`);
  }, [coordinates]);

  // Robust Dynamic Place Autocomplete (Combining Local Preset Database + OpenStreetMap Nominatim API)
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 1) {
      setSuggestions([]);
      return;
    }

    const queryLower = searchQuery.toLowerCase();
    
    // 1. Filter local global places database instantly
    const localMatches = GLOBAL_PLACES_DATABASE.filter(
      p => p.name.toLowerCase().includes(queryLower) || p.address.toLowerCase().includes(queryLower)
    ).map(p => ({
      display_name: `${p.name} — ${p.address}`,
      name: p.name,
      lat: p.lat.toString(),
      lon: p.lng.toString()
    }));

    setSuggestions(localMatches);

    // 2. Query OpenStreetMap Nominatim API for live autocomplete
    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const token = await getCurrentUserToken();
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'Accept-Language': 'en',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data)) {
            const combined = [...localMatches, ...data.map((d: any) => ({
              display_name: d.display_name,
              name: d.name || d.display_name.split(',')[0],
              lat: d.lat,
              lon: d.lon
            }))];
            const unique: any[] = [];
            const seen = new Set();
            combined.forEach((item: any) => {
              if (!seen.has(item.display_name)) {
                seen.add(item.display_name);
                unique.push(item);
              }
            });
            setSuggestions(unique.slice(0, 7));
          }
        }
      } catch {
        // Keep local matches if network fails
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSuggestion = (place: any) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    setCoordinates({ lat, lng });
    const name = place.name || place.display_name.split(',')[0];
    setLocationName(name);
    setAddress(place.display_name);
    setSearchQuery(place.display_name);
    setSuggestions([]);
  };

  // Explicit Search Button trigger
  const handleSearchSubmit = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingPlaces(true);
    setDetectionError(null);
    try {
      const token = await getCurrentUserToken();
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Accept-Language': 'en',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const first = data[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          setCoordinates({ lat, lng });
          
          const name = first.name || first.display_name.split(',')[0];
          setLocationName(name);
          setAddress(first.display_name);
          
          const combined = data.map((d: any) => ({
            display_name: d.display_name,
            name: d.name || d.display_name.split(',')[0],
            lat: d.lat,
            lon: d.lon
          }));
          setSuggestions(combined);
        } else {
          setDetectionError('No locations found for your search query.');
        }
      } else {
        setDetectionError('Error querying location search API.');
      }
    } catch {
      setDetectionError('Network error during location search.');
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  // GPS Coordinates and Plus Code Input Resolver
  const handleApplyGpsOrPlusCode = async () => {
    const trimmed = gpsOrPlusCode.trim();
    if (!trimmed) return;
    setDetectionError(null);

    // 1. Try to parse as standard Decimal Coordinates (e.g., "35.0116, 135.7681" or "35.0116 135.7681")
    const latLngRegex = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)[,\s]+[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
    const match = trimmed.match(latLngRegex);
    if (match) {
      const parts = trimmed.split(/[,\s]+/).map(parseFloat);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const lat = parseFloat(parts[0].toFixed(5));
        const lng = parseFloat(parts[1].toFixed(5));
        setCoordinates({ lat, lng });
        await reverseGeocode(lat, lng);
        return;
      }
    }

    // 2. Try to parse as a Plus Code (Open Location Code)
    const tokens = trimmed.split(/\s+/);
    const codeIndex = tokens.findIndex(t => t.includes('+'));
    
    if (codeIndex !== -1) {
      let codePart = tokens[codeIndex].trim();
      // Clean up punctuation (trailing commas, semicolons, etc.)
      codePart = codePart.replace(/[,;]$/, '').toUpperCase();
      
      if (isValid(codePart)) {
        setIsSearchingPlaces(true);
        try {
          if (isFull(codePart)) {
            const decoded = decode(codePart);
            const lat = parseFloat(decoded.latitudeCenter.toFixed(5));
            const lng = parseFloat(decoded.longitudeCenter.toFixed(5));
            setCoordinates({ lat, lng });
            await reverseGeocode(lat, lng);
            return;
          } else if (isShort(codePart)) {
            // Find context part from remaining tokens
            const otherTokens = tokens.filter((_, idx) => idx !== codeIndex);
            const contextPart = otherTokens.join(' ').trim();
            
            let refLat = coordinates.lat;
            let refLng = coordinates.lng;
            
            if (contextPart) {
              const token = await getCurrentUserToken();
              const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(contextPart)}`, {
                headers: {
                  'Accept-Language': 'en',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
              });
              if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                  refLat = parseFloat(data[0].lat);
                  refLng = parseFloat(data[0].lon);
                }
              }
            }
            
            const fullCode = recoverNearest(codePart, refLat, refLng);
            const decoded = decode(fullCode);
            const lat = parseFloat(decoded.latitudeCenter.toFixed(5));
            const lng = parseFloat(decoded.longitudeCenter.toFixed(5));
            setCoordinates({ lat, lng });
            await reverseGeocode(lat, lng);
            return;
          }
        } catch (err) {
          console.error('Error decoding/resolving Plus Code:', err);
          setDetectionError('Failed to parse or expand the Plus Code. Ensure it is correct.');
          return;
        } finally {
          setIsSearchingPlaces(false);
        }
      }
    }

    // 3. Fallback: Query as standard location query via Nominatim search API
    setIsSearchingPlaces(true);
    try {
      const token = await getCurrentUserToken();
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(trimmed)}`, {
        headers: {
          'Accept-Language': 'en',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const first = data[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          setCoordinates({ lat, lng });
          
          const name = first.name || first.display_name.split(',')[0];
          setLocationName(name);
          setAddress(first.display_name);
        } else {
          setDetectionError('Could not find matching location for your input. Ensure Plus Code has city/region context if needed.');
        }
      } else {
        setDetectionError('Error resolving the coordinates input.');
      }
    } catch {
      setDetectionError('Network error resolving coordinates input.');
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  // Browser Geolocation Detection
  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setDetectionError('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingLocation(true);
    setDetectionError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(5));
        const lng = parseFloat(position.coords.longitude.toFixed(5));
        setCoordinates({ lat, lng });
        reverseGeocode(lat, lng);
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
                  Search places dynamically or move the map to pin your sanctuary
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
            
            {/* Search Input with Dynamic Live Suggestions & Dedicated Search Button */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchSubmit();
                      }
                    }}
                    placeholder="Type any city, landmark, or sanctuary (e.g. Kyoto, Paris, Central Park)..."
                    className={`w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border outline-none transition-colors ${
                      isDark ? 'bg-neutral-950 border-neutral-700 focus:border-teal-500 text-white' : 'bg-white border-neutral-300 focus:border-teal-500 text-neutral-900'
                    }`}
                  />
                  {isSearchingPlaces && (
                    <span className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-teal-500 text-[10px] font-mono">
                      Searching...
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl cursor-pointer transition-colors shrink-0 shadow-sm"
                >
                  Search
                </button>
              </div>

              {/* Dynamic Suggestions Dropdown */}
              {suggestions.length > 0 && (
                <div className={`absolute left-0 right-0 mt-1.5 z-50 rounded-xl border shadow-2xl overflow-hidden max-h-60 overflow-y-auto ${
                  isDark ? 'bg-neutral-900 border-neutral-700 text-neutral-200' : 'bg-white border-neutral-200 text-neutral-800'
                }`}>
                  {suggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className={`w-full text-left px-3.5 py-3 text-xs flex items-center gap-2.5 border-b last:border-b-0 transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-neutral-800 border-neutral-800 text-neutral-200' : 'hover:bg-teal-50 border-neutral-100 text-neutral-800'
                      }`}
                    >
                      <MapPin className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                      <span className="truncate leading-relaxed font-medium">{item.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleDetectCurrentLocation}
                disabled={isDetectingLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-medium transition-all cursor-pointer shadow-sm"
              >
                <Crosshair className={`w-3.5 h-3.5 ${isDetectingLocation ? 'animate-spin' : ''}`} />
                <span>{isDetectingLocation ? 'Detecting GPS...' : 'Detect Current GPS Location'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowKeyConfig(!showKeyConfig)}
                className={`text-[11px] font-mono flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity cursor-pointer ${
                  isDark ? 'text-neutral-300' : 'text-neutral-600'
                }`}
              >
                <Key className="w-3 h-3" />
                <span>{apiKey ? 'Google Maps API (Active)' : 'Configure Google Maps API'}</span>
              </button>
            </div>

            {detectionError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {detectionError}
              </div>
            )}

            {showKeyConfig && (
              <div className={`p-3.5 rounded-2xl border text-xs space-y-2.5 ${
                isDark ? 'bg-neutral-950/60 border-teal-500/20' : 'bg-teal-50/70 border-teal-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Google Maps API Key</span>
                  </span>
                  <a
                    href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] underline text-teal-700 dark:text-teal-400 flex items-center gap-1 hover:opacity-80"
                  >
                    <span>Get Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
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
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* GPS Coordinate / Plus Code Input with Apply button */}
            <div className="space-y-1.5">
              <label className={`block text-[11px] font-mono uppercase tracking-wider ${
                isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`}>
                GPS Coordinates or Plus Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gpsOrPlusCode}
                  onChange={(e) => setGpsOrPlusCode(e.target.value)}
                  placeholder="e.g. 35.0116, 135.7681 or 8FGM+6X Kyoto, Japan"
                  className={`flex-1 px-3 py-2 text-xs rounded-xl border outline-none transition-colors ${
                    isDark ? 'bg-neutral-950 border-neutral-700 focus:border-teal-500 text-white font-mono' : 'bg-white border-neutral-300 focus:border-teal-500 text-neutral-900 font-mono'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleApplyGpsOrPlusCode}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl cursor-pointer transition-colors shrink-0 shadow-sm"
                >
                  Apply & Pin
                </button>
              </div>
              <p className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Type decimals (e.g. <span className="font-mono">43.65, -79.38</span>) or a Plus Code to update map pin instantly.
              </p>
            </div>

            {/* Resolved Sanctuary & Context Info Card (Display Only) */}
            <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
              isDark ? 'bg-neutral-950/40 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
            }`}>
              <div className="flex items-center gap-1.5 font-semibold text-teal-700 dark:text-teal-400">
                <Navigation className="w-4 h-4" />
                <span>Resolved Place Name:</span>
              </div>
              <div className="font-serif text-sm font-medium">
                {locationName || 'Reflection Spot (Not Resolved)'}
              </div>
              {address && (
                <div className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  {address}
                </div>
              )}
            </div>

            {/* Fully Interactive Map (Google Maps if API Key present, or Interactive Leaflet Map) */}
            <div className="relative rounded-2xl overflow-hidden border border-black/[0.08] dark:border-white/[0.08] h-64 sm:h-72 bg-neutral-100 dark:bg-neutral-950">
              {apiKey ? (
                <APIProvider apiKey={apiKey}>
                  <Map
                    style={{ width: '100%', height: '100%' }}
                    defaultCenter={coordinates}
                    center={coordinates}
                    defaultZoom={13}
                    zoom={13}
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    zoomControl={true}
                    streetViewControl={true}
                    mapTypeControl={true}
                    onClick={(e) => {
                      if (e.detail?.latLng) {
                        const newLat = parseFloat(e.detail.latLng.lat.toFixed(5));
                        const newLng = parseFloat(e.detail.latLng.lng.toFixed(5));
                        setCoordinates({ lat: newLat, lng: newLng });
                        reverseGeocode(newLat, newLng);
                      }
                    }}
                  >
                    <AdvancedMarker position={coordinates}>
                      <Pin 
                        background="#0d9488" 
                        borderColor="#115e59" 
                        glyphColor="#ffffff" 
                      />
                    </AdvancedMarker>
                  </Map>
                </APIProvider>
              ) : (
                <InteractiveLeafletMap
                  lat={coordinates.lat}
                  lng={coordinates.lng}
                  onLocationChange={(lat, lng) => {
                    setCoordinates({ lat, lng });
                    reverseGeocode(lat, lng);
                  }}
                />
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
