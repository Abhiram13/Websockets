import * as http from 'http';
import * as Hash from 'crypto';
import {Duplex} from 'stream';
import {EventEmitter} from 'events';

interface IWebSocketOptions {
   port: number;
}

class WebSocketEvents {
   /** Calls when websocket server receives data from client */
   static get onData() {
      return "data";
   }

   static get onConnection() {
      return "connected";
   }
}

/**
 * @tutorial https://gist.github.com/yakovenkodenis/083c3a9443e09b7e0f08c92222373799#file-ws-js
 */
class Websocket extends EventEmitter {
   options: IWebSocketOptions;

   constructor(options: IWebSocketOptions) {
      super();
      this.options = options;
      this.#upgradeSocket();
   }

   /** @private */
   #upgradeSocket() {
      const websocket = http.createServer();

      websocket.listen(this.options?.port || 3000).on('upgrade', (req, socket, head) => {
         let value: string = '';

         if (req?.headers['upgrade'] === 'websocket') {
            value = generateValue(req?.headers['sec-websocket-key']);
         };

         socket.write(
            'HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
            'Upgrade: WebSocket\r\n' +
            'Connection: Upgrade\r\n' +
            `Sec-WebSocket-Accept:${value}\r\n` +
            '\r\n'
         );

         socket.on('data', (chunk) => {
            this.emit(WebSocketEvents.onData, decodeMessage(chunk), (data: any) => {
               const maskedData = createFrame(data);
               socket.write(maskedData);
            });
         });
      });
   }
}

const sock = new Websocket({port: 3001});

sock.on(WebSocketEvents.onData, (message, write) => {
   console.log('Message from client. -> ', message);
   write('This is a reply from socket server to client!');
});

function createFrame(data: any) {
   const payload = JSON.stringify(data);

   const payloadByteLength = Buffer.byteLength(payload);
   let payloadBytesOffset = 2;
   let payloadLength = payloadByteLength;

   if (payloadByteLength > 65535) { // length value cannot fit in 2 bytes
      payloadBytesOffset += 8;
      payloadLength = 127;
   } else if (payloadByteLength > 125) {
      payloadBytesOffset += 2;
      payloadLength = 126;
   }

   const buffer = Buffer.alloc(payloadBytesOffset + payloadByteLength);

   // first byte
   buffer.writeUInt8(0b10000001, 0); // [FIN (1), RSV1 (0), RSV2 (0), RSV3 (0), Opode (0x01 - text frame)]

   buffer[1] = payloadLength; // second byte - actual payload size (if <= 125 bytes) or 126, or 127

   if (payloadLength === 126) { // write actual payload length as a 16-bit unsigned integer
      buffer.writeUInt16BE(payloadByteLength, 2);
   } else if (payloadByteLength === 127) { // write actual payload length as a 64-bit unsigned integer
      buffer.writeBigUInt64BE(BigInt(payloadByteLength), 2);
   }

   buffer.write(payload, payloadBytesOffset);
   return buffer;
}

function decodeMessage(buffer: Buffer) {
   if ((buffer.readUInt8(0) & 0xF) === 0x1) {
      const length = (buffer.readUInt8(1) & 0x7F) + 4;

      let currentOffset = 2;
      const mask_key = buffer.readUInt32BE(2);
      const data = Buffer.alloc(length);

      for (let i = 0, j = 0; i < length; ++i, j = i % 4) {
         const shift = j === 3 ? 0 : (3 - j) << 3;
         const mask = (shift === 0 ? mask_key : (mask_key >>> shift)) & 0xFF;
         const source = buffer.readUInt8(currentOffset++);
         data.writeUInt8(mask ^ source, i);
      }

      return data.toString('utf8');
   } else {
      return null;
   }
}

function generateValue(key: any) {
   return Hash
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary')
      .digest('base64');
}