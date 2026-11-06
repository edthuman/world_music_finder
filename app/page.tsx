"use client";

import { useEffect, useRef, useState } from "react";
import { Map, NavigationControl, AttributionControl, setWorkerUrl, type StyleSpecification } from "maplibre-gl";

setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());

const worldStyleUrl = "https://demotiles.maplibre.org/style.json";

async function loadWorldStyle(): Promise<StyleSpecification> {
  const response = await fetch(worldStyleUrl);
  if (!response.ok) throw new Error(`Map style request failed: ${response.status}`);

  const style = (await response.json()) as StyleSpecification;
  return {
    ...style,
    layers: style.layers
      .filter((layer) => layer.id !== "geolines" && layer.id !== "geolines-label")
      .map((layer) => {
        if (layer.id !== "countries-label" || layer.type !== "symbol") return layer;

        return {
          ...layer,
          layout: {
            ...layer.layout,
            "text-field": "{NAME}",
            "text-padding": 0,
          },
        };
      }),
  };
}

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const selectedCountryId = useRef("");
  const clearSelection = useRef<() => void>(() => { });

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

      const countryLayers = ["countries-fill", "countries-label"];
      let hoveredCountryId: string | undefined;

      const findCountry = (point: { x: number; y: number }) => {
        const exact = map?.queryRenderedFeatures([point.x, point.y], { layers: countryLayers })[0];
        if (exact) return exact;

        const radius = 5;
        return map?.queryRenderedFeatures(
          [
            [point.x - radius, point.y - radius],
            [point.x + radius, point.y + radius],
          ],
          { layers: ["countries-fill"] },
        )[0];
      };

      map.once("load", () => {
        const countryBoundaryLayer = "countries-boundary";
        const baseBoundaryFilter = map?.getFilter(countryBoundaryLayer);
        const updateCountryBoundary = () => {
          if (!map || !map.getLayer(countryBoundaryLayer)) return;

          map.setFilter(countryBoundaryLayer, selectedCountryId.current
            ? ["!", ["==", ["get", "ADM0_A3"], selectedCountryId.current]]
            : baseBoundaryFilter ?? ["all"]);
        };
        clearSelection.current = () => {
          selectedCountryId.current = "";
          if (map?.getLayer(countryBoundaryLayer)) {
            map.setFilter(countryBoundaryLayer, baseBoundaryFilter ?? ["all"]);
          }
          map?.setFilter("country-selection-fill", ["==", ["get", "ADM0_A3"], ""]);
          setSelectedCountry(null);
        };

        map?.addLayer({
          id: "country-selection-fill",
          type: "fill",
          source: "maplibre",
          "source-layer": "countries",
          filter: ["==", ["get", "ADM0_A3"], ""],
          paint: {
            "fill-color": "#f15a38",
            "fill-opacity": 0.48,
          },
        }, "countries-label");
        map?.addLayer({
          id: "country-hover-fill",
          type: "fill",
          source: "maplibre",
          "source-layer": "countries",
          filter: ["==", ["get", "ADM0_A3"], ""],
          paint: { "fill-color": "#ffffff", "fill-opacity": 0.28 },
        }, "countries-label");

        map?.on("click", (event) => {
          const country = findCountry(event.point)?.properties;
          if (typeof country?.NAME === "string" && typeof country?.ADM0_A3 === "string") {
            if (selectedCountryId.current === country.ADM0_A3) {
              selectedCountryId.current = "";
              updateCountryBoundary();
              map?.setFilter("country-selection-fill", ["==", ["get", "ADM0_A3"], ""]);
              setSelectedCountry(null);
              return;
            }

            selectedCountryId.current = country.ADM0_A3;
            updateCountryBoundary();
            map?.setFilter("country-selection-fill", ["==", ["get", "ADM0_A3"], country.ADM0_A3]);
            setSelectedCountry(country.NAME);
          } else {
            selectedCountryId.current = "";
            updateCountryBoundary();
            map?.setFilter("country-selection-fill", ["==", ["get", "ADM0_A3"], ""]);
            setSelectedCountry(null);
          }
        });

        map?.on("mousemove", (event) => {
          const country = findCountry(event.point)?.properties;
          const id = typeof country?.ADM0_A3 === "string" ? country.ADM0_A3 : undefined;
          if (id !== hoveredCountryId) {
            hoveredCountryId = id;
            map?.setFilter("country-hover-fill", ["==", ["get", "ADM0_A3"], id ?? ""]);
          }
          map!.getCanvas().style.cursor = id ? "pointer" : "";
        });

        map?.getCanvas().addEventListener("mouseleave", () => {
          hoveredCountryId = undefined;
          map?.setFilter("country-hover-fill", ["==", ["get", "ADM0_A3"], ""]);
          if (map) map.getCanvas().style.cursor = "";
        });
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
      {selectedCountry && (
        <aside className="country-card" aria-live="polite">
          <span>Selected country</span>
          <strong>{selectedCountry}</strong>
          <button
            type="button"
            aria-label="Clear selected country"
            onClick={() => {
              clearSelection.current();
            }}
          >
            x
          </button>
        </aside>
      )}
    </main>
  );
}
