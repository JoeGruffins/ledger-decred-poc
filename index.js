import TransportNodeHid from "@ledgerhq/hw-transport-node-hid-singleton";
import getDeviceInfo from "@ledgerhq/live-common/lib/hw/getDeviceInfo";
import editDeviceName from "@ledgerhq/live-common/lib/hw/editDeviceName";
import { createTransaction } from "@ledgerhq/hw-app-btc/lib/createTransaction";
import { signMessage } from "@ledgerhq/hw-app-btc/lib/signMessage";
import Btc, { AddressFormat } from "@ledgerhq/hw-app-btc";
import * as ledgerHelpers from './helpers/ledger'
import * as wallet from './helpers/wallet'
import * as ui from './ui'
import { rawToHex } from './helpers/bytes'
import { InitService, WalletCredentials } from './helpers/services'
import { default as cfg } from "./config.js";
import * as grpc from "@grpc/grpc-js";

const proto = require("./dcrwallet-api/api_grpc_pb.js");
const services = grpc.loadPackageDefinition(proto).walletrpc;


// Handle the local config for wallet credentials and vsp config. Copy
// config.js.sample to config.js and adjust as needed.
try {
	require("./config.js");
} catch (error) {
	console.log("Create config.js file with the wallet config.")
	console.log(error);
	process.exit(1);
}
const walletCredentials = WalletCredentials(cfg.server, cfg.port,
  cfg.rpccert, cfg.clientcert, cfg.clientkey)

const coin = "decred"

// helpers
const log = ui.log
const debugLog = ui.debugLog
console.log = ui.debugLog
console.warn = ui.debugLog
console.error = ui.debugLog

// import { listen } from "@ledgerhq/logs";
// Works for debugging but causes some problems...
// listen((logit) => {
//   console.log(JSON.stringify(logit))
// })

async function doWithTransport (fn) {
  try {
    const transport = await TransportNodeHid.create()
    await fn(transport)
    return true
  } catch (error) {
    log(error.message)
    debugLog(JSON.stringify(error))
  }
}


const uiActions = {
  deviceInfo: async () => {
    log("Warning! Device must be on the homescreen.")
    doWithTransport ( async (transport) => {
      const devInfo = await getDeviceInfo(transport)
      log(JSON.stringify(devInfo))
    })
  },
  getAddress: async () => {
    log("Warning! The decred testnet app must be open on the device.")
    const res = await ui.queryInput('index [branch]')
    const args = res.split(' ')
    if (args.length < 1) return
    const path = ledgerHelpers.addressPath(args[0], args[1])
    doWithTransport ( async (transport) => {
      const btc = new Btc({ transport, currency: coin });
      const res = await btc.getWalletPublicKey(path, {
        verify: false,
      });
      log('Address at %s is %s', path, res.bitcoinAddress)
    })
  },
  getMasterPubkey: async () => {
    log("Warning! The decred testnet app must be open on the device.")
    doWithTransport ( async (transport) => {
      const btc = new Btc({ transport, currency: "decred" });
      const res = await btc.getWalletPublicKey("44'/42'/0'", {
        verify: false,
      });
      const hdpk = ledgerHelpers.pubkeyToHDPubkey(res.publicKey, res.chainCode)
      log('Master Pubkey for account at 44\'\/42\'\/0\' is %s', hdpk)
    })
  },
  validateAddress: async () => {
    log("Warning! Use getMasterPubkey and create a watching only wallet with that pubkey before proceeding.")
    try {
      const addr = await ui.queryInput('Address to validate', 'TsRnAPN8XhnjvhgPXwxdCW2nQyiTMg3F9gp')
      if (!addr) return
      const wsvc = await InitService(services.WalletService, walletCredentials, log)
      const resp = await wallet.validateAddress(wsvc, addr)

      const bool = b => b ? 'true' : 'false'
      log('Validating %s', addr)
      log('Valid=%s  Mine=%s  Script=%s  Account=%d  Internal=%s  Index=%d',
        bool(resp.getIsValid()), bool(resp.getIsMine()), bool(resp.getIsScript()),
        resp.getAccountNumber(), bool(resp.getIsInternal()), resp.getIndex())
      log('PubKeyAddress: %s', resp.getPubKeyAddr())
      log('PubKey: %s', rawToHex(resp.getPubKey()))
    } catch (error){
      log(error.message)
    }
  },
  changeLabel: async () => {
    log('Changing device label')
    log("Warning! Device must be on the homescreen.")
    const label = await ui.queryInput('New Label')
    log('Confirm on device.')
    doWithTransport ( async (transport) => {
      const res = await editDeviceName(transport, label)
    })
  },
  signTransaction: async () => {
    let arg, wsvc, decodeSvc
    try {
      log("Warning! The decred testnet app must be open on the device.")
      log("Warning! Use getMasterPubkey and create a watching only wallet with that pubkey before proceeding.")
      const destAddress = await ui.queryInput('Destination Address', 'TsREk6wnD45SU9NoVg4wxcGdZomKhqfshQK')
      if (!destAddress) return

      const destAmount = await ui.queryInput('Amount (in DCR)', '0.001')
      if (!destAmount) return

      wsvc = await InitService(services.WalletService, walletCredentials)
      decodeSvc = await InitService(services.DecodeMessageService, walletCredentials)
      debugLog('Got wallet services')

      const output = { destination: destAddress, amount: Math.floor(destAmount * 1e8) }

      const rawUnsigTx = await wallet.constructTransaction(wsvc, 0, 0, [output])
      debugLog('Got raw unsiged tx %s', Buffer.from(rawUnsigTx).toString("hex"))
      arg = await ledgerHelpers.signArgs(rawUnsigTx, wsvc, decodeSvc, debugLog)
    } catch ( error ) {
      log(error.message)
      debugLog(error)
      return
    }
    debugLog("Got the sign arg %s", JSON.stringify(arg))
    log("Sending tx to device. Please confirm the tx details there.")
    let res
    const ok = await doWithTransport ( async (transport) => {
      res = await createTransaction(transport, arg);
    })
    if (!ok) return
    log("Raw signed tx hash: %s", res)
    try {
      while (true) {
        let yn = await ui.queryInput('Would you like to send the transaction? y/n')
        yn = yn.toLowerCase()
        if (yn == "y" || yn == "yes") {
          break
        }
        if (yn == "n" || yn == "no") {
          return
        }
        log("yes or no?")
      }
      const tx = await wallet.publishTransaction(wsvc, res)
      log("Txid is %s", tx)
    } catch (error) {
      log(error.message)
      debugLog(error)
      return
    }
  },
  // This freezes my nano x "version":"2.1.0". Seems broken at the hardware level.
  // signMessage: async () => {
  //   const path = "44'/42'/0'/0/0"
  //   const message = "howdy"

  //   log("here we are", message, path)
  //   const messageHex = Buffer.from(message).toString("hex");
  //   doWithTransport ( async (transport) => {
  //     res = await signMessage(transport, { path, messageHex });
  //     log(res)
  //   })
  // }
}


// start of main procedure
ui.buildUI(uiActions)
ui.runUI()

