import * as cfg from './index.config.js';
import push from './spider/video/push.js';
import alist from './spider/pan/alist.js';
import _13bqg from './spider/book/13bqg.js';
import copymanga from './spider/book/copymanga.js';
import ffm3u8 from './spider/video/ffm3u8.js';
import drpyS from './spider/video/drpyS.js';   // 新添加用于支持DS源适配猫影视
import {request} from "./util/request.js";     // 新添加用于支持DS源适配猫影视

const spiders = [ffm3u8, push, alist, _13bqg, copymanga, drpyS];    // 新添加drpyS用于支持DS源适配猫影视
const spiderPrefix = '/spider';

/**
 * A function to initialize the router.
 *
 * @param {Object} fastify - The Fastify instance
 * @return {Promise<void>} - A Promise that resolves when the router is initialized
 */
export default async function router(fastify) {
    // register all spider router
    spiders.forEach((spider) => {
        const path = spiderPrefix + '/' + spider.meta.key + '/' + spider.meta.type;
        fastify.register(spider.api, {prefix: path});    // 新添加用于支持DS源适配猫影视
        console.log('Register spider: ' + path);
    });
    // console.log(cfg.default);
    // if (cfg.default.drpyS && cfg.default.drpyS.config_url) {
    //     let drpyS_config_url = cfg.default.drpyS.config_url;
    //     if (drpyS_config_url && drpyS_config_url.startsWith('http')) {
    //         let drpyS_data = await request(drpyS_config_url);
    //         if (drpyS_data.sites_count && drpyS_data.homepage === 'https://github.com/hjdhnx/drpy-node') {
    //             let drpyS_sites = drpyS_data.sites;
    //             console.log(drpyS_sites);
    //         }
    //     }
    // }
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
                    reply.send({run: !fastify.stop});    // 新添加用于支持DS源适配猫影视
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
                    spiders.forEach((spider) => {
                        let meta = Object.assign({}, spider.meta);
                        meta.api = spiderPrefix + '/' + meta.key + '/' + meta.type;
                        meta.key = 'nodejs_' + meta.key;
                        meta.ext = '';    // 新添加用于支持DS源适配猫影视
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
                    });
                    // 下面代码 新添加用于支持DS源适配猫影视
                    console.log(cfg.default);
                    if (cfg.default.drpyS && cfg.default.drpyS.config_url) {
                        let drpyS_config_url = cfg.default.drpyS.config_url;
                        if (drpyS_config_url && drpyS_config_url.startsWith('http')) {
                            let drpyS_data = await request(drpyS_config_url);
                            if (drpyS_data.sites_count && drpyS_data.homepage === 'https://github.com/hjdhnx/drpy-node') {
                                let drpyS_sites = drpyS_data.sites.filter(site => site.type === 4);
                                console.log(drpyS_sites);
                                const sites = drpyS_sites.map((site) => {
                                    let meta = {};
                                    meta.key = site.key;
                                    meta.name = site.name;
                                    meta.type = site.type;
                                    meta.api = '/spider/drpyS/4';
                                    meta.ext = {api: site.api, extend: site.ext};
                                    return meta;
                                });
                                config.video.sites = config.video.sites.concat(sites);
                                drpyS.updateSiteMap(sites);
                                config.parses = drpyS_data.parses;
                            }
                        }
                    }
                    // 上面代码 新添加用于支持DS源适配猫影视
                    console.log(JSON.stringify(config));
                    reply.send(config);
                }
            );
        }
    );
}
