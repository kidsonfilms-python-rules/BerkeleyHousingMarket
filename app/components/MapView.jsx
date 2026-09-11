"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Plus, Minus, LocateFixed } from "lucide-react";
import mapboxgl from "mapbox-gl";

export default function MapView({ locations = [], selectedId, onSelect }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef([]);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const hasToken = Boolean(token?.startsWith("pk.") && !token.includes("your_mapbox"));

  useEffect(() => {
    if (!hasToken || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-122.2585, 37.8688],
      zoom: 13.7,
      attributionControl: false
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => {
      map.resize();
      setMapReady(true);
    });
    map.on("error", () => setMapError(true));
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      map.remove();
    };
  }, [hasToken, token]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = locations.map((location) => {
      const marker = new mapboxgl.Marker({ color: "#8292ff" })
        .setLngLat(location.coordinates)
        .addTo(mapRef.current);
      const element = marker.getElement();
      element.setAttribute("aria-label", `Select ${location.address}`);
      element.setAttribute("role", "button");
      element.tabIndex = 0;
      element.addEventListener("click", () => onSelect?.(location));
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") onSelect?.(location);
      });
      return { id: location.id, marker };
    });
  }, [locations, mapReady]);

  useEffect(() => {
    markersRef.current.forEach(({ id, marker }) => {
      marker.getElement().classList.toggle("selected", id === selectedId);
    });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const selectedLocation = locations.find((location) => location.id === selectedId);
    if (!selectedLocation) return;
    mapRef.current.flyTo({
      center: selectedLocation.coordinates,
      zoom: 15.6,
      duration: 850,
      essential: true
    });
  }, [locations, selectedId]);

  const recenter = () => mapRef.current?.flyTo({ center: [-122.2585, 37.8688], zoom: 13.7 });
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  return (
    <>
      {hasToken && <div ref={containerRef} className="map-canvas" />}
      {(!hasToken || mapError) && (
        <div className="map-fallback">
          <span className="map-label one">Northside</span>
          <span className="map-label two">Downtown Berkeley</span>
          <span className="map-label three">South Berkeley</span>
        </div>
      )}
      <div className="map-tint" />
      {(!hasToken || mapError) && locations.map((location) => <button key={location.id} className={`pin ${location.id === selectedId ? "selected" : ""}`} style={location.fallbackPosition} onClick={() => onSelect?.(location)} aria-label={`Select ${location.address}`}><MapPin size={12} fill="currentColor" /></button>)}
      <div className="map-controls">
        <button className="map-control" onClick={zoomIn} aria-label="Zoom in"><Plus size={16} /></button>
        <button className="map-control" onClick={zoomOut} aria-label="Zoom out"><Minus size={16} /></button>
        <button className="map-control" onClick={recenter} aria-label="Recenter map"><LocateFixed size={15} /></button>
      </div>
      <div className="scale">500 FT&nbsp;&nbsp; ———</div>
    </>
  );
}
