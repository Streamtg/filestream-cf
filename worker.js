// ---------- Insert Your Data ---------- //
const BOT_TOKEN = "5471483205:AAHOgy6y5LzxOJJ42znF4Kr_SfaW7Ic9oFc"; // Insert your bot token.
const BOT_WEBHOOK = "/endpoint"; // Let it be as it is.
const BOT_SECRET = "BOT_SECRET"; // Insert a powerful secret text (only [A-Z, a-z, 0-9, _, -] are allowed).
const BOT_OWNER = 834554042; // Insert your telegram account id.
const BOT_CHANNEL = -1001734249184; // Insert your telegram channel id which the bot is admin in.
const SIA_SECRET = "SIA_SECRET"; // Insert a powerful secret text and keep it safe.
const PUBLIC_BOT = false; // Make your bot public (only [true, false] are allowed).

// ---------- Constants ---------- //
const WHITE_METHODS = ["GET", "POST", "HEAD"];
const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024; // 4 GB
const CACHE_TTL = 60 * 60; // 1 hour cache TTL
const HEADERS_FILE = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
};
const HEADERS_ERRR = {
    'Access-Control-Allow-Origin': '*',
    'content-type': 'application/json'
};
const ERROR_404 = {
    "ok": false,
    "error_code": 404,
    "description": "Bad Request: missing /?file= parameter",
    "credit": "https://github.com/vauth/filestream-cf"
};
const ERROR_405 = {
    "ok": false,
    "error_code": 405,
    "description": "Bad Request: method not allowed"
};
const ERROR_406 = {
    "ok": false,
    "error_code": 406,
    "description": "Bad Request: file type invalid"
};
const ERROR_407 = {
    "ok": false,
    "error_code": 407,
    "description": "Bad Request: file hash invalid by atob"
};
const ERROR_408 = {
    "ok": false,
    "error_code": 408,
    "description": "Bad Request: mode not in [attachment, inline]"
};
const ERROR_409 = {
    "ok": false,
    "error_code": 409,
    "description": "Bad Request: file size exceeds limit"
};

// ---------- Event Listener ---------- //
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event).catch(error => {
        console.error('Unhandled exception in fetch event:', error);
        return new Response('Internal Server Error', { status: 500 });
    }));
});

async function handleRequest(event) {
    try {
        const url = new URL(event.request.url);
        const file = url.searchParams.get('file');
        const mode = url.searchParams.get('mode') || "attachment";

        if (url.pathname === BOT_WEBHOOK) return Bot.handleWebhook(event);
        if (url.pathname === '/registerWebhook') return Bot.registerWebhook(event, url, BOT_WEBHOOK, BOT_SECRET);
        if (url.pathname === '/unregisterWebhook') return Bot.unregisterWebhook(event);
        if (url.pathname === '/getMe') return new Response(JSON.stringify(await Bot.getMe()), { headers: HEADERS_ERRR, status: 202 });

        if (!file) return Raise(ERROR_404, 404);
        if (!["attachment", "inline"].includes(mode)) return Raise(ERROR_408, 404);
        if (!WHITE_METHODS.includes(event.request.method)) return Raise(ERROR_405, 405);

        let file_id;
        try {
            file_id = await Cryptic.deHash(file);
        } catch (error) {
            console.error('Dehashing error:', error);
            return Raise(ERROR_407, 404);
        }

        const retrieve = await RetrieveFile(BOT_CHANNEL, file_id);
        if (retrieve.error_code) return await Raise(retrieve, retrieve.error_code);

        const [rdata, rname, rsize, rtype] = retrieve;

        if (rsize > MAX_FILE_SIZE) return Raise(ERROR_409, 409);

        return new Response(rdata, {
            status: 200,
            headers: {
                "Content-Disposition": `${mode}; filename=${rname}`,
                "Content-Length": rsize.toString(),
                "Content-Type": rtype,
                ...HEADERS_FILE
            }
        });
    } catch (error) {
        console.error('Unhandled exception in handleRequest:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

// ---------- Retrieve File ---------- //
async function RetrieveFile(channel_id, message_id) {
    const cacheKey = `file_${message_id}`;
    const cachedFile = await caches.default.match(cacheKey);
    if (cachedFile) {
        return await cachedFile.json();
    }

    let data = await Bot.editMessage(channel_id, message_id, await UUID());
    if (data.error_code) return data;

    let fID, fName, fType, fSize, fLen;
    if (data.document) {
        fLen = data.document.length - 1;
        fID = data.document.file_id;
        fName = data.document.file_name;
        fType = data.document.mime_type;
        fSize = data.document.file_size;
    } else if (data.audio) {
        fLen = data.audio.length - 1;
        fID = data.audio.file_id;
        fName = data.audio.file_name;
        fType = data.audio.mime_type;
        fSize = data.audio.file_size;
    } else if (data.video) {
        fLen = data.video.length - 1;
        fID = data.video.file_id;
        fName = data.video.file_name;
        fType = data.video.mime_type;
        fSize = data.video.file_size;
    } else if (data.photo) {
        fLen = data.photo.length - 1;
        fID = data.photo[fLen].file_id;
        fName = data.photo[fLen].file_unique_id + '.jpg';
        fType = "image/jpg";
        fSize = data.photo[fLen].file_size;
    } else {
        return ERROR_406;
    }

    const file = await Bot.getFile(fID);
    if (file.error_code) return file;

    const fileData = [await Bot.fetchFile(file.file_path), fName, fSize, fType];
    await caches.default.put(cacheKey, new Response(JSON.stringify(fileData), { headers: { 'Cache-Control': `max-age=${CACHE_TTL}` } }));
    return fileData;
}

// ---------- Raise Error ---------- //
async function Raise(json_error, status_code) {
    console.error(`Error ${status_code}: ${json_error.description}`);
    return new Response(JSON.stringify(json_error), { headers: HEADERS_ERRR, status: status_code });
}

// ---------- UUID Generator ---------- //
async function UUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ---------- Hash Generator ---------- //
class Cryptic {
    static async getSalt(length = 16) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let salt = '';
        for (let i = 0; i < length; i++) {
            salt += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return salt;
    }

    static async getKey(salt, iterations = 1000, keyLength = 32) {
        const key = new Uint8Array(keyLength);
        for (let i = 0; i < keyLength; i++) {
            key[i] = (SIA_SECRET.charCodeAt(i % SIA_SECRET.length) + salt.charCodeAt(i % salt.length)) % 256;
        }
        for (let j = 0; j < iterations; j++) {
            for (let i = 0; i < keyLength; i++) {
                key[i] = (key[i] + SIA_SECRET.charCodeAt(i % SIA_SECRET.length) + salt.charCodeAt(i % salt.length)) % 256;
            }
        }
        return key;
    }

    static async baseEncode(input) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let output = '';
        let buffer = 0;
        let bitsLeft = 0;
        for (let i = 0; i < input.length; i++) {
            buffer = (buffer << 8) | input.charCodeAt(i);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                output += alphabet[(buffer >> (bitsLeft - 5)) & 31];
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) {
            output += alphabet[(buffer << (5 - bitsLeft)) & 31];
        }
        return output;
    }

    static async baseDecode(input) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        const lookup = {};
        for (let i = 0; i < alphabet.length; i++) {
            lookup[alphabet[i]] = i;
        }
        let buffer = 0;
        let bitsLeft = 0;
        let output = '';
        for (let i = 0; i < input.length; i++) {
            buffer = (buffer << 5) | lookup[input[i]];
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                output += String.fromCharCode((buffer >> (bitsLeft - 8)) & 255);
                bitsLeft -= 8;
            }
        }
        return output;
    }

    static async Hash(text) {
        const salt = await this.getSalt();
        const key = await this.getKey(salt);
        const encoded = String(text).split('').map((char, index) => {
            return String.fromCharCode(char.charCodeAt(0) ^ key[index % key.length]);
        }).join('');
        return await this.baseEncode(salt + encoded);
    }

    static async deHash(hashed) {
        const decoded = await this.baseDecode(hashed);
        const salt = decoded.substring(0, 16);
        const encoded = decoded.substring(16);
        const key = await this.getKey(salt);
        const text = encoded.split('').map((char, index) => {
            return String.fromCharCode(char.charCodeAt(0) ^ key[index % key.length]);
        }).join('');
        return text;
    }
}

// ---------- Telegram Bot ---------- //
class Bot {
    static async handleWebhook(event) {
        if (event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== BOT_SECRET) {
            return new Response('Unauthorized', { status: 403 });
        }
        const update = await event.request.json();
        event.waitUntil(this.Update(event, update));
        return new Response('Ok');
    }

    static async registerWebhook(event, requestUrl, suffix, secret) {
        const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;
        const response = await fetch(await this.apiUrl('setWebhook', { url: webhookUrl, secret_token: secret }));
        return new Response(JSON.stringify(await response.json()), { headers: HEADERS_ERRR });
    }

    static async unregisterWebhook(event) {
        const response = await fetch(await this.apiUrl('setWebhook', { url: '' }));
        return new Response(JSON.stringify(await response.json()), { headers: HEADERS_ERRR });
    }

    static async getMe() {
        const response = await fetch(await this.apiUrl('getMe'));
        if (response.status == 200) return (await response.json()).result;
        else return await response.json();
    }

    static async sendMessage(chat_id, reply_id, text, reply_markup = []) {
        const response = await fetch(await this.apiUrl('sendMessage', { chat_id: chat_id, reply_to_message_id: reply_id, parse_mode: 'markdown', text, reply_markup: JSON.stringify({ inline_keyboard: reply_markup }) }));
        if (response.status == 200) return (await response.json()).result;
        else return await response.json();
    }

    static async sendDocument(chat_id, file_id) {
        const response = await fetch(await this.apiUrl('sendDocument', { chat_id: chat_id, document: file_id }));
        if (response.status == 200) return (await response.json()).result;
        else return await response.json();
    }

    static async sendPhoto(chat_id, file_id) {
        const response = await fetch(await this.apiUrl('sendPhoto', { chat_id: chat_id, photo: file_id }));
        if (response.status == 200) return (await response.json()).result;
        else return await response.json();
    }

    static async editMessage(channel_id, message_id, caption_text) {
        const response = await fetch(await this.apiUrl('editMessageCaption', { chat_id: channel_id, message_id: message_id, caption: caption_text }));
        if (response.status == 200) return (await response.json()).result;
        else return await response.json();
    }

    static async answerInlineArticle(query_id, title, description, text, reply_markup = [], id = '1') {
        const data = [{ type: 'article', id: id, title: title, thumbnail_url: "https://i.ibb.co/5s8hhND/dac5fa134448.png", description: description, input_message_content: { message_text: text, parse_mode: 'markdown' }, reply_markup: { inline_keyboard: reply_markup } }];
        const response = await fetch(await this.apiUrl('answerInlineQuery', { inline_query_id: query_id, results: JSON.stringify(data), cache_time: 1 }));
        if (response.status == 200) return (await response.json()).result;
        else return await response.json();
    }

    static async answerInlineDocument(query_id, title, file_id, mime_type, reply_markup = [], id = '1') {
        const data = [{ type: 'document', id: id, title: title, document_file_id: file_id, mime_type: mime_type, description: mime_type, reply_markup: { inline_keyboard: reply_markup } }];
        const response = await fetch(await this.apiUrl('answerInlineQuery', { inline_query_id: query_id, results: JSON.stringify(data), cache_time: 1 }));
        if (response.status == 200) return (await response.json()).result;
        else return await response.json();
    }

    static async answerInlinePhoto(query_id, title, photo_id, reply_markup = [], id = '1') {
        const data = [{ type: 'photo', id: id, title: title, photo_file_id: photo_id, reply_markup: { inline_keyboard: reply_markup } }];
        const response = await fetch(await this.apiUrl('answerInlineQuery', { inline_query_id: query_id, results: JSON.stringify(data), cache_time: 1 }));
        if (response.status == 200) return (await response.json()).result;
        else return await response.json();
    }

    static async getFile(file_id) {
        const response = await fetch(await this.apiUrl('getFile', { file_id: file_id }));
        if (response.status == 200) return (await response.json()).result;
        else return await response.json();
    }

    static async fetchFile(file_path) {
        const file = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file_path}`);
        return await file.arrayBuffer();
    }

    static async apiUrl(methodName, params = null) {
        let query = '';
        if (params) query = '?' + new URLSearchParams(params).toString();
        return `https://api.telegram.org/bot${BOT_TOKEN}/${methodName}${query}`;
    }

    static async Update(event, update) {
        if (update.inline_query) await onInline(event, update.inline_query);
        if ('message' in update) await onMessage(event, update.message);
    }
}

// ---------- Inline Listener ---------- //
async function onInline(event, inline) {
    if (!PUBLIC_BOT && inline.from.id != BOT_OWNER) {
        const buttons = [[{ text: "Source Code", url: "https://github.com/vauth/filestream-cf" }]];
        return await Bot.answerInlineArticle(inline.id, "Access forbidden", "Deploy your own filestream-cf.", "*❌ Access forbidden.*\n📡 Deploy your own [filestream-cf](https://github.com/vauth/filestream-cf) bot.", buttons);
    }

    try {
        await Cryptic.deHash(inline.query);
    } catch (error) {
        console.error('Inline query dehashing error:', error);
        const buttons = [[{ text: "Source Code", url: "https://github.com/vauth/filestream-cf" }]];
        return await Bot.answerInlineArticle(inline.id, "Error", ERROR_407.description, ERROR_407.description, buttons);
    }

    const channel_id = BOT_CHANNEL;
    const message_id = await Cryptic.deHash(inline.query);
    const data = await Bot.editMessage(channel_id, message_id, await UUID());

    if (data
