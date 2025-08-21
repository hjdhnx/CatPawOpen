import * as cfg from './index.config.js';
import push from './spider/video/push.js';
import alist from './spider/pan/alist.js';
import _13bqg from './spider/book/13bqg.js';
import copymanga from './spider/book/copymanga.js';
import ffm3u8 from './spider/video/ffm3u8.js';
import drpyS from './spider/video/drpyS.js';
import {request} from "./util/request.js";
import {extractTags} from "./util/tool.js";
import {md5} from "./util/crypto-util.js";
import chunkStream from "./util/chunk.js";

const spiders = [ffm3u8, push, alist, _13bqg, copymanga, drpyS];
const spiderPrefix = '/spider';
let dsSites = [];
let dsParses = [];
let drpyS_data = {};
let drpyS_error = null;

/**
 * A function to initialize the router.
 *
 * @param {Object} fastify - The Fastify instance
 * @return {Promise<void>} - A Promise that resolves when the router is initialized
 */
export default async function router(fastify) {
    // register all spider router
    // spiders.forEach((spider) => {
    //     const path = spiderPrefix + '/' + spider.meta.key + '/' + spider.meta.type;
    //     if ((spider === drpyS && cfg.default.drpyS.enable_home_site) || spider !== drpyS) {
    //         fastify.register(spider.api, {prefix: path});
    //         console.log('Register spider: ' + path);
    //     }
    //
    // });
    for (const spider of spiders) {
        const path = spiderPrefix + '/' + spider.meta.key + '/' + spider.meta.type;
        if (spider === drpyS && !cfg.default.drpyS.enable_home_site) { // 没启用ds首页就不显示这个源
            continue
        } else if (spider === push && cfg.default.drpyS.enable_dspush) { // 启动ds 推送就禁用系统推送
            continue
        }
        fastify.register(spider.api, {prefix: path});
        console.log('Register spider: ' + path);
    }
    console.log(cfg.default);
    if (cfg.default.drpyS && cfg.default.drpyS.config_url) {
        let drpyS_config_url = cfg.default.drpyS.config_url;
        if (drpyS_config_url && drpyS_config_url.startsWith('http')) {
            try {

                drpyS_data = await request(drpyS_config_url);
                if (drpyS_data.homepage && drpyS_data.homepage.startsWith('https://github.com/hjdhnx')) {
                    let drpyS_sites = drpyS_data.sites.filter(site => site.type === 4);

                    // console.log(drpyS_sites);
                    dsSites = drpyS_sites.map((site) => {
                        let meta = {};
                        let skey = site.key;
                        let sname = site.name;
                        let stags = extractTags(sname);
                        if (skey === 'push_agent') {
                            meta.type = 4;
                        } else if (stags.includes('书')) {
                            meta.type = 10;
                        } else if (stags.includes('画')) {
                            meta.type = 20;
                        }
                            // else if (stags.includes('听')) {
                            //     meta.type = 30;
                            // }
                            // else if (stags.includes('盘')) {
                            //     meta.type = 40;
                        // }
                        else {
                            meta.type = 7;
                        }
                        meta.key = skey === 'push_agent' ? 'push' : skey;
                        meta.name = site.name;
                        meta.api = spiderPrefix + '/' + 'drpyS' + '/' + meta.type + '/' + meta.key;
                        // const extend = (Array.isArray(site.ext) || typeof site.ext == 'object') ? JSON.stringify(site.ext) : site.ext;
                        const extend = site.ext;
                        meta.ext = {api: site.api, extend: extend};
                        return meta;
                    });

                    dsParses = drpyS_data.parses;
                    // console.log(dsSites);

                    dsSites.forEach((site) => {
                        const path = site.api;
                        fastify.register(drpyS.api, {prefix: path});
                        console.log('Register spider: ' + path);
                    });
                }
            } catch (e) {
                drpyS_error = e.message;
                console.log(`加载配置发生了错误: ${drpyS_error}`)
            }
        }
    }
    /**
     * @api {get} /check 检查
     */
    fastify.register(
        /**
         *
         * @param {import('fastify').FastifyInstance} fastify
         */
        async (fastify) => {
            fastify.get(
                '/check',
                /**
                 * check api alive or not
                 * @param {import('fastify').FastifyRequest} _request
                 * @param {import('fastify').FastifyReply} reply
                 */
                async function (_request, reply) {
                    reply.send({run: !fastify.stop});
                }
            );
            fastify.get(
                '/config',
                /**
                 * get catopen format config
                 * @param {import('fastify').FastifyRequest} _request
                 * @param {import('fastify').FastifyReply} reply
                 */
                async function (_request, reply) {
                    const config = {
                        video: {
                            sites: [],
                        },
                        read: {
                            sites: [],
                        },
                        comic: {
                            sites: [],
                        },
                        music: {
                            sites: [],
                        },
                        pan: {
                            sites: [],
                        },
                        color: fastify.config.color || [],
                    };
                    for (const spider of spiders) {
                        if (spider === drpyS && !cfg.default.drpyS.enable_home_site) { // 没启用ds首页就不显示这个源
                            continue
                        } else if (spider === push && cfg.default.drpyS.enable_dspush) { // 启动ds 推送就禁用系统推送
                            continue
                        }

                        let meta = Object.assign({}, spider.meta);
                        meta.api = spiderPrefix + '/' + meta.key + '/' + meta.type;
                        meta.key = 'nodejs_' + meta.key;
                        meta.ext = {};
                        const stype = spider.meta.type;
                        if (stype < 10) {
                            config.video.sites.push(meta);
                        } else if (stype >= 10 && stype < 20) {
                            config.read.sites.push(meta);
                        } else if (stype >= 20 && stype < 30) {
                            config.comic.sites.push(meta);
                        } else if (stype >= 30 && stype < 40) {
                            config.music.sites.push(meta);
                        } else if (stype >= 40 && stype < 50) {
                            config.pan.sites.push(meta);
                        }
                    }
                    // ds源内容分类放
                    dsSites.forEach((site) => {
                        const stype = site.type;
                        if (stype < 10) {
                            config.video.sites.push(site);
                        } else if (stype >= 10 && stype < 20) {
                            config.read.sites.push(site);
                        } else if (stype >= 20 && stype < 30) {
                            config.comic.sites.push(site);
                        } else if (stype >= 30 && stype < 40) {
                            config.music.sites.push(site);
                        } else if (stype >= 40 && stype < 50) {
                            config.pan.sites.push(site);
                        }
                    });

                    // 把所有内容放影视分类里
                    // config.video.sites = config.video.sites.concat(dsSites);
                    drpyS.updateSiteMap(dsSites);
                    config.parses = dsParses;
                    config.drpyS_error = drpyS_error;
                    drpyS.updateDsCache('parses', dsParses);
                    // console.log(JSON.stringify(config));
                    console.log(`共计加载了 ${config.video.sites.length} 个视频源,其他源暂不统计，正常加载完毕`);
                    reply.send(config);
                }
            );

            fastify.all('/proxy', async (request, reply) => {
                try {
                    const {thread, chunkSize, url, header} = request.query;

                    if (!url) {
                        reply.code(400).send({error: 'url is required'});
                        return;
                    }

                    // 解码 URL 和 Header
                    // const decodedUrl = decodeURIComponent(url);
                    const decodedUrl = url;
                    // const decodedHeader = header ? JSON.parse(decodeURIComponent(header)) : {};
                    const decodedHeader = header ? JSON.parse(header) : {};

                    // 获取当前请求头
                    const currentHeaders = request.headers;

                    // 解析目标 URL
                    const targetUrl = new URL(decodedUrl);

                    // 更新特殊头部
                    const proxyHeaders = {
                        ...currentHeaders,
                        ...decodedHeader,
                        host: targetUrl.host, // 确保 Host 对应目标网站
                        origin: `${targetUrl.protocol}//${targetUrl.host}`, // Origin
                        referer: targetUrl.href, // Referer
                    };

                    // 删除本地无关头部
                    delete proxyHeaders['content-length']; // 避免因修改内容导致不匹配
                    delete proxyHeaders['transfer-encoding'];

                    // 添加缺省值或更新
                    proxyHeaders['user-agent'] =
                        proxyHeaders['user-agent'] ||
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
                    proxyHeaders['accept'] = proxyHeaders['accept'] || '*/*';
                    proxyHeaders['accept-language'] = proxyHeaders['accept-language'] || 'en-US,en;q=0.9';
                    proxyHeaders['accept-encoding'] = proxyHeaders['accept-encoding'] || 'gzip, deflate, br';


                    // delete proxyHeaders['host'];
                    // delete proxyHeaders['origin'];
                    // delete proxyHeaders['referer'];
                    // delete proxyHeaders['cookie'];
                    // delete proxyHeaders['accept'];

                    delete proxyHeaders['sec-fetch-site'];
                    delete proxyHeaders['sec-fetch-mode'];
                    delete proxyHeaders['sec-fetch-dest'];
                    delete proxyHeaders['sec-ch-ua'];
                    delete proxyHeaders['sec-ch-ua-mobile'];
                    delete proxyHeaders['sec-ch-ua-platform'];
                    // delete proxyHeaders['connection'];
                    // delete proxyHeaders['user-agent'];
                    delete proxyHeaders['range']; // 必须删除，后面chunkStream会从request取出来的
                    // console.log(`proxyHeaders:`, proxyHeaders);

                    // 处理选项
                    const option = {
                        chunkSize: chunkSize ? 1024 * parseInt(chunkSize, 10) : 1024 * 256,
                        poolSize: thread ? parseInt(thread, 10) : 6,
                        timeout: 1000 * 10, // 默认 10 秒超时
                    };

                    // console.log(`option:`, option);
                    // 计算 urlKey (MD5)
                    const urlKey = md5(decodedUrl);

                    // 调用 chunkStream
                    return await chunkStream(request, reply, decodedUrl, urlKey, proxyHeaders, option);
                } catch (err) {
                    reply.code(500).send({error: err.message});
                }
            });
        }
    );
}
