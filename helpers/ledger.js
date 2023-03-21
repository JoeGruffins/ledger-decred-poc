import * as wallet from './wallet'
import { rawHashToHex, rawToHex, hexToRaw, strHashToRaw } from './bytes'
import * as secp256k1 from'secp256k1'
import { default as blake } from 'blake-hash'
import * as bs58 from 'bs58'
import toBuffer from 'typedarray-to-buffer'

export function addressPath (index, branch) {
  const prefix = "44'/42'/0'/"
  const i = (index || 0).toString()
  const b = (branch || 0).toString()
  return prefix + b + "/" + i
}

export function pubkeyToHDPubkey(pubkey, chainCode) {
  const pk = secp256k1.publicKeyConvert(hexToRaw(pubkey), true) // from uncompressed to compressed
  const cc = hexToRaw(chainCode)
  const hdPublicKeyID = hexToRaw("043587d1") // testnet specific
	const parentFP = hexToRaw("00000000") // not true but we dont know the fingerprint
	const childNum = hexToRaw("80000000") // always first hardened child
  const depth = 2 // account is depth 2
  const buff = new Uint8Array(78) // 4 network identifier + 1 depth + 4 parent fingerprint + 4 child number + 32 chain code + 33 compressed public key
  let i = 0
  buff.set(hdPublicKeyID, i)
  i += 4
  buff[i] = depth
  i += 1
  buff.set(parentFP, i)
  i += 4
  buff.set(childNum, i)
  i += 4
  buff.set(cc, i)
  i += 32
  buff.set(pk, i)
  const firstPass = blake('blake256').update(Buffer.from(buff)).digest()
  const secondPass = blake('blake256').update(firstPass).digest()
  const fullSerialize = Buffer.concat([Buffer.from(buff), secondPass.slice(0, 4)])
  return bs58.encode(fullSerialize);
}

// /**
//  */
// export interface TransactionInput {
//   prevout: Buffer;
//   script: Buffer;
//   sequence: Buffer;
//   tree?: Buffer;
// }
//
// /**
//  */
// export interface TransactionOutput {
//   amount: Buffer;
//   script: Buffer;
// }
//
// /**
//  */
// export interface Transaction {
//   version: Buffer;
//   inputs: TransactionInput[];
//   outputs?: TransactionOutput[];
//   locktime?: Buffer;
//   witness?: Buffer;
//   timestamp?: Buffer;
//   nVersionGroupId?: Buffer;
//   nExpiryHeight?: Buffer;
//   extraData?: Buffer;
// }
//
// export interface TrustedInput {
//   trustedInput: boolean;
//   value: Buffer;
//   sequence: Buffer;
// }

function writeUint16LE(n) {
    var buff = new Buffer(2);
    buff.writeUInt16LE(n, 0)
    return buff
}

function writeUint32LE(n) {
    var buff = new Buffer(4);
    buff.writeUInt32LE(n, 0)
    return buff
}

function writeUint32BE(n) {
    var buff = new Buffer(4);
    buff.writeUInt32BE(n, 0)
    return buff
}

function writeUint64LE(n) {
    var buff = new Buffer(8);
    buff.writeBigUInt64LE( BigInt(n), 0)
    return buff
}

function inputToTx(tx) {
  const inputs = []
  for (let inp of tx.inputsList) {
    let prevScript
    const sequence = writeUint32LE(inp.sequence)
    const tree = new Uint8Array(1)
    tree[0] = inp.tree
    const prevout = new Uint8Array(36)
    prevout.set(strHashToRaw(inp.previousTransactionHash), 0)
    prevout.set(writeUint32LE(inp.previousTransactionIndex), 32)
    const input = {
     prevout: toBuffer(prevout),
     script: toBuffer(new Uint8Array(25)),
     sequence: sequence,
     tree: toBuffer(tree),
    }
    inputs.push(input)
  }
  const outputs = []
  for (let out of tx.outputsList) {
    const output = {
      amount: writeUint64LE(out.value),
      script: Buffer.from(out.script, "hex"),
    }
    outputs.push(output)
  }
  return {
    version: writeUint32LE(tx.version), // Pretty sure this is a uint16 but ledger does not want that.
    inputs: inputs,
    outputs: outputs,
    locktime: writeUint32LE(tx.lockTime),
    nExpiryHeight: writeUint32LE(tx.expiry),
  }
}

// # Commit to the relevant transaction outputs.
// prefixBuf += putVarInt(len(txOuts))
//
// for txOutIdx, txOut in enumerate(txOuts):
//     # Commit to the output amount, script version, and
//     # public key script.  In the case of SigHashSingle,
//     # commit to an output amount of -1 and a nil public
//     # key script for everything that is not the output
//     # corresponding to the input being signed instead.
//     value = txOut.value
//     pkScript = txOut.pkScript
//     if hashType & sigHashMask == SigHashSingle and txOutIdx != idx:
//         value = MAX_UINT64
//         pkScript = b""
//     prefixBuf += ByteArray(value, length=8).littleEndian()
//     prefixBuf += ByteArray(txOut.version, length=2).littleEndian()
//     prefixBuf += putVarInt(len(pkScript))
//     prefixBuf += pkScript

export function createPrefix(tx) {
  let numOuts = tx.outputsList.length
  if (numOuts > 2) { throw "more than two outputs is not expected" }
  let buffLen = 1
  for ( let out of tx.outputsList) {
    buffLen += 11 + out.script.length / 2 // script in hex atm
  }
  const buff = new Uint8Array(buffLen) // 1 varInt + ( 8 value + 2 tx version + 1 varInt + (23/25?) variable script length) * number of outputs
  let i = 0
  buff[i] = numOuts
  i += 1
  for ( let out of tx.outputsList) {
    buff.set(writeUint64LE(out.value), i)
    i += 8
    buff.set(writeUint16LE(out.version), i)
    i += 2
    // TODO: Clean this up for production? Should use smarter logic to get varInts.
    buff[i] = out.script.length / 2 // varInt for 23/25 bytes
    i += 1
    buff.set(Buffer.from(out.script, "hex"), i)
    i += out.script.length / 2
  }
  return toBuffer(buff)
}

// export type CreateTransactionArg = {
//   inputs: Array<
//     [Transaction, number, string | null | undefined, number | null | undefined]
//   >;
//   associatedKeysets: string[];
//   changePath?: string;
//   outputScriptHex: string;
//   lockTime?: number;
//   sigHashType?: number;
//   segwit?: boolean;
//   initialTimestamp?: number;
//   additionals: Array<string>;
//   expiryHeight?: Buffer;
//   useTrustedInputForSegwit?: boolean;
//   onDeviceStreaming?: (arg0: {
//     progress: number;
//     total: number;
//     index: number;
//   }) => void;
//   onDeviceSignatureRequested?: () => void;
//   onDeviceSignatureGranted?: () => void;
// };

export async function signArgs(txHex, wsvc, decodeSvc, debugLog) {
  const tx = await wallet.decodeTransaction(decodeSvc, txHex)
  debugLog('Unsigned tx')
  debugLog(JSON.stringify(tx))
  const inputTxs = await wallet.getInputTransactions(wsvc, decodeSvc, tx)
  debugLog('Tx inputs')
  debugLog(JSON.stringify(inputTxs))
  const inputs = []
  const paths = []
  let i = 0
  for ( let inp of inputTxs ) {
    const prevOut = inputToTx(inp)
    const idx = tx.inputsList[i].previousTransactionIndex
    inputs.push([prevOut, idx])
    const addrs = inp.outputsList[idx].addressesList
    if (addrs.length != 1) throw "unexpected spending from multisig"
    const val = await wallet.validateAddress(wsvc, addrs[0])
    const acct = val.getAccountNumber().toString()
    const branch = val.getIsInternal() ? "1" : "0"
    const index = val.getIndex().toString()
    paths.push("44'/42'/" + acct + "'/" + branch + "/" + index)
    i++
  }
  let changePath = null
  for ( let out of tx.outputsList ) {
    if (out.addressesList.length != 1) { continue }
    const addr = out.addressesList[0]
    const val = await wallet.validateAddress(wsvc, addr)
    if (!val.getIsInternal()) { continue } // assume the internal address is change
    const acct = val.getAccountNumber().toString()
    const index = val.getIndex().toString()
    changePath = "44'/42'/" + acct + "'/1/" + index
    break
  }

  return {
    inputs: inputs,
    associatedKeysets: paths,
    changePath: changePath,
    outputScriptHex: createPrefix(tx),
    lockTime: tx.lockTime,
    sigHashType: 1, // SIGHASH_ALL
    segwit: false,
    expiryHeight: writeUint32LE(tx.expiry),
    useTrustedInputForSegwit: false,
    additionals: ["decred"],
    onDeviceStreaming: (_e) => {},
    onDeviceSignatureGranted: () => {},
    onDeviceSignatureRequested: () => {},
  }
}
