const { base64decode, base64encode } = require('nodejs-base64');
const uuid = require('uuid');
const http = require('http');
const URL = require('url');

const BASE_URL = 'https://sdk.vercel.ai';
const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.9812.10 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.5",
    "Te": "trailers",
    "Upgrade-Insecure-Requests": "1"
};

async function get_token() {
    const b64_res = await fetch(BASE_URL + '/openai.jpeg'); // гениально
    const b64 = await b64_res.text();
    const data = JSON.parse(base64decode(b64).replaceAll('\x00', ''));
    const script = `const globalThis = {marker: 'mark'};(${data.c})(${data.a})`;
    const require = null;
    const global = null;
    const token = {
        r: eval(script),
        t: data.t
    };
    const token_str = Buffer.from(JSON.stringify(token), 'utf16le');
    return token_str.toString('base64');
}

async function get_headers() {
    return Object.assign({
        "Accept-Encoding": "gzip, deflate, br",
        "Custom-Encoding": await get_token(),
        "Host": "sdk.vercel.ai",
        "Origin": "https://sdk.vercel.ai",
        "Referrer": "https://sdk.vercel.ai",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
    }, headers);
}

async function chat(model, messages, params) {
    const f = await fetch(BASE_URL + '/api/generate', {
        headers: await get_headers(),
        method: 'POST',
        body: JSON.stringify(
            Object.assign({
                model, messages,
                playgroundId: uuid.v4(),
                chatIndex: 0,
                frequencyPenalty: 1,
                maxTokens: 1024,
                presencePenalty: 1,
                stopSequences: [],
                temperature: 0.7,
                topK: 1,
                topP: 1
            }, params)
        )
    });
    const text = await f.text();
    return text;
}

async function complete(model, prompt, params) {
    const f = await fetch(BASE_URL + '/api/prompt', {
        headers: await get_headers(),
        method: 'POST',
        body: JSON.stringify(
            Object.assign({
                model, prompt,
                playgroundId: uuid.v4(),
                chatIndex: 0,
                frequencyPenalty: 1,
                maxTokens: 200,
                presencePenalty: 1,
                stopSequences: [],
                temperature: 0.7,
                topK: 1,
                topP: 1
            }, params)
        )
    });
    const text = await f.text();
    return text.replaceAll('\r', '').split('\n').filter(s => s.length > 0).map(s => JSON.parse(s)).join('');
}

http.createServer((req, res) => {
    const url = URL.parse(req.url);
    var data = "";
    req.on('data', chunk => {
        data += chunk.toString('utf-8');
    });
    req.on('end', () => {
        const j = JSON.parse(data);
        if (url.pathname == '/v1/chat/completions') {
            const params = {};
            const oaiToV = {
                temperature: 'temperature',
                top_p: 'topP',
                stop: 'stopSequences',
                max_tokens: 'maxTokens',
                presence_penalty: 'presencePenalty',
                frequency_penalty: 'frequencyPenalty'
            };
            for (const key in oaiToV) {
                if (j[key]) params[oaiToV[key]] = j[key];
            }
            setImmediate(async () => {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({
                    id: 'chatcmpl-12345678',
                    object: 'chat.completion',
                    created: Date.now(),
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: 'assistant',
                                content: await chat(j.model, j.messages, params)
                            },
                            finish_reason: 'stop'
                        }
                    ],
                    usage: {
                        prompt_tokens: null,
                        completion_tokens: null,
                        total_tokens: null
                    }
                }));
            });
        } else if (url.pathname == '/v1/completions') {
            const params = {};
            const oaiToV = {
                temperature: 'temperature',
                top_p: 'topP',
                stop: 'stopSequences',
                max_tokens: 'maxTokens',
                presence_penalty: 'presencePenalty',
                frequency_penalty: 'frequencyPenalty'
            };
            for (const key in oaiToV) {
                if (j[key]) params[oaiToV[key]] = j[key];
            }
            setImmediate(async () => {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({
                    id: 'cmpl-12345678',
                    object: 'text_completion',
                    created: Date.now(),
                    choices: [
                        {
                            index: 0,
                            text: await complete(j.model, j.prompt, params),
                            logprobs: null,
                            finish_reason: 'stop'
                        }
                    ],
                    usage: {
                        prompt_tokens: null,
                        completion_tokens: null,
                        total_tokens: null
                    }
                }));
            });
        }
    });
}).listen(3000);
