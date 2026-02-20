/**
 * HTTP Client using bogdanfinn/tls-client + tlsclientwrapper
 *
 * Install: npm install tlsclientwrapper
 *
 * Drop-in replacement for Axios in scraper.js
 * Uses Go-native TLS via FFI — widest browser profile coverage.
 * Supports Chrome 131+, Firefox 133+, Safari, Edge profiles.
 * Supports HTTP/1.1, HTTP/2, HTTP/3 with accurate fingerprints.
 */
import { TLSClient } from "tlsclientwrapper";
import proxyArray from "./helpers/proxy.js";

// Shared TLS client instance (reuse across requests for performance)
let tlsClient = null;

async function getTlsClient() {
  if (!tlsClient) {
    tlsClient = new TLSClient({
      // Chrome 131 on Windows — one of the most common fingerprints
      tlsClientIdentifier: "chrome_131",
      // Follow redirects like a browser
      followRedirects: true,
      // Timeout in ms
      timeoutSeconds: 10,
      // Disable built-in cookie jar — we manage cookies via headers
      withoutCookieJar: true,
    });
  }
  return tlsClient;
}

const GetData = async (headers, _proxyAgent, url, eventId) => {
  return new Promise(async (resolve) => {
    try {
      const abortTimeout = setTimeout(() => {
        console.log("Request aborted due to timeout");
        console.log(eventId, "eventId");
        return resolve(false);
      }, 10000);

      try {
        const client = await getTlsClient();
        const { proxyUrl } = GetProxy();

        const response = await client.get(url, {
          headers: {
            ...headers,
            "Accept-Encoding": "gzip, deflate, br",
            Connection: "keep-alive",
          },
          proxy: proxyUrl,
        });

        clearTimeout(abortTimeout);

        if (response.status === 200) {
          // tls-client returns body as string — parse JSON
          const data =
            typeof response.body === "string"
              ? JSON.parse(response.body)
              : response.body;
          return resolve(data);
        } else {
          console.log(`Request failed with status: ${response.status}`);
          return resolve(false);
        }
      } catch (error) {
        clearTimeout(abortTimeout);
        console.log(`Request failed: ${error.message}`);
        return resolve(false);
      }
    } catch (e) {
      console.log(e, "error");
      return resolve(false);
    }
  });
};

const GetProxy = () => {
  let _proxy = [...proxyArray?.proxies];
  const randomProxy = Math.floor(Math.random() * _proxy.length);
  _proxy = _proxy[randomProxy];

  if (!_proxy || !_proxy.proxy || !_proxy.username || !_proxy.password) {
    throw new Error("Invalid proxy configuration");
  }

  try {
    const proxyUrl = new URL(`http://${_proxy.proxy}`);
    const proxyString = `http://${_proxy.username}:${_proxy.password}@${proxyUrl.hostname}:${proxyUrl.port || 80}`;

    return {
      proxyUrl: proxyString,
      proxyAgent: proxyString,
      proxy: _proxy,
    };
  } catch (error) {
    console.error("Invalid proxy URL format:", error);
    throw new Error("Invalid proxy URL format");
  }
};

/**
 * Call this on process exit to free the Go TLS client resources.
 */
async function cleanup() {
  if (tlsClient) {
    try {
      await tlsClient.close();
    } catch (_) {}
    tlsClient = null;
  }
}

export { GetData, GetProxy, cleanup };
