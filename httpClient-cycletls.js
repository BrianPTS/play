/**
 * HTTP Client using CycleTLS
 *
 * Install: npm install cycletls
 *
 * Drop-in replacement for Axios in scraper.js
 * Uses Go-native TLS — accepts raw JA3/JA4R fingerprint strings.
 * Supports HTTP/1.1, HTTP/2, HTTP/3, SOCKS4/5 proxies, and WebSocket.
 * Most battle-tested library (~1,300 GitHub stars).
 */
import initCycleTLS from "cycletls";
import proxyArray from "./helpers/proxy.js";

// Shared CycleTLS instance (spawns a Go process — reuse it)
let cycleTLS = null;

async function getCycleTLS() {
  if (!cycleTLS) {
    cycleTLS = await initCycleTLS();
  }
  return cycleTLS;
}

// Chrome 131 JA3 fingerprint — update this periodically to match latest Chrome
const CHROME_JA3 =
  "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-21,29-23-24,0";

const GetData = async (headers, _proxyAgent, url, eventId) => {
  return new Promise(async (resolve) => {
    try {
      const abortTimeout = setTimeout(() => {
        console.log("Request aborted due to timeout");
        console.log(eventId, "eventId");
        return resolve(false);
      }, 10000);

      try {
        const client = await getCycleTLS();
        const { proxyUrl } = GetProxy();

        const response = await client(url, {
          // Custom JA3 fingerprint to mimic Chrome exactly
          ja3: CHROME_JA3,
          // User-Agent must match the JA3 browser
          userAgent: headers["User-Agent"] || headers["user-agent"] || "",
          headers: {
            ...headers,
            "Accept-Encoding": "gzip, deflate, br",
            Connection: "keep-alive",
          },
          proxy: proxyUrl,
          timeout: 10,
          // Disable built-in redirect to control flow
          disableRedirect: false,
        });

        clearTimeout(abortTimeout);

        if (response.status === 200) {
          // CycleTLS returns body as parsed object if JSON, string otherwise
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
 * Call this on process exit to kill the Go subprocess.
 */
async function cleanup() {
  if (cycleTLS) {
    try {
      await cycleTLS.exit();
    } catch (_) {}
    cycleTLS = null;
  }
}

export { GetData, GetProxy, cleanup };
