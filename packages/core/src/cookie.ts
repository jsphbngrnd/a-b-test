export type AssignmentCookie = {
  v: 1;
  vid: string;
  a: Record<string, string>;
  exp: number;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const pad = (4 - (value.length % 4)) % 4;
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(pad));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function signPayload(payload: string, secret: string): Promise<string> {
  const body = bytesToBase64Url(new TextEncoder().encode(payload));
  const signature = bytesToBase64Url(await hmac(secret, body));
  return `${body}.${signature}`;
}

export async function verifyPayload(token: string, secret: string): Promise<string | null> {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = bytesToBase64Url(await hmac(secret, body));
  if (!timingSafeEqual(expected, signature)) return null;
  try {
    return new TextDecoder().decode(base64UrlToBytes(body));
  } catch {
    return null;
  }
}

export async function sealAssignment(
  cookie: AssignmentCookie,
  secret: string,
): Promise<string> {
  return signPayload(JSON.stringify(cookie), secret);
}

export async function openAssignment(
  token: string | undefined,
  secret: string,
  nowSeconds = Date.now() / 1000,
): Promise<AssignmentCookie | null> {
  if (!token) return null;
  const json = await verifyPayload(token, secret);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as AssignmentCookie;
    if (parsed.v !== 1 || typeof parsed.vid !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (!parsed.a || typeof parsed.a !== "object") return null;
    if (parsed.exp < nowSeconds) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export function createVisitorId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const body = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${body}`;
}
