import { describe, expect, it } from "bun:test";
import {
  addressParts,
  distanceMeters,
  findSavedPlace,
  formatAddress,
  formatDistance,
  locationLines,
  upsertSavedPlace,
  type SavedPlace,
} from "../../src/location/places";

describe("dirección en tres niveles", () => {
  const place = { name: "Mz 171 - Lt 12", street: "Av. José Carlos Mariátegui", district: "Huaycán Zona M", subregion: "Ate", city: "Lima", region: "Lima Metropolitana" };

  it("toma el nombre como línea principal, el barrio y el distrito con la región", () => {
    expect(addressParts(place)).toEqual({ primary: "Mz 171 - Lt 12", secondary: "Huaycán Zona M", tertiary: "Ate · Lima Metropolitana" });
    expect(formatAddress(place)).toBe("Mz 171 - Lt 12, Huaycán Zona M, Lima");
  });

  it("sin nombre propio, la calle con su número", () => {
    expect(addressParts({ name: "450", street: "Av. Grau", streetNumber: "450", city: "Lima", region: "Lima" })).toEqual({
      primary: "Av. Grau 450",
      secondary: null,
      tertiary: "Lima",
    });
  });

  it("las líneas que se muestran, con partes o desde lo guardado antes", () => {
    expect(locationLines({ parts: addressParts(place) })).toEqual({ primary: "Mz 171 - Lt 12", secondary: "Huaycán Zona M, Ate" });
    expect(locationLines({ formattedAddress: "Tambo+, Huaycán, Lima" })).toEqual({ primary: "Tambo+", secondary: "Huaycán, Lima" });
    expect(locationLines({ formattedAddress: null })).toEqual({ primary: null, secondary: null });
  });
});

describe("distancias y lugares guardados", () => {
  const home: SavedPlace = { id: "h", name: "Casa", kind: "home", latitude: -12.0, longitude: -76.9, formattedAddress: null };

  it("mide y formatea", () => {
    const d = distanceMeters({ latitude: -12.0, longitude: -76.9 }, { latitude: -12.0003, longitude: -76.9 });
    expect(Math.round(d)).toBe(33);
    expect(formatDistance(12.4)).toBe("12 m");
    expect(formatDistance(1234)).toBe("1.2 km");
  });

  it("reconoce un lugar a menos de 50 m", () => {
    expect(findSavedPlace([home], { latitude: -12.0003, longitude: -76.9 })?.name).toBe("Casa");
    expect(findSavedPlace([home], { latitude: -12.001, longitude: -76.9 })).toBeNull();
  });

  it("guardar reemplaza el cercano y deja una sola Casa", () => {
    const other: SavedPlace = { id: "o", name: "Gimnasio", kind: "other", latitude: -12.05, longitude: -76.95, formattedAddress: null };
    const movedHome: SavedPlace = { ...home, id: "h2", latitude: -12.1, longitude: -77 };
    expect(upsertSavedPlace([home, other], movedHome).map((p) => p.id)).toEqual(["h2", "o"]);
    const renamed: SavedPlace = { ...home, id: "h3", name: "Trabajo", kind: "work" };
    expect(upsertSavedPlace([home, other], renamed).map((p) => p.id)).toEqual(["h3", "o"]);
  });
});
