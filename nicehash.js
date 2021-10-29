const https = require('https');
const crypto = require('crypto');
const qs = require('querystring');

const SANDBOX_API_URI = 'api-test.nicehash.com';
const PRODUCTION_API_URI = 'api2.nicehash.com';

module.exports = class Nicehash {
    constructor(options = {}) {
        this.options = {
            sandbox: options.sandbox || process.env.NH_SANDBOX || true,
            url: options.url || SANDBOX_API_URI,
            locale: options.locale || process.env.NH_LOCALE || 'en',
            key: options.key || process.env.NH_KEY || null,
            secret: options.secret || process.env.NH_SECRET || null,
            org_id: options.org_id || process.env.NH_ORG_ID || '',
        };

        if (this.options.sandbox === 'false') {
            this.options.sandbox = false;
            this.options.url = PRODUCTION_API_URI;
        }

        this.ping = null;
        this.time = null;
    }

    format(str, ...args) {
        if (args.length) {
            const params = (typeof args[0] == 'string' || typeof args[0] === 'number')
                ? Array.prototype.slice.call(args)
                : args[0];

            for (let key in params)
                str = str.replace(new RegExp('\\{' + key + '\\}', 'gi'), params[key]);
        }

        return str;
    };

    request(options, body = null) {
        return new Promise((resolve, reject) => {
            const socket = https.request(options, handle => {
                let output = '';
                handle.on('data', data => output += data.toString());
                handle.on('end', () => {
                    try {
                        resolve(JSON.parse(output));
                    } catch (e) {
                        console.log('OUTPUT', options, output)
                        reject(e);
                    }
                });
            });

            socket.on('error', reject);

            if (options.method === 'POST' && body)
                socket.write(body);

            socket.end();
        });
    }

    async api_call(method, endpoint, {query, body, time} = {}) {
        try {
            if (this.time === null) {
                let timing = await this.get_time();
                this.ping = timing.serverTime - (new Date().getTime());
                this.time = timing.serverTime;
            }

            let nonce = crypto.randomUUID();
            let timestamp = (time || (+new Date() + this.ping)).toString();
            let auth = this.getAuthHeader(nonce, timestamp, method, endpoint, query, body);

            return await this.request({
                host: this.options.url,
                path: endpoint + '?' + qs.stringify(query),
                port: 443,
                method: method,
                headers: {
                    'X-Request-Id': nonce,
                    'X-User-Agent': 'NHNodeClient',
                    'X-Time': timestamp,
                    'X-Nonce': nonce,
                    'X-User-Lang': this.options.locale,
                    'X-Organization-Id': this.options.org_id,
                    'X-Auth': auth
                }
            }, body);
        } catch (error) {
            console.log('API CALL ERROR', error);
        }
    }

    getAuthHeader(nonce, timestamp, method, endpoint, query = null, body = null) {
        const hmac = crypto.createHmac('SHA256', this.options.secret);

        hmac.update(this.options.key);
        hmac.update('\0')
        hmac.update(timestamp);
        hmac.update('\0');
        hmac.update(nonce);
        hmac.update('\0');
        hmac.update('\0');

        if (this.options.org_id)
            hmac.update(this.options.org_id);

        hmac.update('\0');
        hmac.update('\0');
        hmac.update(method);
        hmac.update('\0');
        hmac.update(endpoint);
        hmac.update('\0');

        if (query)
            hmac.update(typeof query === 'object' ? qs.stringify(query) : query);

        if (body) {
            hmac.update('\0');
            hmac.update(typeof body === 'object' ? qs.stringify(body) : body);
        }

        return `${this.options.key}:${hmac.digest('hex')}`;
    }

    async get_time() {
        return await this.request({
            host: this.options.url,
            path: '/api/v2/time',
            method: 'GET'
        });
    }

    async get(endpoint, options = {}) {
        return await this.api_call('GET', endpoint, options)
    }

    async post(endpoint, options = {}) {
        return await this.api_call('POST', endpoint, options)
    }

    async put(endpoint, options = {}) {
        return await this.api_call('PUT', endpoint, options)
    }

    async delete(endpoint, options = {}) {
        return await this.api_call('DELETE', endpoint, options)
    }
}