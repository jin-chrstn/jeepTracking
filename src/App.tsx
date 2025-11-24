import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

import './App.css'; 
import 'leaflet/dist/leaflet.css'; 
import type { LatLng, VehicleData } from './types.ts'; // Import our custom types (type-only import, explicit extension)

// --- 1. CONFIGURATION AND DUMMY DATA ---

// Define a custom icon for the jeepney/bus (Red marker placeholder)
const JeepneyIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const InitialCenter: LatLng = { lat: 10.3157, lng: 123.88 }; // Cebu City Center
const InitialZoom = 13;

// Raw 62C route data (Pit-os <-> Carbon) from GeoJSON. This will be sent to a map-matching API.
const routeData = {
  pitToCarbon: [
    [10.39522, 123.92188],
    [10.38988, 123.92216],
    [10.38422, 123.9219],
    [10.37901, 123.92112],
    [10.3729, 123.91988],
    [10.3681, 123.91901],
    [10.3623, 123.9168],
    [10.3554, 123.9134],
    [10.34932, 123.90998],
    [10.33116, 123.90683],
    [10.32907, 123.9066],
    [10.3268, 123.90635],
    [10.32435, 123.9061],
    [10.32241, 123.9059],
    [10.32085, 123.90578],
    [10.31931, 123.9056],
    [10.3186, 123.90537],
    [10.31748, 123.90492],
    [10.3167, 123.90472],
    [10.31574, 123.9052],
    [10.31408, 123.90547],
    [10.31333, 123.90535],
    [10.31236, 123.90508],
    [10.3116, 123.90472],
    [10.30988, 123.90348],
    [10.30892, 123.90326],
    [10.30772, 123.90288],
    [10.30701, 123.90252],
    [10.30618, 123.9019],
    [10.30532, 123.90088],
    [10.30416, 123.89963],
    [10.30228, 123.89902],
    [10.30137, 123.89882],
    [10.30062, 123.8987],
    [10.29963, 123.8986],
    [10.29745, 123.89841],
    [10.29664, 123.89836],
    [10.29513, 123.89827],
    [10.2938, 123.89842],
    [10.29138, 123.89902]
  ] as [number, number][],
  carbonToPit: [
    [10.29138, 123.89902],
    [10.2938, 123.89842],
    [10.29513, 123.89827],
    [10.29664, 123.89836],
    [10.29745, 123.89841],
    [10.29963, 123.8986],
    [10.30062, 123.8987],
    [10.30137, 123.89882],
    [10.30228, 123.89902],
    [10.30416, 123.89963],
    [10.30532, 123.90088],
    [10.30618, 123.9019],
    [10.30701, 123.90252],
    [10.30772, 123.90288],
    [10.30892, 123.90326],
    [10.30988, 123.90348],
    [10.3116, 123.90472],
    [10.31236, 123.90508],
    [10.31333, 123.90535],
    [10.31408, 123.90547],
    [10.31574, 123.9052],
    [10.3167, 123.90472],
    [10.31748, 123.90492],
    [10.3186, 123.90537],
    [10.31931, 123.9056],
    [10.32085, 123.90578],
    [10.32241, 123.9059],
    [10.32435, 123.9061],
    [10.3268, 123.90635],
    [10.32907, 123.9066],
    [10.33116, 123.90683],
    [10.34932, 123.90998],
    [10.3554, 123.9134],
    [10.3623, 123.9168],
    [10.3681, 123.91901],
    [10.3729, 123.91988],
    [10.37901, 123.92112],
    [10.38422, 123.9219],
    [10.38988, 123.92216],
    [10.39522, 123.92188]
  ] as [number, number][],
};

const initialVehicleData: VehicleData = {
    plateNumber: 'GWN 550',
    operator: 'PITAMCO',
    routeId: '62C',
    routeDescription: 'PIT-OS TALAMBAN CARBON VIA ECHAVEZ',
    currentPosition: InitialCenter,
    passengerCount: 15,
    totalCapacity: 25,
};

// --- 2. THE MAIN APPLICATION COMPONENT ---

const App: React.FC = () => {
  // Use the VehicleData type for the state
  const [vehicle, setVehicle] = useState<VehicleData>(initialVehicleData); // Vehicle info
  const [routeIndex, setRouteIndex] = useState<number>(0); // Current point on the path
  const [isLoading, setIsLoading] = useState<boolean>(true); // For loading state
  const [currentDirection, setCurrentDirection] = useState<'pitToCarbon' | 'carbonToPit'>('pitToCarbon');
  const [isFollowing, setIsFollowing] = useState<boolean>(true); // State for follow-me feature

  // State to hold both matched routes
  const [matchedRoutes, setMatchedRoutes] = useState<{
    pitToCarbon: [number, number][];
    carbonToPit: [number, number][];
  }>({ pitToCarbon: [], carbonToPit: [] });

  // Derive the currently active route path from state
  const activeRoutePath = matchedRoutes[currentDirection];

  // (KML/GeoJSON upload & parsing were removed per user request.)
  
  // --- MAP MATCHING LOGIC ---
  useEffect(() => {
    // This helper function takes raw coordinates and fetches a road-snapped route from OSRM.
    const fetchMatchedRoute = async (coords: [number, number][], fallbackCoords: [number, number][]) => {
      const coordsString = coords
        .map(coord => `${coord[1]},${coord[0]}`)
        .join(';');
      const apiUrl = `https://router.project-osrm.org/match/v1/driving/${coordsString}?overview=full&geometries=geojson`;

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`API request failed: ${response.statusText}`);
        const data = await response.json();

        if (data.matchings && data.matchings.length > 0) {
          const matchedCoords = data.matchings[0].geometry.coordinates;
          return matchedCoords.map((c: [number, number]) => [c[1], c[0]]); // Swap back to [lat, lng]
        } else {
          console.warn('Map matching returned no route, using raw data as fallback.');
          return fallbackCoords;
        }
      } catch (error) {
        console.error('Error fetching matched route:', error);
        return fallbackCoords; // Fallback to raw data on error
      }
    };

    // Fetch both routes concurrently
    const fetchAllRoutes = async () => {
      setIsLoading(true);
      const [pitToCarbonPath, carbonToPitPath] = await Promise.all([
        fetchMatchedRoute(routeData.pitToCarbon, routeData.pitToCarbon),
        fetchMatchedRoute(routeData.carbonToPit, routeData.carbonToPit),
      ]);
      setMatchedRoutes({ pitToCarbon: pitToCarbonPath, carbonToPit: carbonToPitPath });
      setIsLoading(false);
    };

    fetchAllRoutes();
  }, []); // The empty dependency array [] ensures this runs only once when the component mounts.

  // --- UI HANDLERS ---
  const handleSwitchDirection = () => {
    const newDirection = currentDirection === 'pitToCarbon' ? 'carbonToPit' : 'pitToCarbon';
    setCurrentDirection(newDirection);

    // Reset simulation to the start of the new route
    setRouteIndex(0);
    setVehicle(prev => {
      const newRoute = matchedRoutes[newDirection];
      const [startLat, startLng] = newRoute.length > 0 ? newRoute[0] : [InitialCenter.lat, InitialCenter.lng];
      return {
        ...prev,
        currentPosition: { lat: startLat, lng: startLng },
      };
    });
  };

  // Logic to determine capacity status for display
  const getCapacityStatus = (count: number, capacity: number): string => {
      const ratio = count / capacity;
      if (ratio >= 0.8) return 'FULL';
      if (ratio >= 0.5) return 'MODERATE';
      return 'LOW';
  };
  
  const capacityStatus = getCapacityStatus(vehicle.passengerCount, vehicle.totalCapacity);
  
  // --- REAL-TIME SIMULATION LOGIC ---
  useEffect(() => {
    // Simulate receiving new data from the jeepney's device.
    // Use functional updaters to avoid stale closures inside the interval.
    const intervalId = setInterval(() => {
      setRouteIndex(prevIndex => {
        const next = (prevIndex + 1) % Math.max(1, activeRoutePath.length);
        
        setVehicle((prevVehicle: VehicleData) => {
          const [lat, lng] = activeRoutePath[next] || activeRoutePath[0] || [InitialCenter.lat, InitialCenter.lng];
          const newPosition: LatLng = { lat, lng };

          const newPassengerCount = Math.min(
            prevVehicle.totalCapacity,
            Math.max(0, prevVehicle.passengerCount + (Math.random() > 0.5 ? 1 : -1))
          );

          return {
            ...prevVehicle,
            currentPosition: newPosition,
            passengerCount: newPassengerCount,
          };
        });

        return next;
      });
    }, 3000);

    return () => clearInterval(intervalId);
  }, [activeRoutePath]); // Recreate interval when the active route changes
  
  // --- MAP VIEW CONTROLLER COMPONENT ---
  // This component is responsible for programmatically changing the map's view.
  const MapViewController: React.FC<{ position: LatLng; follow: boolean }> = ({ position, follow }) => {
    const map = useMap();
    useEffect(() => {
      if (follow) {
        map.setView([position.lat, position.lng], map.getZoom(), {
          animate: true,
          pan: { duration: 1 },
        });
      }
    }, [map, position, follow]);
    return null; // This component does not render anything itself.
  };

  // --- RENDERING ---
  
  return (
    <div className="app-container">
      
      {/* MAP WRAPPER (The Left Side) */}
      <div className="map-wrapper">
        <MapContainer 
          center={[InitialCenter.lat, InitialCenter.lng]} 
          zoom={InitialZoom} 
          scrollWheelZoom={true}
          className="thesis-map"
        >
          {/* Tile Layer: The actual map image provider */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* This component will handle panning the map */}
          <MapViewController position={vehicle.currentPosition} follow={isFollowing} />
          
          {/* Route Line - Only render if the path has been loaded */}
          {!isLoading && activeRoutePath.length > 0 && (
            <Polyline 
              positions={activeRoutePath} 
              color={'#e74c3c'} 
              weight={6}
              opacity={0.7}
            />
          )}
          
          {/* Jeepney Marker */}
          <Marker 
            position={[vehicle.currentPosition.lat, vehicle.currentPosition.lng]}
            icon={JeepneyIcon} 
          >
            {/* This Popup appears when the user clicks on the Marker */}
            <Popup>
                <div className="marker-popup">
                  <h3>{vehicle.routeId}: {vehicle.operator}</h3>
                  <p><strong>Plate No:</strong> {vehicle.plateNumber}</p>
                  <p>
                    <strong>Passengers: </strong> 
                    {vehicle.passengerCount} / {vehicle.totalCapacity}
                  </p>
                  <p>
                    <strong>Status: </strong>
                    <span className={`status-label ${capacityStatus.toLowerCase()}`}>{capacityStatus}</span>
                  </p>
                </div>
            </Popup>
          </Marker>
          
        </MapContainer>
      </div>
      {/* INFO PANEL (The Right Side) */}
      <div className="info-panel">
        <div className="info-card">
          <header>
            <h1>62C PIT-OS</h1>
          </header>

          <div className="route-details">
            <h2>
              {currentDirection === 'pitToCarbon' 
                ? 'DIRECTION: PIT-OS TO CARBON' 
                : 'DIRECTION: CARBON TO PIT-OS'}
            </h2>
            <p><strong>Plate Number:</strong> {vehicle.plateNumber}</p>
            <p><strong>Operator:</strong> {vehicle.operator}</p>
          </div>

          <hr className="divider" />

          <div className="capacity-details">
            <h3>PASSENGER COUNT: <span>{vehicle.passengerCount}/{vehicle.totalCapacity}</span></h3>
            <p className={`status ${capacityStatus.toLowerCase()}`}>Capacity Status: <strong>{capacityStatus}</strong></p>

            <div className="legend">
              <div className="item low"><span className="swatch"/></div>
              <div className="item">LOW</div>
              <div className="item moderate"><span className="swatch"/></div>
              <div className="item">MODERATE</div>
              <div className="item full"><span className="swatch"/></div>
              <div className="item">FULL</div>
            </div>
          </div>

          <hr className="divider" />

          <div className="controls">
            <button onClick={handleSwitchDirection} disabled={isLoading}>
              {isLoading ? 'Loading Routes...' : 'Switch Direction'}
            </button>
            <div className="follow-toggle">
              <input
                type="checkbox"
                id="follow-vehicle"
                checked={isFollowing}
                onChange={(e) => setIsFollowing(e.target.checked)}
              />
              <label htmlFor="follow-vehicle">Follow Vehicle</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;