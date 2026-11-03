# Browser Compatibility Matrix: Brave vs. Google Chrome

The **New Tab Dashboard** extension targets Chromium-based browsers implementing Manifest V3. This matrix details runtime behavior, permission handling, and browser-specific nuances verified between Google Chrome and Brave Browser.

---

## Compatibility Overview

| Capability | Chrome 116+ | Brave 1.57+ | Notes |
|:---|:---:|:---:|:---|
| **New Tab Override** | Supported | Supported | Brave requires users to enable extension control if "Brave News/Dashboard" is locked in Brave Settings. |
| **`chrome.storage.local`** | Supported | Supported | Primary authoritative store; persistent across browser restarts. |
| **IndexedDB Blobs** | Supported | Supported | Used for wallpaper binaries and JSON snapshot records. Works reliably in standard profiles. |
| **`chrome.runtime.getURL('/_favicon/')`** | Supported | Supported | Requires `"favicon"` permission in manifest. Never leaks browsing history externally. |
| **Optional `bookmarks` Permission** | Supported | Supported | Prompted on-demand when user clicks "Import browser bookmarks". |
| **Optional `tabs` & `tabGroups`** | Supported | Supported | Prompted on-demand when saving active tabs or launching collections as tab groups. |
| **Tab Group Colors & Titles** | Supported | Supported | Chrome and Brave support standard Chromium tab group color enums (`grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange`). |
| **Brave Shields Interference** | N/A | No Interference | Standard shields do not block internal `chrome-extension://` requests or Open-Meteo opt-in weather API calls. |
| **Content Security Policy** | Strict MV3 | Strict MV3 | `connect-src` limited to Open-Meteo hosts. Zero remote scripts. |

---

## Browser-Specific Details

### 1. Brave Browser Nuances
- **New Tab Page Settings:**
  In Brave Settings $\rightarrow$ *New Tab Page*, users can choose between *Dashboard*, *Blank Page*, or *Extension*. When this extension is loaded, Brave automatically prompts: *"An extension has changed your New Tab page. Keep changes?"* The user must click **Keep Changes**.
- **Favicon Permission Handling:**
  Brave resolves internal cached favicons via `chrome.runtime.getURL('/_favicon/')` identically to Chrome. Sites without cached favicons gracefully fallback to our deterministic letter tiles.

### 2. Google Chrome Nuances
- **Tab Group Behavior:**
  Chrome's tab groups natively support collapse and expanding. Launching a collection via "Open as Tab Group" highlights and groups newly spawned tabs under the collection name and color tag.
- **Unpacked Extension Warning Banner:**
  On Windows, Google Chrome displays a developer mode warning bar on browser launch when running unpacked extensions. This is standard Chromium behavior for development builds and is removed once packaged via the Chrome Web Store.
