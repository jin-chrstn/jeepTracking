import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
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

// Example Route Path (Simplified LatLng pairs for the Polyline)
// NOTE: We will use this to move the marker for the simulation!
const exampleRoutePath: [number, number][] = [
    [10.350, 123.900],
    [10.330, 123.890],
    [10.310, 123.880], 
    [10.290, 123.860],
    [10.270, 123.850],
];

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
  const [vehicle, setVehicle] = useState<VehicleData>(initialVehicleData); 
  const [, setRouteIndex] = useState<number>(0); // Tracks current point on the path (index not read elsewhere)
  
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
        const next = (prevIndex + 1) % exampleRoutePath.length;

        setVehicle((prevVehicle: VehicleData) => {
          const [lat, lng] = exampleRoutePath[next];
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
  }, []); // empty deps: interval uses functional updates
  
  // --- RENDERING ---
  
  return (
    <div className="app-container">
      
      {/* MAP WRAPPER (The Left Side) */}
      <div className="map-wrapper">
        
        <MapContainer 
          // Note: Use the current position for center for a more immersive feel, or InitialCenter if you want a fixed view
          center={[vehicle.currentPosition.lat, vehicle.currentPosition.lng]} 
          zoom={InitialZoom} 
          scrollWheelZoom={true}
          className="thesis-map"
        >
          {/* Tile Layer: The actual map image provider */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Route Line */}
          <Polyline 
            positions={exampleRoutePath} 
            color={'#e74c3c'} 
            weight={6}
            opacity={0.7}
          />
          
          {/* Jeepney Marker */}
          <Marker 
            position={[vehicle.currentPosition.lat, vehicle.currentPosition.lng]}
            icon={JeepneyIcon} 
          >
            <Popup>
                <div>
                  Plate: <strong>{vehicle.plateNumber}</strong>
                  <br />
                  Passengers: {vehicle.passengerCount}/{vehicle.totalCapacity}
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
            <h2>{vehicle.routeDescription}</h2>
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
        </div>
      </div>
    </div>
  );
}

export default App;