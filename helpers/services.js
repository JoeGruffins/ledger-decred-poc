import fs from "fs";
import * as grpc from "@grpc/grpc-js";

export function getCert(certPath, log) {
  var cert;
  try {
    cert = fs.readFileSync(certPath);
  } catch (err) {
    if (err.code === "ENOENT") {
      log(certPath + " does not exist");
    } else if (err.code === "EACCES") {
      log(certPath + " permission denied");
    } else {
      log(certPath + " " + err);
    }
  }

  return (cert);
}

export function WalletCredentials(address, port, serverCert, clientCert, clientKey) {
  return {
    address: address || "127.0.0.1",
    port: port || 19576,
    serverCert: serverCert || "/home/user/.config/decrediton/wallets/testnet/trezor/rpc.cert",
    clientCert: clientCert || "/home/user/.config/decrediton/wallets/testnet/trezor/client.pem",
    clientKey: clientKey || "/home/user/.config/decrediton/wallets/testnet/trezor/client-key.pem",
  }
}

export function InitService(svcClass, creds, log) {
  // needed for node.js to use the correct cipher when connecting to dcrwallet
  process.env.GRPC_SSL_CIPHER_SUITES = "ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-SHA256:ECDHE-ECDSA-AES256-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384";

  var sslCreds = grpc.credentials.createSsl(getCert(creds.serverCert, log), getCert(creds.clientKey, log), getCert(creds.clientCert, log));
  var client = new svcClass(creds.address + ":" + creds.port, sslCreds);

  var deadline = new Date();
  var deadlineInSeconds = 30;
  deadline.setSeconds(deadline.getSeconds() + deadlineInSeconds);
  return new Promise((resolve, reject) => {
    grpc.waitForClientReady(client, deadline, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(client);
      }
    });
  });
}
