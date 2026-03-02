/**
 * ABSTRACTION-1: Unit tests for Supabase Service Abstraction Layer
 */
import { describe, it, expect } from "vitest";
import { db } from "./supabaseService";

describe("supabaseService", () => {
  it("exports db object with expected keys", () => {
    expect(db).toBeDefined();
    expect(db.query).toBeTypeOf("function");
    expect(db.insert).toBeTypeOf("function");
    expect(db.update).toBeTypeOf("function");
    expect(db.remove).toBeTypeOf("function");
    expect(db.storage).toBeDefined();
    expect(db.storage.upload).toBeTypeOf("function");
    expect(db.storage.download).toBeTypeOf("function");
    expect(db.storage.delete).toBeTypeOf("function");
    expect(db.auth).toBeDefined();
    expect(db.auth.getCurrentUser).toBeTypeOf("function");
    expect(db.auth.onAuthStateChange).toBeTypeOf("function");
    expect(db.functions).toBeDefined();
    expect(db.functions.invoke).toBeTypeOf("function");
    expect(db.realtime).toBeDefined();
    expect(db.realtime.subscribe).toBeTypeOf("function");
    expect(db.raw).toBeDefined();
  });
});
