// Minimal Bitcoin SV transaction decoder for Chronicle Step 1.
// We only decode outputs (vout, satoshis, scriptHex) from rawTxHex so that
// BEEF bundles can be summarized into UTXO-like records for coverage.

export type DecodedTxOutput = {
  vout: number;
  satoshis: number;
  scriptHex: string;
};

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().replace(/^0x/, "").toLowerCase();
  if (normalized.length === 0 || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex length");
  }
  if (!/^[0-9a-f]+$/.test(normalized)) {
    throw new Error("Invalid hex characters");
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readVarInt(bytes: Uint8Array, offset: number): [value: number, nextOffset: number] {
  if (offset >= bytes.length) {
    throw new Error("VarInt out of range");
  }
  const first = bytes[offset];
  if (first < 0xfd) {
    return [first, offset + 1];
  }
  if (first === 0xfd) {
    if (offset + 2 >= bytes.length) throw new Error("VarInt 0xfd out of range");
    const value = bytes[offset + 1] | (bytes[offset + 2] << 8);
    return [value, offset + 3];
  }
  if (first === 0xfe) {
    if (offset + 4 >= bytes.length) throw new Error("VarInt 0xfe out of range");
    let value = 0;
    let mul = 1;
    for (let i = 0; i < 4; i++) {
      value += bytes[offset + 1 + i] * mul;
      mul *= 256;
    }
    return [value, offset + 5];
  }
  // 0xff: 8-byte little-endian. Use BigInt internally then clamp to Number.
  if (offset + 8 >= bytes.length) throw new Error("VarInt 0xff out of range");
  let value = 0;
  let mul = 1;
  for (let i = 0; i < 8; i++) {
    value += bytes[offset + 1 + i] * mul;
    mul *= 256;
  }
  return [value, offset + 9];
}

function readUint64LE(bytes: Uint8Array, offset: number): [value: number, nextOffset: number] {
  if (offset + 8 > bytes.length) {
    throw new Error("uint64 out of range");
  }
  let value = 0;
  let mul = 1;
  for (let i = 0; i < 8; i++) {
    value += bytes[offset + i] * mul;
    mul *= 256;
  }
  return [value, offset + 8];
}

export function decodeTxOutputs(rawTxHex: string): DecodedTxOutput[] {
  let bytes: Uint8Array;
  try {
    bytes = hexToBytes(rawTxHex);
  } catch {
    return [];
  }

  if (bytes.length < 4) return [];

  let offset = 0;

  // Skip version (4 bytes)
  offset += 4;
  if (offset >= bytes.length) return [];

  // Input count
  let vinCount: number;
  try {
    [vinCount, offset] = readVarInt(bytes, offset);
  } catch {
    return [];
  }

  // Skip each input: 32-byte txid, 4-byte vout, script, 4-byte sequence
  for (let i = 0; i < vinCount; i++) {
    if (offset + 36 > bytes.length) return [];
    offset += 36; // txid (32) + vout (4)
    let scriptLen: number;
    try {
      [scriptLen, offset] = readVarInt(bytes, offset);
    } catch {
      return [];
    }
    if (offset + scriptLen + 4 > bytes.length) return [];
    offset += scriptLen; // scriptSig
    offset += 4; // sequence
  }

  // Output count
  let voutCount: number;
  try {
    [voutCount, offset] = readVarInt(bytes, offset);
  } catch {
    return [];
  }

  const outputs: DecodedTxOutput[] = [];

  for (let vout = 0; vout < voutCount; vout++) {
    let value: number;
    try {
      [value, offset] = readUint64LE(bytes, offset);
    } catch {
      return outputs;
    }
    let scriptLen: number;
    try {
      [scriptLen, offset] = readVarInt(bytes, offset);
    } catch {
      return outputs;
    }
    if (offset + scriptLen > bytes.length) {
      return outputs;
    }
    const scriptBytes = bytes.slice(offset, offset + scriptLen);
    offset += scriptLen;

    outputs.push({
      vout,
      satoshis: value,
      scriptHex: bytesToHex(scriptBytes),
    });
  }

  return outputs;
}
