// Shared HMAC-SHA256 token verification
export async function verifyToken(tokenStr, secret) {
  try {
    const { d, s } = JSON.parse(atob(tokenStr));
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = new Uint8Array(s.match(/.{2}/g).map((h) => parseInt(h, 16)));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(d));
    if (!valid) return null;
    return JSON.parse(d);
  } catch {
    return null;
  }
}
