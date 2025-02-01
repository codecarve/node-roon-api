"use strict";

// polyfill websockets in Node
if (typeof(WebSocket) == "undefined") global.WebSocket = require('ws');

function Transport(ip, port, logger) {
    this.host = ip;
    this.port = port;
    this.logger = logger;

    this.interval = null;
    this.is_alive = null;
    this.reconnectDelay = 5000; // 5 seconds delay before attempting to reconnect

    this.connect();
}

Transport.prototype.connect = function() {
    this.ws = new WebSocket("ws://" + this.host + ":" + this.port + "/api");
    if (typeof(window) != "undefined") this.ws.binaryType = 'arraybuffer';

    this.ws.on('pong', () => this.is_alive = true);
    this.ws.onopen = () => {
        this.is_alive = true;
        this.interval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                if (this.is_alive === false) {
                    this.logger.log(`Roon API Connection to ${this.host}:${this.port} closed due to missed heartbeat`);
                    return this.ws.terminate();
                }
                this.is_alive = false;
                this.ws.ping();
            } else {
                clearInterval(this.interval);
                this.interval = null;
            }
        }, 10000);

        this._isonopencalled = true;
        this.onopen();
    };

    this.ws.onclose = () => {
        this.is_alive = false;
        clearInterval(this.interval);
        this.interval = null;
        this.close();
        setTimeout(() => this.connect(), this.reconnectDelay); // Attempt to reconnect
    };

    this.ws.onerror = (err) => {
        this.logger.log("WebSocket error:", err);
        clearInterval(this.interval);
        this.interval = null;
        this.onerror();
    }

    this.ws.onmessage = (event) => {
        var msg = this.moo.parse(event.data);
        if (!msg) {
            this.close();
            return;
        }
        this.onmessage(msg);
    };
};

Transport.prototype.send = function(buf) {
    this.ws.send(buf, { binary: true, mask: true});
};

Transport.prototype.close = function() {
    if (this.ws) {
        this.ws.close();
        this.ws = undefined;
    }

    if (!this._onclosecalled && this._isonopencalled) {
        this._onclosecalled = true;
        this.onclose();
    }

    if (this.moo) {
        this.moo.clean_up();
        this.moo = undefined;
    }
};

Transport.prototype.onopen = function() { };
Transport.prototype.onclose = function() { };
Transport.prototype.onerror = function() { };
Transport.prototype.onmessage = function() { };

exports = module.exports = Transport;
