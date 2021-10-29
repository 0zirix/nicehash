require('dotenv').config();
const Nicehash = require('../nicehash');
const api = require('../endpoints');

let nh = new Nicehash();

(async () => {
    let rates = await nh.request({
        host: 'blockchain.info',
        port: 443,
        method: 'GET',
        path: '/ticker'
    });

    let BTC_TO_EUR = rates['EUR'].last;
    let btc_addr = await nh.get(api.accounting.DEPOSIT_ADDRESS, {query: {currency: 'BTC'}});
    let wallet = await nh.get(nh.format(api.accounting.BALANCE, {currency: 'BTC'}));

    console.table({
        'Sandbox': nh.options.sandbox,
        'Api URI': nh.options.url,
        'Locale': nh.options.locale,
        'Server time': new Date(nh.time).toUTCString(),
        'Server ping (ms)': nh.ping,
        'Exchange rate': BTC_TO_EUR,
        'Wallet Address': btc_addr.list[0].address,
        'Balance BTC': parseFloat(wallet.totalBalance),
        'Balance EUR': +(parseFloat(wallet.totalBalance) * BTC_TO_EUR).toFixed(2)
    })
})();
