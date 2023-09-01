const
  axios = require('axios'),
  { Buffer } = require('buffer'),
  { EventEmitter } = require('events'),
  { Transform } = require('stream');

function StreamHandler(stream, callback) {
  return new Promise((resolve, reject) => {
    let response = [];
    stream.on('data', chunk => {
      const res = new TextDecoder().decode(chunk);
      !callback || callback(res); 
      response.push(res);
    });
    stream.on('end', () => resolve(response));
    stream.on('error', reject);
  });
}

class Client extends EventEmitter {
  constructor(config = {}) {
    super();
    const base_url = this.base_url = 'https://sdk.vercel.ai';
    this.token_url = base_url + '/openai.jpeg';
    this.generate_url = base_url + '/api/prompt';
    this.chat_url = base_url + '/api/generate';

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    this.headers = {
      'User-Agent': `Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.${randomInt(0, 9999)}.${randomInt(0, 99)} Safari/537.36`,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.5',
      Te: 'trailers',
      'Upgrade-Insecure-Requests': '1'
    }

    this.fetch = async function(resource, options = {}) {
      options.headers || (options.headers = {});
      Object.assign(options.headers, this.headers);

      return await axios(resource, Object.assign(options, config));
    }

    this.get_models().then(models => {
      this.models = models;
      const model_ids = this.model_ids = Object.keys(models);
      this.model_defaults = {};

      for (const model_id of model_ids) {
        this.model_defaults[model_id] = this.get_default_params(model_id);
      }

      this.emit('ready');
    });
  }

  async get_models() {
    this.emit('debug', 'Downloading homepage...');

    const
      { data } = await this.fetch(this.base_url),
      paths_regex = /static\/chunks.+?\.js/g,
      seperator_regex = /"\]\)<\/script><script>self\.__next_f\.push\(\[.,"/g,
      paths = data.match(paths_regex);

    for (let i = 0; i < paths.length; i++) {
      paths[i] = paths[i].replace(seperator_regex, '');
    }

    const scripts = [];

    this.emit('debug', 'Downloading and parsing scripts...');
    const download_script = async path => {
      const { data } = await this.fetch(`${this.base_url}/_next/${path}`);
      scripts.push(data);
    }

    for (const path of paths) {
      await download_script(path);
    }

    for (const script of scripts) {
      const
        models_regex = /let (.)=("\\n\\nHuman:\"),.=(.+?),.=/g,
        matches = [...script.matchAll(models_regex)];

      if (matches.length) {
        const match = matches[0];
        return Function(`return (${match[3].replace(new RegExp(`\\[${match[1]}\\]`, 'g'), match[2])})`)();
      }
    }

    return [];
  }

  async get_token() {
    this.emit('debug', 'Fetching token from ' + this.token_url);

    function atob(data) {
      return Buffer.from(data, 'base64').toString('binary');
    }
    
    function btoa(data) {
      return Buffer.from(data, 'binary').toString('base64');
    }

    function toBinary(t) {
      let a = new Uint16Array(t.length);
      for (let o = 0; o < a.length; o++)
        a[o] = t.charCodeAt(o);
      return btoa(String.fromCharCode(...new Uint8Array(a.buffer)))
    }

    function fromBinary(t) {
      let a = atob(t)
        , o = new Uint8Array(a.length);
      for (let t = 0; t < o.length; t++)
        o[t] = a.charCodeAt(t);
      return String.fromCharCode(...new Uint16Array(o.buffer))
    }

    const
      { data } = await this.fetch(this.token_url),
      { c, a, t } = JSON.parse(fromBinary(data)),
      script = `
        String.prototype.fontcolor = function() {
          return \`<font>\${this\}</font>\`
        }
        var globalThis = { marker: "mark" };
        return (${c})(${a});
      `,
      r = Function(script)();

    r[2] = 'mark';

    return toBinary(JSON.stringify({
      r,
      t
    }));
  }

  get_default_params(model_id) {
    const
      model = this.models[model_id],
      defaults = {};

    for (const [key, param] of Object.entries(model.parameters)) {
      defaults[key] = param.value
    }
    return defaults;
  }

  async stream_request(method, resource, headers, data) {
    return (await this.fetch(resource, {
      method,
      headers,
      data,
      responseType: 'stream'
    })).data;
  }

  async get_headers() {
    const token = await this.get_token();
    return ({
      'Custom-Encoding': token,
      Host: 'sdk.vercel.ai',
      Origin: 'https://sdk.vercel.ai',
      Referrer: 'https://sdk.vercel.ai',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    });
  }

  async chat(model_id, messages, params = {}) {
    this.emit('debug', `Sending to ${model_id}: ${messages.length} messages`);

    const
      defaults = this.get_default_params(model_id),
      set_params = Object.assign(defaults, params),
      maxTokens = set_params.maxTokens || set_params.maximumLength;

    !maxTokens || (set_params.maxTokens = maxTokens);

    function randomUUID() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c^([...[]] = Array.from({length: 16}, () => Math.floor(256 * Math.random())))[0]&15>>c/4).toString(16));
    }

    const
      data = {
        ...set_params,
        messages,
        chatIndex: 0,
        model: model_id,
        playgroundId: randomUUID()
      },
      headers = await this.get_headers();

    this.emit('debug', 'Waiting for response');
    return this.stream_request('POST', this.chat_url, headers, data);
  }

  async generate(model_id, prompt, params = {}) {
    this.emit('debug', `Sending to ${model_id}: ${prompt}`);

    const
      defaults = this.get_default_params(model_id),
      set_params = Object.assign(defaults, params),
      maxTokens = set_params.maxTokens || set_params.maximumLength;

    !maxTokens || (set_params.maxTokens = maxTokens);

    const data = {
      ...set_params,
      prompt,
      model: model_id
    }, headers = await this.get_headers();

    this.emit('debug', 'Waiting for response');

    function modifyChunk(chunk) {
      return new TextEncoder().encode(new TextDecoder().decode(chunk).replace(/(\n|\")/g, ''));
    }

    const s = await this.stream_request('POST', this.generate_url, headers, data);
    return s.pipe(new Transform({
      transform(chunk, encoding, callback) {
        let modifiedChunk = modifyChunk(chunk);
        callback(null, modifiedChunk);
      }
    }));
  }
}

module.exports = { Client, StreamHandler };
