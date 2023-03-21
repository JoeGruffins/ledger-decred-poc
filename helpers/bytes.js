export function rawHashToHex(raw) {
  return reverseHash(Buffer.from(raw).toString("hex"))
}

export function strHashToRaw(hash) {
  return new Uint8Array(Buffer.from(hash, "hex").reverse());
}

export function rawToHex(bin) {
  return Buffer.from(bin).toString("hex")
}

export function hexToRaw(hex) {
  return new Uint8Array(Buffer.from(hex, "hex"));
}

export function sixFourToHex(raw) {
  return Buffer.from(raw, 'base64').toString('hex')
}

export function sixFourReversedToHex(raw) {
  return reverseHash(Buffer.from(raw, 'base64').toString('hex'))
}

export function reverseHash(s) {
  s = s.replace(/^(.(..)*)$/, "0$1"); // add a leading zero if needed
  var a = s.match(/../g);             // split number in groups of two
  a.reverse();                        // reverse the groups
  var s2 = a.join("");
  return s2;
}
