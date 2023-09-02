# Node.js Vercel LLM API

This is a reverse engineered API wrapper for the [Vercel AI Playground](https://play.vercel.ai/), which allows for free access to many LLMs, including OpenAI's ChatGPT, Cohere's Command Nightly, as well as some open source models.

Also a JavaScript implementation of the ading2210's [vercel-llm-api](https://github.com/ading2210/vercel-llm-api) Python library.

## Table of Contents
  * [Features](#features)
  * [Limitations](#limitations)
  * [Installation](#installation)
  * [Documentation](#documentation)
    + [Using the Client](#using-the-client)
      - [Downloading the Available Models](#downloading-the-available-models)
      - [Generating Text](#generating-text)
      - [Generating Chat Messages](#generating-chat-messages)
    + [Using StreamHandler](#using-streamhandler)
    + [Miscellaneous](#miscellaneous)
      - [Listening to Debug Messages](#listening-to-debug-messages)

<small><i>Table of contents generated with <a href='http://ecotrust-canada.github.io/markdown-toc/'>markdown-toc</a></i></small>

## Features
 - Download the available models
 - Generate text
 - Generate chat messages
 - Set custom parameters
 - Stream the responses

## Limitations
 - No auth support
 - Can't use "pro" or "hobby" models

## Installation
You can install this library by running the following command:
```
npm install vercel-llm-api
```

## Documentation
<ins>*Note that the entire library requires the use of async/await.*</ins>

### Using the Client
To use this library, simply `require('vercel-llm-api')` and create a `Client` instance. You can specify custom Axios request configurations as an argument.

See [here](https://axios-http.com/docs/req_config) for the Axios request config.

```js
const { Client } = require('vercel-llm-api'),
  client = new Client();

client.on('ready', async () => {
  // the client is ready to do whatever
});
```
Note that the following examples assume `client` is the name of your `Client` instance and that it is inside an async function.

#### Downloading the Available Models
The client downloads the available models upon initialization, and stores them in `client.models`. 
```js
>>> console.log(client.models)

{
  "anthropic:claude-instant-v1": { 
    "id": "anthropic:claude-instant-v1", // the model's id
    "provider": "anthropic",             // the model's provider
    "providerHumanName": "Anthropic",    // the provider's display name
    "makerHumanName": "Anthropic",       // the maker of the model
    "minBillingTier": "hobby",           // the minimum billing tier needed to use the model
    "parameters": {                      // an object of optional parameters that can be passed to the generate function
      "temperature": {                   // the name of the parameter
        "value": 1,                      // the default value for the parameter
        "range": [0, 1]                  // a range of possible values for the parameter
      },
      ...
    }
    ...
  }
}
```
Note that, since there is no auth yet, if a model has the `"minBillingTier"` property present, it can't be used.

A list of model IDs is also available in `client.model_ids`.
```js
>>> console.log(client.model_ids)
[
  "anthropic:claude-instant-v1", // locked to hobby tier; unusable
  "anthropic:claude-v1",         // locked to hobby tier; unusable
  "replicate:replicate/alpaca-7b",
  "replicate:stability-ai/stablelm-tuned-alpha-7b",
  "huggingface:bigscience/bloom",
  "huggingface:bigscience/bloomz",
  "huggingface:google/flan-t5-xxl",
  "huggingface:google/flan-ul2",
  "huggingface:EleutherAI/gpt-neox-20b",
  "huggingface:OpenAssistant/oasst-sft-4-pythia-12b-epoch-3.5",
  "huggingface:bigcode/santacoder",
  "cohere:command-medium-nightly",
  "cohere:command-xlarge-nightly",
  "openai:gpt-4",                // locked to pro tier; unusable
  "openai:code-cushman-001",
  "openai:code-davinci-002",
  "openai:gpt-3.5-turbo",
  "openai:text-ada-001",
  "openai:text-babbage-001",
  "openai:text-curie-001",
  "openai:text-davinci-002",
  "openai:text-davinci-003"
]
```

An Object of default parameters for each model can be found at `client.model_params`.
```js
>>> console.log(client.model_defaults)
{
  "anthropic:claude-instant-v1": {
    "temperature": 1,
    "maximumLength": 200,
    "topP": 1,
    "topK": 1,
    "presencePenalty": 1,
    "frequencyPenalty": 1,
    "stopSequences": [
      "\n\nHuman:"
    ]
  },
  ...
}
```

#### Generating Text
To generate some text, use the `client.generate` function, which accepts the following arguments:
 - `model` - The ID of the model you want to use.
 - `prompt` - Your prompt.
 - `params` - An Object of optional parameters. See the previous section for how to find these.

The function returns the newly generated text as a `ReadableStream`.

```js
await client.generate('openai:gpt-3.5-turbo', 'Summarize the GNU GPL v3');
```

#### Generating Chat Messages
To generate chat messages, use the `client.chat` function, which accepts the following arguments:
 - `model` - The ID of the model you want to use.
 - `messages` - A list of messages. The format for this is identical to how you would use the official OpenAI API.
 - `params` - An Object of optional parameters. See the "Downloading the Available Models" section for how to find these.

The function returns the newly generated text as a `ReadableStream`.

```js
const messages = [
  {"role": "system", "content": "You are a helpful assistant."},
  {"role": "user", "content": "Who won the world series in 2020?"},
  {"role": "assistant", "content": "The Los Angeles Dodgers won the World Series in 2020."},
  {"role": "user", "content": "Where was it played?"}
];

await client.chat('openai:gpt-3.5-turbo', messages);
```

### Using StreamHandler

StreamHandler is a utility function to handle the returned `ReadableStream` of the instantiated `Client`'s `chat` and `generate` functions.

StreamHandler accepts the following arguments:
 - `stream` - The `ReadableStream`.
 - `callback` - An optional callback to process each chunk of the stream.

...and returns an `Array` of `String`s.

```js
const { Client, StreamHandler } = require('vercel-llm-api'),
  client = new Client();

client.on('ready', async () => {
  const messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Who won the world series in 2020?"},
    {"role": "assistant", "content": "The Los Angeles Dodgers won the World Series in 2020."},
    {"role": "user", "content": "Where was it played?"}
  ];
  
  const stream = await client.chat('openai:gpt-3.5-turbo', messages),
    response = await StreamHandler(stream);

  console.log(response); // returns [ "The", " 2020", " World", " Series", " was", " played", ... ]
});
```

### Miscellaneous

#### Listening to Debug Messages
If you want to show the debug messages, simply listen to the `debug` event of the `Client` instance.

```js
const { Client } = require('vercel-llm-api'),
  client = new Client();

client.on('debug', console.log);
```
