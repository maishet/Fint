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

  it("marca el código si es incorrecto o ya venció", () => {
    expect(authErrorFor("Token has expired or is invalid")).toEqual({ field: "code", key: "loginScreen.invalidCode" });
  });

  it("avisa sin campo cuando se pide otro código demasiado pronto", () => {
    const tooSoon = { field: null, key: "loginScreen.resendTooSoon" };
    expect(authErrorFor("For security purposes, you can only request this after 52 seconds.")).toEqual(tooSoon);
    expect(authErrorFor("Email rate limit exceeded")).toEqual(tooSoon);
  });

  it("deja sin campo un error desconocido", () => {
    expect(authErrorFor("Network request failed")).toEqual({ field: null, key: null });
  });
});
