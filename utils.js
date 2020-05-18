const {createHash} = require('crypto');
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

function getDigest(key) {
    return createHash('sha1').update(key+GUID).digest("base64");
}

function unmask(buffer, mask) {
    const length = buffer.length;
    for (let i = 0; i < length; i++) {
      buffer[i] ^= mask[i & 3];
    }
}

function parseHttpHeader( header ){
    let headerMap = {};
    let headerArray = header.split('\r\n');
    headerArray = headerArray.slice(1, -2);
    for(let item of headerArray){
        const [k , v] = item.split(': ');
        headerMap[k] = v;
    }
    return headerMap;
}

function encodeDataFrame(e){
    var s = [],
        o = new Buffer(e.PayloadData),
        l = o.length;
    s.push((e.FIN << 7)+e.Opcode);
    //输入第二个字节，判断它的长度并放入相应的后续长度消息
    //永远不使用掩码
    if(l < 126)
        s.push(l);
    else if(l < 0x10000)
        s.push(126,(l&0xFF00)>>8,l&0xFF);
    else 
       s.push(
           127, // 01111111
           0,0,0,0, //8字节数据，前4字节一般没用留空
           (l&0xFF000000)>>24,
           (l&0xFF0000)>>16,
           (l&0xFF00)>>8,
           l&0xFF
       );
    //返回头部分和数据部分的合并缓冲区
    return Buffer.concat([new Buffer(s),o]);
};

exports.getDigest = getDigest;
exports.unmask = unmask;
exports.parseHttpHeader = parseHttpHeader;
exports.encodeDataFrame = encodeDataFrame;