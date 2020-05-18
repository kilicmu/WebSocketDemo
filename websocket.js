const EventEmitter = require('events');
const net = require('net');
const {parseHttpHeader,getDigest, encodeDataFrame} = require('./utils');
const { unmask } = require('ws/lib/buffer-util');
const { send } = require('process');

class WebSocket extends EventEmitter{
    constructor(options){
        super(options);
        this.options = options;
        this.server = net.createServer(this.listener);
        this.server.listen(options.port || 8808);
        
    }
    
    /**
     * 服务器的回调
     * @param {net.Socket} socket 
     */
    listener = (socket) => {
        socket.setKeepAlive = true;
        // 为socket添加send方法
        socket.send = (payloadData) => {
            let opcode;
            if(Buffer.isBuffer(payloadData)){
                opcode = 1;
            }else{
                opcode = 2;
                payloadData = Buffer.from(payloadData);
            }
            const buffer = encodeDataFrame({
                FIN: 1,
                PayloadData: payloadData,
                Opcode: opcode
            })
            socket.write(buffer);
        }

        socket.on("data", (chunk) => {
            // 此处协议切换
            if(chunk.toString().match(/Upgrade: websocket/)) {
                this.toUpgradeProtcol(socket, chunk.toString());
            }else{ //非协议切换
                this.toHandleMessage(socket, chunk);
            }
        })
        this.emit("connection", socket);
    }

    /**
     * 处理普通请求
     * @param {net.Socket} socket 
     * @param {Buffer} chunk 
     */
    toHandleMessage = (socket, chunk) => {
        // 拆分数据帧
        const FIN = ( chunk[0] & 0b10000000 ) === 0b10000000; //判断结束帧
        const opcode = chunk[0] & 0b00001111;
        const masked = ( chunk[1] & 0b10000000) === 0b10000000;
        const payloadLength = chunk[1] & 0b01111111;
        let payloadData;
        if(masked) {
            const maskingKey = chunk.slice(2, 6);
            payloadData = chunk.slice(6, 6 + payloadLength);
            unmask(payloadData, maskingKey);
        } else {
            payloadData = chunk.slice(6, 6 + payloadLength);
        }
        //判断当前数据帧是否是结束帧
        if(FIN){
            switch (opcode) {
                case 1:
                    socket.emit("message", payloadData.toString("utf8"));
                    break;
                case 2:
                    socket.emit("message", payloadData);
                    break;
                default:
                    //TODO 其他情况略
                    break;
            }
        }
    }

    /**
     * 为升级协议请求发送一个响应
     * @param {net.Socket} socket 
     * @param {string} chunk 
     */
    toUpgradeProtcol = (socket, chunk) => {
        const headerMap = parseHttpHeader(chunk);
        const SecWebSocketKey = headerMap["Sec-WebSocket-Key"];
        const swa = getDigest(SecWebSocketKey);
        if(headerMap["Upgrade"] === "websocket"){
            const resp = [
                "HTTP/1.1 101 Switching Protocols",
                "Upgrade: websocket",
                "Connection: Upgrade",
                `Sec-WebSocket-Accept: ${swa}`,
                "mark: kilic",
                "\r\n"
            ].join('\r\n');
            socket.write(resp);
        }
    }
}

const ws = new WebSocket({
    port: 8000
})

ws.on("connection", (socket) => {
    socket.on("message", msg =>{
        console.log(msg);
        socket.send(msg);
    })
    
})