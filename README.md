# Ledger/Decrediton POC integration

Various tests and functions to help with integration between
[Ledger](https://www.ledger.com/) devices and
[Decrediton](https://github.com/decred/decrediton).

**Only intended for decred testnet use.**

## What you need
The following programs:
  - Node: 14.16.1
  - Npm: 6.4+
  - Yarn: 1.12+
  - Dcrwallet: 1.7.5

You also need a working ledger with the ledger decred testnet app installed. Install the app through ledger live after turning on "Developer mode" in the "Experimental features" tab.


## Running
In the root directory:
```
yarn install
yarn dev
```

When the app starts press "m" to get your pubkey and then "q" to quit. The pubkey can be copied from the "log.txt" file that is created when using the app.

Now create a spv watching only dcrwallet using the pubkey.
```
dcrwallet --testnet --createwatchingonly
```
Enter the pubkey when propted.

You will need to set up grpc certificates. Install [gencerts](https://github.com/decred/dcrd/tree/master/cmd/gencerts). Now go to your dcrwallet directory, for example `~/.dcrwallet`, and do:
```
gencerts clients.pem clients.key
```

Run the wallet with the --spv flag and let it sync. You may also want to set the gap limit if you will not be sending the txn you produce:
```
dcrwallet --testnet --spv
```

Go back to this app's root directory and copy the config.js.sample -> config.js adjusting the values as necessary.

Now this app should be set up to run in connection with dcrwallet to verify addresses and send transactions.
