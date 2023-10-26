import * as http from 'http';
import * as Hash from 'crypto';
import {Duplex} from 'stream';

class WebSocket {
   listen(port: number, callback: (sc: Duplex) => void) {
      const websocket = http.createServer();
      
      websocket.listen(port).on('upgrade', (req, socket, head) => {
         let value: string = '';
      
         if (req?.headers['upgrade'] === 'websocket') {
            value = generateValue(req?.headers['sec-websocket-key']);
         };

         console.log(port, value);
      
         socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
            'Upgrade: WebSocket\r\n' +
            'Connection: Upgrade\r\n' +
            `Sec-WebSocket-Accept:${value}\r\n` +
            '\r\n');

         callback(socket);
      });
   }
}
const socket = new WebSocket().listen;

socket(3001, (sc) => {
   sc.on('data', (chunk: Buffer) => {
      console.log('Date from socket: ', decodeMessage(chunk));
   });
})

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