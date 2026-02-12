import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Loader } from '@googlemaps/js-api-loader';
import Navbar from '../components/Navbar';
import ProtectedRoute from '../components/ProtectedRoute';

const CreateRide = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [pickupText, setPickupText] = useState('');
  const [dropText, setDropText] = useState('');
  const [pickupLatLng, setPickupLatLng] = useState(null);
  const [dropLatLng, setDropLatLng] = useState(null);
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [genderPreference, setGenderPreference] = useState('any');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickupLocationLoading, setPickupLocationLoading] = useState(false);
  const [dropLocationLoading, setDropLocationLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationErrorType, setLocationErrorType] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapSelectingFor, setMapSelectingFor] = useState(null); // 'pickup' or 'drop'
  const [mapCenter, setMapCenter] = useState({ lat: 0, lng: 0 });
  const [selectedLocation, setSelectedLocation] = useState(null);

  const pickupInputRef = useRef(null);
  const dropInputRef = useRef(null);
  const pickupAutocompleteRef = useRef(null);
  const dropAutocompleteRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);

  // Convert 12-hour time to 24-hour format for storage
  const convertTo24Hour = (time12h) => {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = parseInt(hours, 10) + 12;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  useEffect(() => {
    // Load Google Maps API
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      setError('Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API_KEY in your environment (both local and Render).');
      console.error('⚠️ Google Maps API Key Missing!');
      console.error('Please set VITE_GOOGLE_MAPS_API_KEY in .env file locally and in Render env vars.');
      return;
    }

    const loader = new Loader({
      apiKey: apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry']
    });

    loader.load().then(() => {
      setMapsLoaded(true);
      setError(''); // Clear any previous errors
      
      // Verify Maps API is working
      if (!window.google || !window.google.maps) {
        setError('Google Maps failed to load. Please check your API key.');
        setMapsLoaded(false);
        return;
      }
      
      // Initialize autocomplete for pickup
      if (pickupInputRef.current) {
        pickupAutocompleteRef.current = new window.google.maps.places.Autocomplete(
          pickupInputRef.current,
          { types: ['address'] }
        );
        pickupAutocompleteRef.current.addListener('place_changed', () => {
          const place = pickupAutocompleteRef.current.getPlace();
          if (place.geometry) {
            setPickupText(place.formatted_address);
            setPickupLatLng({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            });
          }
        });
      }

      // Initialize autocomplete for drop
      if (dropInputRef.current) {
        dropAutocompleteRef.current = new window.google.maps.places.Autocomplete(
          dropInputRef.current,
          { types: ['address'] }
        );
        dropAutocompleteRef.current.addListener('place_changed', () => {
          const place = dropAutocompleteRef.current.getPlace();
          if (place.geometry) {
            setDropText(place.formatted_address);
            setDropLatLng({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            });
          }
        });
      }

      // Initialize Directions Service
      directionsServiceRef.current = new window.google.maps.DirectionsService();
      
      // Initialize Geocoder
      if (window.google.maps.Geocoder) {
        geocoderRef.current = new window.google.maps.Geocoder();
        console.log('Geocoder initialized successfully');
      } else {
        console.error('Geocoder not available');
      }
    }).catch((err) => {
      console.error('Error loading Google Maps:', err);
      let errorMessage = '';
      
      if (err.message.includes('InvalidKeyMapError') || err.message.includes('InvalidKey')) {
        errorMessage = 
          '❌ Invalid Google Maps API Key!\n\n' +
          'Your API key is invalid or not properly configured.\n\n' +
          'To fix:\n' +
          '1. Go to: https://console.cloud.google.com/apis/credentials\n' +
          '2. Create a new API key (or check your existing one)\n' +
          '3. Enable these 4 APIs:\n' +
          '   • Maps JavaScript API\n' +
          '   • Places API\n' +
          '   • Geocoding API\n' +
          '   • Directions API\n' +
          '4. Update the API key in .env file or CreateRide.jsx\n' +
          '5. Restart the server\n\n' +
          'See FIX_INVALID_API_KEY.md for detailed instructions.';
      } else if (err.message.includes('RefererNotAllowedMapError')) {
        errorMessage = 
          '❌ API Key Restriction Error!\n\n' +
          'Your API key is restricted and doesn\'t allow this domain.\n\n' +
          'To fix:\n' +
          '1. Go to Google Cloud Console → Credentials\n' +
          '2. Click on your API key\n' +
          '3. Under "Application restrictions", add:\n' +
          '   • For localhost: http://localhost:*\n' +
          '   • For production: your domain\n' +
          '4. Save and wait 1-2 minutes\n' +
          '5. Refresh your browser';
      } else if (err.message.includes('ApiNotActivatedMapError')) {
        errorMessage = 
          '❌ APIs Not Enabled!\n\n' +
          'Please enable these APIs in Google Cloud Console:\n\n' +
          '1. Go to: https://console.cloud.google.com/apis/library\n' +
          '2. Search and ENABLE:\n' +
          '   • Maps JavaScript API\n' +
          '   • Places API\n' +
          '   • Geocoding API\n' +
          '   • Directions API\n\n' +
          'After enabling, wait 1-2 minutes and refresh.';
      } else {
        errorMessage = 
          '❌ Failed to load Google Maps!\n\n' +
          'Error: ' + (err.message || 'Unknown error') + '\n\n' +
          'Please check:\n' +
          '• Your API key is correct\n' +
          '• All required APIs are enabled\n' +
          '• Your internet connection\n' +
          '• Browser console (F12) for more details';
      }
      
      setError(errorMessage);
      setMapsLoaded(false);
    });
  }, []);

  // Initialize map when modal opens
  useEffect(() => {
    if (showMapModal && mapsLoaded && mapRef.current) {
      // Clean up existing map if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current = null;
      }

      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (mapRef.current && window.google && window.google.maps) {
          const map = new window.google.maps.Map(mapRef.current, {
            center: mapCenter,
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false
          });

          mapInstanceRef.current = map;

          // Add marker
          const marker = new window.google.maps.Marker({
            map: map,
            draggable: true,
            position: mapCenter
          });

          markerRef.current = marker;
          setSelectedLocation(mapCenter);

          // Update marker position on map click
          map.addListener('click', (e) => {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            marker.setPosition({ lat, lng });
            setSelectedLocation({ lat, lng });
          });

          // Update marker position on drag
          marker.addListener('dragend', (e) => {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            setSelectedLocation({ lat, lng });
          });
        }
      }, 100);
    }

    return () => {
      if (!showMapModal) {
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [showMapModal, mapsLoaded, mapCenter]);

  const getCurrentLocation = async (forField) => {
    try {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser. Please use Chrome, Firefox, or Edge.');
        return;
      }

      // Set loading state for the specific field
      if (forField === 'pickup') {
        setPickupLocationLoading(true);
      } else {
        setDropLocationLoading(true);
      }
      setError('');

      // Check if permission was previously denied (non-blocking check)
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          if (permission.state === 'denied') {
            if (forField === 'pickup') {
              setPickupLocationLoading(false);
            } else {
              setDropLocationLoading(false);
            }
            setError(
              '📍 Location access is blocked!\n\n' +
              'To enable:\n' +
              '1. Click the lock icon (🔒) in your browser address bar\n' +
              '2. Find "Location" and set it to "Allow"\n' +
              '3. Refresh the page and try again\n\n' +
              'Or use "Choose from Map" to select location manually.'
            );
            return;
          }
        }
      } catch (permError) {
        // Permission API might not be fully supported, continue anyway
        console.log('Permission check not available:', permError);
      }

      // Get current position with timeout
      navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        console.log('Got GPS coordinates:', lat, lng);

        // Set coordinates first (for internal use)
        if (forField === 'pickup') {
          setPickupLatLng({ lat, lng });
        } else {
          setDropLatLng({ lat, lng });
        }

        // Now convert coordinates to address using geocoder
        const convertToAddress = () => {
          return new Promise((resolve) => {
            // Wait a bit for geocoder to be ready if needed
            if (!geocoderRef.current) {
              // Try to initialize geocoder if not ready
              if (window.google && window.google.maps) {
                geocoderRef.current = new window.google.maps.Geocoder();
              } else {
                console.log('Google Maps not loaded yet, waiting...');
                setTimeout(() => {
                  if (window.google && window.google.maps) {
                    geocoderRef.current = new window.google.maps.Geocoder();
                    performGeocoding(resolve);
                  } else {
                    resolve(null);
                  }
                }, 1000);
                return;
              }
            }

            performGeocoding(resolve);
          });
        };

        const performGeocoding = (resolve) => {
          if (!geocoderRef.current) {
            console.log('Geocoder not available');
            resolve(null);
            return;
          }

          try {
            geocoderRef.current.geocode(
              { location: { lat, lng } },
              (results, status) => {
                if (status === 'OK' && results && results.length > 0) {
                  const address = results[0].formatted_address;
                  console.log('Geocoded address:', address);
                  resolve(address);
                } else {
                  console.log('Geocoding failed:', status);
                  if (status === 'ZERO_RESULTS') {
                    console.log('No results found for coordinates');
                  } else if (status === 'OVER_QUERY_LIMIT') {
                    console.error('Geocoding API quota exceeded');
                  } else if (status === 'REQUEST_DENIED') {
                    console.error('Geocoding request denied - check API key');
                  }
                  resolve(null);
                }
              }
            );
          } catch (geocodeErr) {
            console.error('Error in geocode call:', geocodeErr);
            resolve(null);
          }
        };

        try {
          // Try to get address - with timeout
          const addressPromise = convertToAddress();
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 5000));
          const address = await Promise.race([addressPromise, timeoutPromise]);

          if (address) {
            // Success! Set the readable address
            if (forField === 'pickup') {
              setPickupText(address);
            } else {
              setDropText(address);
            }
            setError(''); // Clear any errors
            if (forField === 'pickup') {
              setPickupLocationLoading(false);
            } else {
              setDropLocationLoading(false);
            }
          } else {
            // Geocoding failed, but we have coordinates
            // Try one more time with a different approach
            if (window.google && window.google.maps && window.google.maps.Geocoder) {
              const geocoder = new window.google.maps.Geocoder();
              geocoder.geocode(
                { location: { lat, lng } },
                (results, status) => {
                  if (status === 'OK' && results && results.length > 0) {
                    const address = results[0].formatted_address;
                    if (forField === 'pickup') {
                      setPickupText(address);
                    } else {
                      setDropText(address);
                    }
                    setError('');
                  } else {
                    // Last resort: show coordinates but with a helpful message
                    const coordinateText = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                    if (forField === 'pickup') {
                      setPickupText(coordinateText);
                    } else {
                      setDropText(coordinateText);
                    }
                    setError('Got your location! Address lookup is taking longer. You can edit the location manually or use "Choose from Map".');
                  }
                  if (forField === 'pickup') {
                    setPickupLocationLoading(false);
                  } else {
                    setDropLocationLoading(false);
                  }
                }
              );
            } else {
              // Google Maps not available, use coordinates
              const coordinateText = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
              if (forField === 'pickup') {
                setPickupText(coordinateText);
              } else {
                setDropText(coordinateText);
              }
              setError('Got your location! Address lookup unavailable. Please use "Choose from Map" to select a readable address.');
              if (forField === 'pickup') {
                setPickupLocationLoading(false);
              } else {
                setDropLocationLoading(false);
              }
            }
          }
        } catch (err) {
          console.error('Error in geocoding process:', err);
          // Fallback to coordinates - at least we have the location
          const coordinateText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          if (forField === 'pickup') {
            setPickupText(coordinateText);
          } else {
            setDropText(coordinateText);
          }
          setError('✅ Got your location! Address lookup failed, but coordinates are set. You can edit the address manually.');
          if (forField === 'pickup') {
            setPickupLocationLoading(false);
          } else {
            setDropLocationLoading(false);
          }
        }
      },
      (error) => {
        if (forField === 'pickup') {
          setPickupLocationLoading(false);
        } else {
          setDropLocationLoading(false);
        }
        let errorMessage = '';
        let instructions = '';

        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = 'Location permission denied.';
          instructions = `
            <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p class="font-semibold mb-2">How to enable location access:</p>
              <ul class="list-disc list-inside space-y-1 text-left">
                <li><strong>Chrome/Edge:</strong> Click the lock icon (🔒) in address bar → Site settings → Location → Allow</li>
                <li><strong>Firefox:</strong> Click the shield icon → Permissions → Location → Allow</li>
                <li><strong>Safari:</strong> Safari → Settings → Websites → Location → Allow</li>
                <li>Or go to browser Settings → Privacy → Location → Allow for this site</li>
              </ul>
              <p class="mt-2 text-xs">After enabling, refresh the page and try again.</p>
            </div>
          `;
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = 'Location information unavailable. Your device location might be turned off.';
          instructions = `
            <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <p class="font-semibold mb-2">Troubleshooting:</p>
              <ul class="list-disc list-inside space-y-1 text-left">
                <li>Make sure your device location/GPS is turned on</li>
                <li>Check your device settings → Location Services</li>
                <li>Try using "Choose from Map" instead</li>
              </ul>
            </div>
          `;
        } else if (error.code === error.TIMEOUT) {
          errorMessage = 'Location request timed out. Please try again.';
        } else {
          errorMessage = 'Error getting your location. Please try again or use "Choose from Map".';
          console.error('Geolocation error details:', error);
        }

        setError(errorMessage + (instructions || ''));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout
        maximumAge: 0
      }
    );
    } catch (err) {
      // Catch any unexpected errors in the entire function
      console.error('Unexpected error in getCurrentLocation:', err);
      if (forField === 'pickup') {
        setPickupLocationLoading(false);
      } else {
        setDropLocationLoading(false);
      }
      setError(
        '❌ Something went wrong!\n\n' +
        'Error: ' + (err.message || err.toString() || 'Unknown error') + '\n\n' +
        'Please try:\n' +
        '1. Refresh the page\n' +
        '2. Check browser console (F12) for details\n' +
        '3. Use "Choose from Map" as an alternative\n\n' +
        'If the problem persists, make sure:\n' +
        '• Google Maps API is properly configured\n' +
        '• Geocoding API is enabled in Google Cloud Console\n' +
        '• Your browser allows location access'
      );
    }
  };

  const openMapSelector = (forField) => {
    setMapSelectingFor(forField);
    setSelectedLocation(null);
    
    // Set map center to existing location if available
    if (forField === 'pickup' && pickupLatLng) {
      setMapCenter(pickupLatLng);
      setShowMapModal(true);
    } else if (forField === 'drop' && dropLatLng) {
      setMapCenter(dropLatLng);
      setShowMapModal(true);
    } else {
      // Try to get user's current location for map center
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setMapCenter({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setShowMapModal(true);
          },
          () => {
            // Default to a central location if geolocation fails
            setMapCenter({ lat: 28.6139, lng: 77.2090 }); // Default: New Delhi
            setShowMapModal(true);
          }
        );
      } else {
        setMapCenter({ lat: 28.6139, lng: 77.2090 });
        setShowMapModal(true);
      }
    }
  };

  const confirmMapSelection = async () => {
    let locationToUse = selectedLocation;
    
    // Use marker position if no location selected yet
    if (!locationToUse && markerRef.current) {
      const position = markerRef.current.getPosition();
      locationToUse = {
        lat: position.lat(),
        lng: position.lng()
      };
    }

    if (locationToUse) {
      setLoading(true);
      
      if (geocoderRef.current) {
        geocoderRef.current.geocode(
          { location: locationToUse },
          (results, status) => {
            if (status === 'OK' && results[0]) {
              const address = results[0].formatted_address;
              
              if (mapSelectingFor === 'pickup') {
                setPickupText(address);
                setPickupLatLng(locationToUse);
              } else {
                setDropText(address);
                setDropLatLng(locationToUse);
              }
            } else {
              const address = `${locationToUse.lat.toFixed(6)}, ${locationToUse.lng.toFixed(6)}`;
              if (mapSelectingFor === 'pickup') {
                setPickupText(address);
                setPickupLatLng(locationToUse);
              } else {
                setDropText(address);
                setDropLatLng(locationToUse);
              }
            }
            setLoading(false);
            setShowMapModal(false);
            setMapSelectingFor(null);
            setSelectedLocation(null);
            mapInstanceRef.current = null;
            markerRef.current = null;
          }
        );
      } else {
        // Fallback if geocoder not ready
        const address = `${locationToUse.lat.toFixed(6)}, ${locationToUse.lng.toFixed(6)}`;
        if (mapSelectingFor === 'pickup') {
          setPickupText(address);
          setPickupLatLng(locationToUse);
        } else {
          setDropText(address);
          setDropLatLng(locationToUse);
        }
        setLoading(false);
        setShowMapModal(false);
        setMapSelectingFor(null);
        setSelectedLocation(null);
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    }
  };

  const getRoutePolyline = async () => {
    if (!pickupLatLng || !dropLatLng || !directionsServiceRef.current) {
      return null;
    }

    return new Promise((resolve) => {
      directionsServiceRef.current.route(
        {
          origin: pickupLatLng,
          destination: dropLatLng,
          travelMode: window.google.maps.TravelMode.DRIVING
        },
        (result, status) => {
          if (status === 'OK' && result.routes[0]) {
            const polyline = result.routes[0].overview_polyline;
            resolve(polyline.points);
          } else {
            resolve(null);
          }
        }
      );
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!pickupLatLng || !dropLatLng) {
      setError('Please select valid pickup and drop locations');
      setLoading(false);
      return;
    }

    if (!timeStart || !timeEnd) {
      setError('Please select time window');
      setLoading(false);
      return;
    }

    try {
      const polyline = await getRoutePolyline();
      
      // Convert 12-hour time to 24-hour and combine with today's date
      const today = getTodayDate();
      const startTime24 = convertTo24Hour(timeStart);
      const endTime24 = convertTo24Hour(timeEnd);
      
      const timeStartISO = `${today}T${startTime24}:00`;
      const timeEndISO = `${today}T${endTime24}:00`;
      
      const rideRequest = {
        userId: currentUser.uid,
        pickupText,
        dropText,
        pickupLatLng,
        dropLatLng,
        timeStart: timeStartISO,
        timeEnd: timeEndISO,
        genderPreference,
        notes: notes || '',
        polyline: polyline || '',
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      await addDoc(collection(db, 'ride_requests'), rideRequest);
      navigate('/my-requests');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate time options for 12-hour format (every 15 minutes)
  const generateTimeOptions = () => {
    const options = [];
    const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const minutes = ['00', '15', '30', '45'];
    
    // AM times
    hours.forEach((hour) => {
      minutes.forEach((min) => {
        const time12h = `${hour}:${min}`;
        options.push({ value: `${time12h} AM`, label: `${time12h} AM` });
      });
    });
    
    // PM times
    hours.forEach((hour) => {
      minutes.forEach((min) => {
        const time12h = `${hour}:${min}`;
        options.push({ value: `${time12h} PM`, label: `${time12h} PM` });
      });
    });
    
    return options;
  };

  const timeOptions = generateTimeOptions();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="bg-white/90 backdrop-blur-sm shadow-2xl rounded-2xl p-6 sm:p-8 lg:p-10 border border-gray-100">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent mb-6 sm:mb-8">
              Create Ride Request
            </h1>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm sm:text-base">
                <div className="flex items-start">
                  <span className="mr-2 text-xl">⚠️</span>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Error:</p>
                    <div dangerouslySetInnerHTML={{ __html: error }} />
                    {error.includes('API key') && (
                      <a 
                        href="https://console.cloud.google.com/apis/credentials" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 underline mt-2 inline-block"
                      >
                        Get Google Maps API Key →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {!mapsLoaded && !error && (
              <div className="bg-yellow-50 border-2 border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-6 text-sm sm:text-base">
                <div className="flex items-start">
                  <span className="mr-2">⏳</span>
                  <div>
                    <p className="font-semibold">Loading Google Maps...</p>
                    <p className="text-xs mt-1">If this takes too long, check your API key configuration.</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              {/* Pickup Location */}
              <div>
                <label htmlFor="pickup" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                  Pickup Location *
                </label>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                  <input
                    ref={pickupInputRef}
                    id="pickup"
                    type="text"
                    value={pickupText}
                    onChange={(e) => setPickupText(e.target.value)}
                    placeholder="Enter pickup address"
                    required
                    className="input-field flex-1"
                    disabled={!mapsLoaded}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!mapsLoaded) {
                        setError('Google Maps is not loaded. Please check your API key configuration.');
                        return;
                      }
                      openMapSelector('pickup');
                    }}
                    disabled={!mapsLoaded}
                    className="px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                    title={!mapsLoaded ? 'Google Maps API not configured' : 'Choose location on map'}
                  >
                    📍 Choose from Map
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!mapsLoaded) {
                        setError('Google Maps is not loaded. Please check your API key configuration.');
                        return;
                      }
                      getCurrentLocation('pickup');
                    }}
                    disabled={!mapsLoaded || pickupLocationLoading}
                    className="px-4 py-3 bg-gradient-to-r from-accent-600 to-accent-700 text-white rounded-lg hover:from-accent-700 hover:to-accent-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                    title={!mapsLoaded ? 'Google Maps API not configured' : 'Use your current GPS location'}
                  >
                    {pickupLocationLoading ? '⏳ Getting Location...' : '📍 Current Location'}
                  </button>
                </div>
              </div>

              {/* Drop Location */}
              <div>
                <label htmlFor="drop" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                  Drop Location *
                </label>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                  <input
                    ref={dropInputRef}
                    id="drop"
                    type="text"
                    value={dropText}
                    onChange={(e) => setDropText(e.target.value)}
                    placeholder="Enter drop address"
                    required
                    className="input-field flex-1"
                    disabled={!mapsLoaded}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!mapsLoaded) {
                        setError('Google Maps is not loaded. Please check your API key configuration.');
                        return;
                      }
                      openMapSelector('drop');
                    }}
                    disabled={!mapsLoaded}
                    className="px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                    title={!mapsLoaded ? 'Google Maps API not configured' : 'Choose location on map'}
                  >
                    📍 Choose from Map
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!mapsLoaded) {
                        setError('Google Maps is not loaded. Please check your API key configuration.');
                        return;
                      }
                      getCurrentLocation('drop');
                    }}
                    disabled={!mapsLoaded || dropLocationLoading}
                    className="px-4 py-3 bg-gradient-to-r from-accent-600 to-accent-700 text-white rounded-lg hover:from-accent-700 hover:to-accent-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                    title={!mapsLoaded ? 'Google Maps API not configured' : 'Use your current GPS location'}
                  >
                    {dropLocationLoading ? '⏳ Getting Location...' : '📍 Current Location'}
                  </button>
                </div>
              </div>

              {/* Time Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label htmlFor="timeStart" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                    Start Time * (Today)
                  </label>
                  <select
                    id="timeStart"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    required
                    className="input-field"
                  >
                    <option value="">Select start time</option>
                    {timeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs sm:text-sm text-dark-500 mt-2 font-medium">📅 Date: {new Date().toLocaleDateString()}</p>
                </div>
                <div>
                  <label htmlFor="timeEnd" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                    End Time * (Today)
                  </label>
                  <select
                    id="timeEnd"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    required
                    className="input-field"
                  >
                    <option value="">Select end time</option>
                    {timeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs sm:text-sm text-dark-500 mt-2 font-medium">📅 Date: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <label htmlFor="genderPreference" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                  Gender Preference
                </label>
                <select
                  id="genderPreference"
                  value={genderPreference}
                  onChange={(e) => setGenderPreference(e.target.value)}
                  className="input-field"
                >
                  <option value="any">Any</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                  Optional Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Any additional information..."
                  className="input-field resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !mapsLoaded}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg"
              >
                {loading ? 'Creating...' : '🚗 Create Ride Request'}
              </button>
            </form>
          </div>
        </div>

        {/* Map Modal */}
        {showMapModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                  Select {mapSelectingFor === 'pickup' ? 'Pickup' : 'Drop'} Location
                </h2>
                <p className="text-sm sm:text-base text-dark-600 mt-2">
                  Click on the map or drag the marker to select location
                </p>
              </div>
              <div className="flex-1 relative">
                <div ref={mapRef} className="w-full h-full min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]" />
              </div>
              <div className="p-4 sm:p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowMapModal(false);
                    setMapSelectingFor(null);
                    setSelectedLocation(null);
                    mapInstanceRef.current = null;
                    markerRef.current = null;
                  }}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg text-dark-700 font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmMapSelection}
                  disabled={loading}
                  className="btn-primary disabled:opacity-50"
                >
                  {loading ? 'Confirming...' : '✓ Confirm Location'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default CreateRide;
