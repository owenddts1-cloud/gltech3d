import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { loginSchema } from "@/lib/auth/schemas";
import { TOTPInput } from "@/components/auth/TOTPInput";

describe("Mobile login & MFA resilience", () => {
  describe("loginSchema mobile input sanitization", () => {
    it("trims trailing and leading whitespace from mobile auto-complete", () => {
      const parsed = loginSchema.safeParse({
        email: "  usuario@gltech3d.com.br \n ",
        password: "ValidPassword123!",
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.email).toBe("usuario@gltech3d.com.br");
      }
    });

    it("normalizes uppercase characters from mobile auto-capitalization to lowercase", () => {
      const parsed = loginSchema.safeParse({
        email: "Diretoria.GLTech@gmail.COM ",
        password: "ValidPassword123!",
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.email).toBe("diretoria.gltech@gmail.com");
      }
    });

    it("rejects invalid emails even after trimming", () => {
      const parsed = loginSchema.safeParse({
        email: "not-an-email ",
        password: "ValidPassword123!",
      });

      expect(parsed.success).toBe(false);
    });
  });

  describe("TOTPInput mobile one-time-code autofill", () => {
    it("distributes all 6 digits when mobile OS autofills into input 0", () => {
      const handleChange = vi.fn();
      const handleComplete = vi.fn();

      render(
        <TOTPInput
          value=""
          onChange={handleChange}
          onComplete={handleComplete}
        />,
      );

      const firstInput = screen.getByRole("textbox", { name: "Dígito 1" });

      // Simulates mobile browser QuickType autofill injecting all 6 digits
      fireEvent.change(firstInput, { target: { value: "654321" } });

      expect(handleChange).toHaveBeenCalledWith("654321");
      expect(handleComplete).toHaveBeenCalledWith("654321");
    });

    it("allows single digit manual entry with auto-advance", () => {
      const handleChange = vi.fn();
      const handleComplete = vi.fn();

      render(
        <TOTPInput
          value=""
          onChange={handleChange}
          onComplete={handleComplete}
        />,
      );

      const firstInput = screen.getByRole("textbox", { name: "Dígito 1" });

      fireEvent.change(firstInput, { target: { value: "9" } });

      expect(handleChange).toHaveBeenCalledWith("9");
      expect(handleComplete).not.toHaveBeenCalled();
    });
  });
});
