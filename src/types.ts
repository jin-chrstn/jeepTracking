export interface LatLng {
  lat: number;
  lng: number;
}

export interface VehicleData {
  plateNumber: string;
  operator: string;
  routeId: string;
  routeDescription: string;
  currentPosition: LatLng;
  passengerCount: number;
  totalCapacity: number;
}
