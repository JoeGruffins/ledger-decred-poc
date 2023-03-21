import { randomBytes } from "crypto";

export function nodeRandomBytes(len) {
    return new Uint8Array(randomBytes(len))
}

export const globalCryptoShim = {
    randomBytes: nodeRandomBytes,
};
