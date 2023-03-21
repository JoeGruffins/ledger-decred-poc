import { strHashToRaw, rawHashToHex, hexToRaw, sixFourToHex, sixFourReversedToHex } from "./bytes";
import { walletrpc as pb } from "../dcrwallet-api/api_pb";

export const getTransaction = (walletService, txHash) =>
  new Promise((resolve, reject) => {
    var request = new pb.GetTransactionRequest();
    var buffer = Buffer.isBuffer(txHash) ? txHash : strHashToRaw(txHash);
    request.setTransactionHash(buffer);
    walletService.getTransaction(request, (err, resp) => {
      if (err) {
        reject(err);
        return;
      }
      const tx = resp.getTransaction();
      resolve(tx);
    });
  });

export function verifyMessage(wsvcMsgVerif, addr, msg, sig) {
    const request = new pb.VerifyMessageRequest();
    request.setAddress(addr);
    request.setMessage(msg);
    request.setSignature(sig);
    return new Promise((resolve, reject) => wsvcMsgVerif
      .verifyMessage(request, (error, response) => error ? reject(error) : resolve(response)));
}

export const constructTransaction = (walletService, accountNum, confirmations, outputs) =>
  new Promise((resolve, reject) => {
    const totalAmount = outputs.reduce((tot, { amount }) => tot + amount, 0);
    const request = new pb.ConstructTransactionRequest();
    request.setSourceAccount(accountNum);
    request.setRequiredConfirmations(confirmations);
    request.setOutputSelectionAlgorithm(0);
    outputs.forEach(({ destination, amount }) => {
      const outputDest = new pb.ConstructTransactionRequest.OutputDestination();
      const output = new pb.ConstructTransactionRequest.Output();
      outputDest.setAddress(destination);
      output.setDestination(outputDest);
      output.setAmount(parseInt(amount));
      request.addNonChangeOutputs(output);
    });
    walletService.constructTransaction(request, (err, res) =>
      err ? reject(err) : resolve(res.getUnsignedTransaction()));
  });

export const decodeTransaction = (decodeMessageService, rawTx) =>
  new Promise((resolve, reject) => {
    var request = new pb.DecodeRawTransactionRequest();
    var buffer = Buffer.isBuffer(rawTx) ? rawTx : Buffer.from(rawTx, "hex");
    var buff = new Uint8Array(buffer);
    request.setSerializedTransaction(buff);
    decodeMessageService.decodeRawTransaction(request, (error, res) => {
      if (error) {
        return reject(error);
      }
      const tx = res.getTransaction().toObject()
      tx.transactionHash = sixFourToHex(tx.transactionHash)
      for (let inp of tx.inputsList) {
        inp.previousTransactionHash = sixFourReversedToHex(inp.previousTransactionHash)
        inp.signatureScript = sixFourToHex(inp.signatureScript)
      }
      for (let out of tx.outputsList) {
        out.script = sixFourToHex(out.script)
      }
      resolve(tx)
      })
    });

export const publishTransaction = (walletService, rawTx) =>
  new Promise((resolve, reject) => {
    var request = new pb.PublishTransactionRequest();
    var buffer = Buffer.isBuffer(rawTx) ? rawTx : Buffer.from(rawTx, "hex");
    var buff = new Uint8Array(buffer);
    request.setSignedTransaction(buff);
    walletService.publishTransaction(request, (error, resp) => {
      if (error) {
        reject(error);
      } else {
        resolve(rawHashToHex(resp.getTransactionHash()));
      }
    });
  });

// getInputTransactions returns the input transactions to the given source
// transaction (assumes srcTx was returned from decodeTransaction).
export const getInputTransactions = async (walletService, decodeMessageService, srcTx) => {
  const txs = [];
  for (let inp of srcTx.inputsList) {
    const inpTx = await getTransaction(walletService, inp.previousTransactionHash);
    const decodedInp = await decodeTransaction(decodeMessageService, inpTx.getTransaction());
    txs.push(decodedInp);
  }

  return txs;
}

export const validateAddress = (walletService, address) =>
  new Promise((resolve, reject) => {
    const request = new pb.ValidateAddressRequest();
    request.setAddress(address);
    walletService.validateAddress(request, (error, response) => error ? reject(error) : resolve(response));
  });
