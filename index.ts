import * as http from 'http';
import * as Hash from 'crypto';
import {EventEmitter} from 'events';

interface IWebSocketOptions {
   port: number;
}

class WebSocketEvents {
   /** Calls when websocket server receives data from client */
   static get onData() {
      return "data";
   }
}

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

         socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
            'Upgrade: WebSocket\r\n' +
            'Connection: Upgrade\r\n' +
            `Sec-WebSocket-Accept:${value}\r\n` +
            '\r\n');

         socket?.on('data', (chunk: Buffer) => {
            this.emit(WebSocketEvents.onData, chunk);
         });
      });
   }
}

const sock = new Websocket({port: 3001});

sock.on(WebSocketEvents.onData, (chunk: Buffer) => {
   console.log('Decoded here: ', decodeMessage(chunk));
});

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