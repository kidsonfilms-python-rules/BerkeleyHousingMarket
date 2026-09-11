const base64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unbase64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export async function encryptForPanel(payload, recipients) {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  return Promise.all(recipients.map(async ({ address, publicKey }) => {
    const ephemeral = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
    const recipient = await crypto.subtle.importKey("raw", unbase64(publicKey), { name: "X25519" }, false, []);
    const bits = await crypto.subtle.deriveBits({ name: "X25519", public: recipient }, ephemeral.privateKey, 256);
    const aes = await crypto.subtle.importKey("raw", bits, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, plaintext);
    return { recipient: address.toLowerCase(), ephemeralPublicKey: base64(await crypto.subtle.exportKey("raw", ephemeral.publicKey)), iv: base64(iv), ciphertext: base64(ciphertext) };
  }));
}

export async function decryptPanelEnvelope(envelope, privateKeyBase64) {
  const privateKey = await crypto.subtle.importKey("pkcs8", unbase64(privateKeyBase64), { name: "X25519" }, false, ["deriveBits"]);
  const ephemeral = await crypto.subtle.importKey("raw", unbase64(envelope.ephemeralPublicKey), { name: "X25519" }, false, []);
  const bits = await crypto.subtle.deriveBits({ name: "X25519", public: ephemeral }, privateKey, 256);
  const aes = await crypto.subtle.importKey("raw", bits, { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(envelope.iv) }, aes, unbase64(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
