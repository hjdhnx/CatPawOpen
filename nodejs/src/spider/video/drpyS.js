import {request, post, mergeQuery} from '../../util/request.js';
import {base64Encode, md5} from '../../util/crypto-util.js';
import {extractTags, shuffleArray, jsonpath} from "../../util/tool.js";
import batchExecute from '../../util/batchExecute.js';
import * as cfg from '../../index.config.js';

const meta = {
    key: 'drpyS',
    name: '道长DS',
    type: 7,
};
const sitesCache = new Map();
const DsCache = new Map();
// const SKEY = md5('nodejs_drpyS');
const SKEY = md5(meta.type);
const API = cfg.default.drpyS.home_site;
sitesCache.set(SKEY, {
    api: API,
    extend: '',
});

function getSiteUrl(skeyHash) {
    const site = sitesCache.get(skeyHash);
    let url = site.api;
    if (site.extend) {
        const extStr = (Array.isArray(site.extend) || typeof site.extend == 'object') ? JSON.stringify(site.extend) : site.extend;
        url = mergeQuery(url, {extend: extStr});
    }
    return url
}

function getPushApi() {
    return getSiteUrl(md5('push'));
}

function updateSiteMap(sites) {
    sites.forEach((site) => {
        let skeyHash = md5(site.key);
        sitesCache.set(skeyHash, Object.assign(sitesCache.get(skeyHash) || {}, {
            api: site.ext.api,
            extend: site.ext.extend,
        }));
    });
}

function updateDsCache(key, value) {
    DsCache[key] = value;
}

async function support(_inReq, _outResp) {
    // const clip = inReq.body.clip;
    const prefix = _inReq.server.prefix;
    const skey = prefix.slice(prefix.lastIndexOf('/') + 1);
    if (skey === 'push') {
        return 'true';
    }
    return 'false'
}

async function init(_inReq, _outResp) {
    const {ext, skey, stype} = _inReq.body;
    const skeyHash = md5(skey);
    console.log('ext:', ext);
    console.log('skey:', skey);
    console.log('stype:', stype);
    if (sitesCache.has(skeyHash)) {
        const cached = sitesCache.get(skeyHash);
        console.log('已储存:', cached);
        return cached
    }
    const storeSites = {
        api: ext.api,
        extend: ext.ext,
    }
    sitesCache.set(skeyHash, storeSites);
    console.log('未储存:', storeSites);
    return storeSites
}

async function home(_inReq, _outResp) {
    const prefix = _inReq.server.prefix;
    const skeyHash = md5(prefix.slice(prefix.lastIndexOf('/') + 1));
    let url = getSiteUrl(skeyHash);
    const result = await request(url);
    // console.log('result:',result)
    const site = sitesCache.get(skeyHash);
    if (/platform=ysc/.test(url)) { // 处理不夜不讲规则的筛选
        if (result.filters && typeof result.filters === 'object' && Object.keys(result.filters).length > 0) {
            let new_filters = {};
            Object.keys(result.filters).forEach((key) => {
                if (result.filters[key] && !Array.isArray(result.filters[key])) {
                    new_filters[key] = [result.filters[key]]
                } else {
                    new_filters[key] = result.filters[key]
                }
            });
            result.filters = new_filters;
        }
    }
    if (result.list && result.list.length > 0 && Array.isArray(result['class'])) {
        site['home_videos'] = result.list;
        result['class'].unshift({"type_name": "推荐", "type_id": "dsHome"},)
    }
    sitesCache.set(skeyHash, site);
    return result
}

async function category(_inReq, _outResp) {
    const prefix = _inReq.server.prefix;
    const skey = prefix.slice(prefix.lastIndexOf('/') + 1);
    const stags = extractTags(skey);
    const skeyHash = md5(skey);
    let url = getSiteUrl(skeyHash);
    const tid = _inReq.body.id;
    const pg = _inReq.body.page || 1;
    if (tid === 'dsHome') {
        if (pg === 1) {
            const site = sitesCache.get(skeyHash);
            return {list: site['home_videos']}
        } else {
            return {list: []}
        }
    }
    const filters = _inReq.body.filters || {};
    let ext = undefined;
    if (Object.keys(filters).length > 0) {
        ext = base64Encode(JSON.stringify(filters));
    }
    const query = {
        // ac: 'list',
        ac: 'detail', // 适配不夜t4
        t: tid,
        pg: pg,
        ext: ext,
    }
    url = mergeQuery(url, query);
    const result = await request(url);
    if (stags.includes('画') || stags.includes('书')) {
        result.list = result.list.map((item) => {
            return {
                book_id: item.vod_id,
                book_name: item.vod_name,
                book_pic: item.vod_pic,
                book_remarks: item.vod_remarks,
                book_content: item.vod_content,
            }
        })
    }
    return result;
}

async function detail(_inReq, _outResp) {
    const prefix = _inReq.server.prefix;
    const skey = prefix.slice(prefix.lastIndexOf('/') + 1);
    const stags = extractTags(skey);
    const skeyHash = md5(skey);
    let url = getSiteUrl(skeyHash);
    const ids = !Array.isArray(_inReq.body.id) ? [_inReq.body.id] : _inReq.body.id;

    // 一级或者搜索过滤的push直接拦截，可以避免走自身detail（虽然后面自身detail数据逻辑已经可用了，但是为了少走一次，加快速率，这样加很棒）
    if (ids[0].startsWith('push://')) {
        let _ids = ids[0].slice(7);
        let _url = getPushApi();
        console.log('detail push _ids:', _ids);
        console.log('detail push _url:', _url);
        let _data = {ac: 'detail', ids: _ids};
        let _result;
        if (/platform=ysc/.test(_url)) { // 不夜get
            url = mergeQuery(url, _data);
            _result = await request(url);
        } else {
            _result = await post(_url, _data);
        }
        if (_result && Array.isArray(_result.list)) {
            let _vod_play_url = _result.list[0].vod_play_url;
            _result.list[0].vod_play_url = _vod_play_url.split('#').map(i => i.replace('$', '$push://')).join('#');
        }
        return _result
    }
    const query = {ac: 'detail', ids: ids.join(',')};
    url = mergeQuery(url, query);
    const result = await request(url);
    // const data = {ac: 'detail', ids: ids.join(',')};
    // const result = await post(url, data);
    if (result.list && Array.isArray(result.list)) {
        const vod_play_url = result.list[0].vod_play_url;
        const vod_play_from = result.list[0].vod_play_from;
        // 手动处理push:// 调用push_agent
        if (vod_play_url && vod_play_url.includes('push://')) {
            console.log('vod_play_url:', vod_play_url);
            let vod_play_urls = [];
            let vod_play_froms = vod_play_from.split('$$$');
            let vod_play_arr = vod_play_url.split('$$$');
            console.log(vod_play_arr);
            for (let i in vod_play_arr) {
                const play_url = vod_play_arr[i];
                console.log('play_url:', play_url);
                if (play_url.includes('push://')) {
                    const tab_urls = play_url.split('#');
                    console.log('tab_urls:', tab_urls);
                    let _vod_play_urls = [];
                    for (const tab_url of tab_urls) {
                        let _title = tab_url.split('$')[0];
                        let vod_url = tab_url.split('$')[1];
                        if (vod_url && vod_url.startsWith('push://')) {
                            let _ids = vod_url.slice(7);
                            let _url = getPushApi();
                            console.log('tab push _ids:', _ids);
                            console.log('tab push _url:', _url);
                            let _data = {ac: 'detail', ids: _ids};
                            let _result;
                            if (/platform=ysc/.test(_url)) { // 不夜get
                                url = mergeQuery(url, _data);
                                _result = await request(url);
                            } else {
                                _result = await post(_url, _data);
                            }
                            // const _query = {ac: 'detail', ids: _ids};
                            // _url = mergeQuery(_url, _query);
                            // const _result = await request(_url);
                            if (_result && Array.isArray(_result.list)) {
                                let _vod_play_url = _result.list[0].vod_play_url;
                                vod_play_froms[i] = _result.list[0].vod_play_from;
                                _vod_play_urls = _vod_play_urls.concat(_vod_play_url.split('#').map(i => i.replace('$', '$push://')).join('#'));
                            }
                        } else {
                            _vod_play_urls.push(tab_url)
                        }
                    }
                    vod_play_urls.push(_vod_play_urls.join('#'));
                } else {
                    vod_play_urls.push(play_url)
                }
            }
            result.list[0].vod_play_url = vod_play_urls.join('$$$');
            result.list[0].vod_play_from = vod_play_froms.join('$$$');
        }
    }
    if (stags.includes('画') || stags.includes('书')) {
        result.list = result.list.map((item) => {
            return {
                book_id: item.vod_id,
                book_name: item.vod_name,
                book_pic: item.vod_pic,
                book_remarks: item.vod_remarks,
                book_content: item.vod_content,
                urls: item.vod_play_url,
                volumes: item.vod_play_from,
            }
        })
    }
    return result;
}


async function play(_inReq, _outResp) {
    const prefix = _inReq.server.prefix;
    let localProxyApi = _inReq.server.address().url.replace(':::', '127.0.0.1:') + '/proxy';
    // console.log('localProxyApi:', localProxyApi);
    const skey = prefix.slice(prefix.lastIndexOf('/') + 1);
    const stags = extractTags(skey);
    const skeyHash = md5(skey);
    let url = getSiteUrl(skeyHash);
    let id = _inReq.body.id;
    if (id && id.startsWith('push://')) {
        url = getPushApi();
        id = id.slice(7);
        console.log('[play] push:', id);
    }
    const flag = _inReq.body.flag;
    const flags = _inReq.body.flags;
    const query = {play: `${id}`, flag: flag};
    url = mergeQuery(url, query);
    let result = await request(url);
    let images = {};
    let book = {};
    let referer = '';
    if (stags.includes('书')) {
        let bookJson = JSON.parse(result.url.replace('novel://', ''));
        book.title = bookJson.title;
        book.content = book.title + '\n\n' + bookJson.content;
        book.header = result.header;
        result = book;
    }
    if (stags.includes('画')) {
        images.content = result.url.replace('pics://', '').split('&&').map((i) => {
            if (i.indexOf('@Referer=')) {
                let link = i.split('@Referer=')[0];
                referer = i.split('@Referer=')[1];
                return link
            } else {
                return i
            }
        });
        if (referer) {
            images.header = {
                Referer: referer
            }
        }
        result = images
    } else { //影视类执行解析、免嗅、嗅探逻辑
        if (result && Number(result.jx) && result.url) {
            const input = result.url;
            // console.log(DsCache.parses);
            // 筛选出json解析
            let parses = DsCache.parses.filter(it => it.type === 1);
            parses = shuffleArray(parses); // 随机打乱顺序
            let successCount = Number(cfg.default.drpyS.parse_count) || 6;
            let parse_timeout = Number(cfg.default.drpyS.parse_timeout) || 5000;
            console.log(`待并发的json解析数量: ${parses.length}`);
            let realUrls = [];
            const tasks = parses.map((jxObj, index) => {
                let task_id = jxObj.url + input;
                return {
                    func: async function parseTask({jxObj, task_id}) {
                        let json = await request(task_id, {timeout: parse_timeout}); // 解析5秒超时
                        let _url = jsonpath.query(json, '$.url');
                        if (Array.isArray(_url)) {
                            _url = _url[0];
                        }
                        console.log('_url:', _url);
                        if (!json.code || json.code === 200 || ![-1, 404, 403].includes(json.code)) {
                            if (_url) {
                                let lastIndex = _url.lastIndexOf('/');
                                let lastLength = _url.slice(lastIndex + 1).length;
                                // console.log('lastLength:', lastLength);
                                if (lastLength > 10) {
                                    // console.log(`code:${json.code} , url:${json.url}`);
                                    return {...json, ...{name: jxObj.name}}
                                }
                            }
                            throw new Error(`${jxObj.name} 解析 ${input} 失败: ${JSON.stringify(json)}`);
                        } else {
                            throw new Error(`${jxObj.name} 解析 ${input} 失败`);
                        }
                    },
                    param: {jxObj, task_id},
                    id: task_id
                }
            });
            const listener = {
                func: (param, id, error, result) => {
                    if (error) {
                        console.error(`Task ${id} failed with error: ${error.message}`);
                    } else if (result) {
                        // log(`Task ${id} succeeded with result: `, result);
                        realUrls.push({original: id, ...result});
                    }
                    // 中断逻辑示例
                    if (param.stopOnFirst && result && result.url) {
                        return 'break';
                    }
                },
                param: {stopOnFirst: false},
            }
            await batchExecute(tasks, listener, successCount, 16);
            // console.log(realUrls);
            const playUrls = [];
            realUrls.forEach((item) => {
                playUrls.push(item.name, item.url);
            });
            return {
                parse: 0,
                url: playUrls,
                // header: headers
            }

        } else if (result && Number(result.parse) && result.url) {
            const input = result.url;
            if (input && input.startsWith('http')) { // lazy返回结果是url http开头才走嗅探和免嗅逻辑
                const sniffer_rule = cfg.default.drpyS.sniffer_rule || 'http((?!http).){12,}?\\.m3u8(?!\\?)';
                const regex = new RegExp(sniffer_rule);
                if (regex.test(input)) {
                    result.parse = 0;
                } else if (!regex.test(input)) {
                    if (cfg.default.drpyS.enable_hipy_sniffer && cfg.default.drpyS.hipy_sniffer_url) {
                        const _js = result.js;
                        const _parse_extra = result.parse_extra;
                        const _query = {
                            url: input,
                            script: _js ? base64Encode(_js) : undefined,
                        }
                        let _url = mergeQuery(cfg.default.drpyS.hipy_sniffer_url, _query);
                        if (_parse_extra) {
                            _url += _parse_extra;
                        }
                        try {
                            let _result = await request(_url);
                            console.log(`hipy嗅探器任务执行${_url} 完毕: ${_result.url}`);
                            return {
                                parse: 0,
                                url: _result.url,
                                header: _result.headers
                            }
                        } catch (e) {
                            console.log(`hipy嗅探器嗅探错误: ${e.message}`);
                        }

                    } else {
                        const sniffer = await _inReq.server.messageToDart({
                            action: 'sniff',
                            opt: {
                                url: input,
                                timeout: 10000,
                                rule: sniffer_rule,
                            },
                        });
                        if (sniffer && sniffer.url) {
                            const hds = {};
                            if (sniffer.headers) {
                                if (sniffer.headers['user-agent']) {
                                    hds['User-Agent'] = sniffer.headers['user-agent'];
                                }
                                if (sniffer.headers['referer']) {
                                    hds['Referer'] = sniffer.headers['referer'];
                                }
                                if (sniffer.headers['cookie']) {
                                    hds['Cookie'] = sniffer.headers['cookie'];
                                }
                            }
                            return {
                                parse: 0,
                                url: sniffer.url,
                                header: hds,
                            };
                        }
                    }
                }
            }
        }
    }
    if (result.url && typeof result.url === 'string' && result.url.includes('http://127.0.0.1:5575/')) {
        result.url = result.url.replaceAll('http://127.0.0.1:5575/proxy', localProxyApi);
    } else if (result.url && Array.isArray(result.url) && result.url.find(x => x.startsWith('http://127.0.0.1:5575/'))) {
        result.url = JSON.parse(JSON.stringify(result.url).replaceAll('http://127.0.0.1:5575/proxy', localProxyApi));
    }

    return result;
}

async function search(_inReq, _outResp) {
    const prefix = _inReq.server.prefix;
    const skey = prefix.slice(prefix.lastIndexOf('/') + 1);
    const stags = extractTags(skey);
    const skeyHash = md5(skey);
    let url = getSiteUrl(skeyHash);
    const wd = _inReq.body.wd;
    const pg = Number(_inReq.body.page) || 1;
    const quick = _inReq.body.quick || undefined;
    const query = {wd: wd, pg: pg, quick: quick};
    url = mergeQuery(url, query);

    const result = await request(url);

    if (stags.includes('画') || stags.includes('书')) {
        result.list = result.list.map((item) => {
            return {
                book_id: item.vod_id,
                book_name: item.vod_name,
                book_pic: item.vod_pic,
                book_remarks: item.vod_remarks,
                book_content: item.vod_content,
            }
        })
    }
    return result;
}

async function test(_inReq, _outResp) {
    const prefix = _inReq.server.prefix;
    const skey = prefix.slice(prefix.lastIndexOf('/') + 1);
    const stags = extractTags(skey);
    const skeyHash = md5(skey);
    const is_book = stags.includes('画') || stags.includes('书');
    try {
        const printErr = function (json) {
            if (json.statusCode && json.statusCode == 500) {
                console.error(json);
            }
        };
        const dataResult = {};
        let resp = await _inReq.server.inject().post(`${prefix}/init`).payload({
            ext: {api: API, extend: ''}, skey, stype: 4
        });
        dataResult.init = resp.json();
        printErr(resp.json());
        resp = await _inReq.server.inject().post(`${prefix}/home`);
        dataResult.home = resp.json();
        printErr(resp.json());
        if (dataResult.home.class.length > 0) {
            resp = await _inReq.server.inject().post(`${prefix}/category`).payload({
                id: dataResult.home.class[0].type_id,
                page: 1,
                filter: true,
                filters: {},
            });
            dataResult.category = resp.json();
            printErr(resp.json());
            if (dataResult.category.list.length > 0) {
                resp = await _inReq.server.inject().post(`${prefix}/detail`).payload({
                    id: is_book ? dataResult.category.list[0].book_id : dataResult.category.list[0].vod_id, // dataResult.category.list.map((v) => v.vod_id),
                });
                dataResult.detail = resp.json();
                printErr(resp.json());
                if (dataResult.detail.list && dataResult.detail.list.length > 0) {
                    dataResult.play = [];
                    for (const vod of dataResult.detail.list) {
                        let vod_play_from = is_book ? vod.volumes : vod.vod_play_from;
                        let vod_play_url = is_book ? vod.urls : vod.vod_play_url;
                        const flags = vod_play_from.split('$$$');
                        const ids = vod_play_url.split('$$$');
                        for (let j = 0; j < flags.length; j++) {
                            const flag = flags[j];
                            const urls = ids[j].split('#');
                            for (let i = 0; i < urls.length && i < 2; i++) {
                                resp = await _inReq.server
                                    .inject()
                                    .post(`${prefix}/play`)
                                    .payload({
                                        flag: flag,
                                        id: urls[i].split('$')[1],
                                    });
                                dataResult.play.push(resp.json());
                            }
                        }
                    }
                }
            }
        }
        resp = await _inReq.server.inject().post(`${prefix}/search`).payload({
            wd: '爱',
            page: 1,
        });
        dataResult.search = resp.json();
        printErr(resp.json());
        return dataResult;
    } catch (err) {
        console.error(err);
        _outResp.code(500);
        return {err: err.message, tip: 'check debug console output'};
    }
}

export default {
    meta,
    updateSiteMap,
    updateDsCache,
    api: async (fastify) => {
        fastify.post('/support', support);
        fastify.post('/init', init);
        fastify.post('/home', home);
        fastify.post('/category', category);
        fastify.post('/detail', detail);
        fastify.post('/play', play);
        fastify.post('/search', search);
        fastify.get('/test', test);
    },
};
