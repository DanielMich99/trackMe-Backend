import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

interface DrawControlProps {
    onPolygonCreated: (coordinates: number[][]) => void;
}

export default function DrawControl({ onPolygonCreated }: DrawControlProps) {
    const map = useMap();
    const controlRef = useRef<L.Control.Draw | null>(null);
    const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

    useEffect(() => {
        // Create a feature group to store drawn shapes
        const drawnItems = new L.FeatureGroup();
        drawnItemsRef.current = drawnItems;
        map.addLayer(drawnItems);

        // Configure polygon drawing with specific settings
        const polygonOptions: any = {
            allowIntersection: false,
            showArea: true,
            drawError: {
                color: '#e1e100',
                message: '<strong>Cannot draw intersection!</strong>'
            },
            shapeOptions: {
                color: '#ff0000',
                fillColor: '#ff0000',
                fillOpacity: 0.3,
            },
            // Don't complete on double-click - require clicking first vertex
            clickable: true,
        };

        // Initialize draw control
        const drawControl = new L.Control.Draw({
            position: 'topleft',
            draw: {
                polygon: polygonOptions,
                rectangle: {
                    shapeOptions: {
                        color: '#ff0000',
                        fillColor: '#ff0000',
                        fillOpacity: 0.3,
                    },
                },
                polyline: false,
                circle: false,
                marker: false,
                circlemarker: false,
            },
            edit: {
                featureGroup: drawnItems,
                remove: true,
                edit: true,
            },
        });

        controlRef.current = drawControl;
        map.addControl(drawControl);

        // Handle shape creation (both polygon and rectangle)
        const handleCreated = (e: any) => {
            const layer = e.layer;

            // Clear previous shapes
            drawnItems.clearLayers();
            drawnItems.addLayer(layer);

            // Get coordinates in [lng, lat] format for GeoJSON
            let latLngs: L.LatLng[];

            if (e.layerType === 'rectangle') {
                // Rectangle returns bounds, convert to coordinates
                const bounds = layer.getBounds();
                latLngs = [
                    bounds.getSouthWest(),
                    L.latLng(bounds.getSouthWest().lat, bounds.getNorthEast().lng),
                    bounds.getNorthEast(),
                    L.latLng(bounds.getNorthEast().lat, bounds.getSouthWest().lng),
                ];
            } else {
                // Polygon
                const coords = layer.getLatLngs();
                latLngs = Array.isArray(coords[0]) ? coords[0] : coords;
            }

            const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
            console.log('Polygon created with', coordinates.length, 'points');
            onPolygonCreated(coordinates);
        };

        // Handle edit completion
        const handleEdited = (e: any) => {
            const layers = e.layers;
            layers.eachLayer((layer: any) => {
                const coords = layer.getLatLngs();
                const latLngs = Array.isArray(coords[0]) ? coords[0] : coords;
                const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
                console.log('Polygon edited, now has', coordinates.length, 'points');
                onPolygonCreated(coordinates);
            });
        };

        map.on(L.Draw.Event.CREATED, handleCreated);
        map.on(L.Draw.Event.EDITED, handleEdited);

        // Cleanup
        return () => {
            if (controlRef.current) {
                map.removeControl(controlRef.current);
            }
            if (drawnItemsRef.current) {
                map.removeLayer(drawnItemsRef.current);
            }
            map.off(L.Draw.Event.CREATED, handleCreated);
            map.off(L.Draw.Event.EDITED, handleEdited);
        };
    }, [map, onPolygonCreated]);

    return null;
}
