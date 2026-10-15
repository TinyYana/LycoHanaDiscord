import { describe, expect, it } from "vitest";
import { type AdminRequestFacts, checkAdminRequest } from "./guard";

const OPTIONS = { port: 2615, csrfToken: "token-abc" };
const WRITE: AdminRequestFacts = {
  method: "POST",
  host: "127.0.0.1:2615",
  origin: "http://127.0.0.1:2615",
  contentType: "application/json",
  csrfToken: "token-abc",
};

const CASES: [string, AdminRequestFacts, ReturnType<typeof checkAdminRequest>][] = [
  ["GET on 127.0.0.1", { method: "GET", host: "127.0.0.1:2615" }, undefined],
  ["GET on localhost", { method: "GET", host: "localhost:2615" }, undefined],
  [
    "GET with own origin",
    { method: "GET", host: "localhost:2615", origin: "http://localhost:2615" },
    undefined,
  ],
  ["GET with foreign host (DNS rebinding)", { method: "GET", host: "evil.example:2615" }, "host"],
  ["GET with wrong port", { method: "GET", host: "127.0.0.1:80" }, "host"],
  ["GET without host", { method: "GET" }, "host"],
  [
    "GET with foreign origin",
    { method: "GET", host: "127.0.0.1:2615", origin: "http://evil.example" },
    "origin",
  ],
  ["valid write", WRITE, undefined],
  ["write with charset", { ...WRITE, contentType: "application/json; charset=utf-8" }, undefined],
  ["write with foreign host", { ...WRITE, host: "0.0.0.0:2615" }, "host"],
  ["PUT", { ...WRITE, method: "PUT" }, "method"],
  ["DELETE", { ...WRITE, method: "DELETE" }, "method"],
  ["write without origin", { ...WRITE, origin: undefined }, "origin"],
  ["write with foreign origin", { ...WRITE, origin: "http://evil.example" }, "origin"],
  ["write with null origin", { ...WRITE, origin: "null" }, "origin"],
  [
    "write with form content type",
    { ...WRITE, contentType: "application/x-www-form-urlencoded" },
    "content-type",
  ],
  ["write without content type", { ...WRITE, contentType: undefined }, "content-type"],
  ["write without csrf token", { ...WRITE, csrfToken: undefined }, "csrf"],
  ["write with wrong csrf token", { ...WRITE, csrfToken: "token-abd" }, "csrf"],
  ["write with shorter csrf token", { ...WRITE, csrfToken: "token" }, "csrf"],
];

describe("checkAdminRequest", () => {
  it.each(CASES)("%s", (_name, req, expected) => {
    expect(checkAdminRequest(req, OPTIONS)).toBe(expected);
  });
});
