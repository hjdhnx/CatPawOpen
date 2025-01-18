import { createServer } from 'http';
import os from 'os';                       // 新添加用于支持DS源适配猫影视
import { start } from './index.js';        // 新添加用于支持DS源适配猫影视
import * as config from './index.config.js';        // 新添加用于支持DS源适配猫影视

globalThis.catServerFactory = (handle) => {
    let port = 0;
    const server = createServer((req, res) => {
        handle(req, res);
    });
//下面新添加用于支持DS源适配猫影视
    server.on('listening', () => {
        port = server.address().port;

        // 获取本地IP地址
        const networkInterfaces = os.networkInterfaces();
        const addresses = [];
        for (const interfaceName in networkInterfaces) {
            for (const net of networkInterfaces[interfaceName]) {
                if (!net.internal && net.family === 'IPv4') {
                    addresses.push(net.address);
                }
            }
        }

        console.log(`Server is running:`);
        console.log(`- Local:    http://localhost:${port}/config`);
        if (addresses.length > 0) {
            console.log(`- Network:  http://${addresses[0]}:${port}/config`);
        }
        console.log(`- Node.js version: ${process.version}`);
    });
//上面新添加用于支持DS源适配猫影视
    server.on('close', () => {
        console.log('Server closed on port ' + port);    //上面新添加用于支持DS源适配猫影视
    });

    return server;
};

globalThis.catDartServerPort = () => {
    return 0;
};

start(config.default);
