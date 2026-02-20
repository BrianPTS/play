/**
 * HTTP Client using impit (Apify)
 *
 * Install: npm install impit
 *
 * Drop-in replacement for Axios in scraper.js
 * Uses Rust-native TLS fingerprinting (rustls) to mimic Chrome/Firefox.
 * Supports HTTP/1.1, HTTP/2, HTTP/3 with realistic browser fingerprints.
 */
import { fetch as impitFetch } from "impit";
import proxyArray from "./helpers/proxy.js";

const GetData = async (headers, _proxyAgent, url, eventId) => {
  return new Promise(async (resolve) => {
    try {
      const abortController = new AbortController();
      const timeout = setTimeout(() => {
        abortController.abort();
        console.log("Request aborted due to timeout");
        console.log(eventId, "eventId");
        return resolve(false);
      }, 10000);

      try {
        // Get a fresh proxy URL for this request
        const { proxyUrl } = GetProxy();

        const response = await impitFetch(url, {
          method: "GET",
          headers: {
            ...headers,
            "Accept-Encoding": "gzip, deflate, br",
            Connection: "keep-alive",
          },
          // impit uses browser impersonation — picks Chrome or Firefox TLS fingerprint
          impersonate: "chrome",
          // Proxy as a URL string: http://user:pass@host:port
          proxy: proxyUrl,
          signal: abortController.signal,
        });

        clearTimeout(timeout);

        if (response.status === 200) {
          const data = await response.json();
          return resolve(data);
        } else {
          console.log(`Request failed with status: ${response.status}`);
          return resolve(false);
        }
      } catch (error) {
        clearTimeout(timeout);
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
      // Keep proxyAgent-shaped return for compatibility with ScrapeEvent
      proxyAgent: proxyString,
      proxy: _proxy,
    };
  } catch (error) {
    console.error("Invalid proxy URL format:", error);
    throw new Error("Invalid proxy URL format");
  }
};

export { GetData, GetProxy };
