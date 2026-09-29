import { describe, expect, it } from "bun:test";
import { ONBOARDING_SLIDES, primaryAction, slideAt } from "../../src/onboarding/steps";

describe("primaryAction", () => {
  it("empieza con Comenzar y sigue con Siguiente", () => {
    expect(primaryAction(0, false)).toBe("start");
    expect(primaryAction(1, false)).toBe("next");
    expect(primaryAction(3, true)).toBe("next");
  });

  it("en la última pide el permiso hasta que la persona responda", () => {
    const last = ONBOARDING_SLIDES.length - 1;
    expect(primaryAction(last, false)).toBe("enableNotifications");
    expect(primaryAction(last, true)).toBe("finish");
  });
});

describe("slideAt", () => {
  it("toma el paso más cercano", () => {
    expect(slideAt(0, 400)).toBe(0);
    expect(slideAt(199, 400)).toBe(0);
    expect(slideAt(201, 400)).toBe(1);
    expect(slideAt(1600, 400)).toBe(4);
  });

  it("no se sale del rango", () => {
    expect(slideAt(-50, 400)).toBe(0);
    expect(slideAt(5000, 400)).toBe(ONBOARDING_SLIDES.length - 1);
    expect(slideAt(300, 0)).toBe(0);
  });
});
