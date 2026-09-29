import { describe, expect, it } from "bun:test";
import { authErrorFor } from "../../src/auth/authErrors";

describe("authErrorFor", () => {
  it("marca la contraseña con credenciales incorrectas", () => {
    expect(authErrorFor("Invalid login credentials")).toEqual({ field: "password", key: "auth.invalidCredentials" });
  });

  it("marca el correo si no está confirmado o ya existe", () => {
    expect(authErrorFor("Email not confirmed")).toEqual({ field: "email", key: "auth.emailNotConfirmed" });
    expect(authErrorFor("User already registered")).toEqual({ field: "email", key: "auth.alreadyRegistered" });
  });

  it("deja sin campo un error desconocido", () => {
    expect(authErrorFor("Network request failed")).toEqual({ field: null, key: null });
  });
});
