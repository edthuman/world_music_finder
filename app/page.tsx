"use client";

import { useEffect, useRef } from "react";
import { Map, NavigationControl, AttributionControl, setWorkerUrl, type StyleSpecification } from "maplibre-gl";

setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());

const worldStyleUrl = "https://demotiles.maplibre.org/style.json";

async function loadWorldStyle(): Promise<StyleSpecification> {
  const response = await fetch(worldStyleUrl);
  if (!response.ok) throw new Error(`Map style request failed: ${response.status}`);

  const style = (await response.json()) as StyleSpecification;
  return {
    ...style,
    layers: style.layers.filter((layer) => layer.id !== "geolines" && layer.id !== "geolines-label"),
  };
}

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    let map: Map | undefined;
    let cancelled = false;

    loadWorldStyle().then((style) => {
      if (cancelled || !mapContainer.current) return;

      map = new Map({
        container: mapContainer.current,
        style,
        center: [12, 22],
        zoom: 1.35,
        minZoom: 1,
        maxZoom: 8,
        attributionControl: false,
      });

      map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new AttributionControl({ compact: true }), "bottom-left");
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return (
    <main className="map-page">
      <div ref={mapContainer} className="map-canvas" aria-label="Interactive world map" />
    </main>
  );
}
