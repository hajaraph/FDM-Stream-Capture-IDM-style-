# Stream Catcher for FDM

**Stream Catcher for FDM** is the ultimate companion for Free Download Manager (FDM). Unlike standard download extensions, this powerful tool is specifically designed to detect and intercept complex video streams (M3U8, DASH, HLS) and direct HTML5 videos that traditional downloaders often miss.

## 🚀 Key Features
*   **Advanced Stream Detection**: Automatically detects hidden video formats like `.m3u8`, `.ts`, `.mp4`, and adaptative streams across the web.
*   **YouTube Support**: Seamlessly captures and sends YouTube video links directly to FDM in maximum quality.
*   **Cookie Delivery**: Bypasses anti-download protections by sending your active browser cookies and referers directly to FDM. If you can watch it, you can download it!
*   **Smart & Clean UI**: A beautiful, non-intrusive hover button appears only when a real downloadable video is playing. Click it to reveal all available streams.
*   **Memory Persistence**: Never lose your captured links, even if you navigate away or leave the tab open for hours.

## 🛠️ IMPORTANT: One-Time Setup Required
Because this extension communicates directly with the FDM desktop software via Native Messaging, **you must authorize it in FDM's configuration file** on your computer.

### Windows Installation Steps:
1. Install **Stream Catcher for FDM** in Firefox.
2. Ensure you have **Free Download Manager** installed on your PC.
3. Open your File Explorer and navigate to FDM’s Mozilla Extension directory, usually located at:
   `C:\Users\User\AppData\Local\Softdeluxe\Free Download Manager\Mozilla`
4. Open the file named `org.freedownloadmanager.fdm5.cnh.json` with Notepad.
5. Find the `"allowed_extensions"` array and add our official extension ID: `"stream_catcher_fdm@freedownloadmanager.org"`.

It should look exactly like this:
```json
"allowed_extensions": [
    "fdm_ffext@freedownloadmanager.org", 
    "fdm_ffext2@freedownloadmanager.org",
    "stream_catcher_fdm@freedownloadmanager.org"
]
```
6. **Save the file** and completely **restart Firefox**.

That's it! Your browser is now permanently linked to FDM. Just hover over any video on the web and enjoy the magic!

---
*Disclaimer: This extension is an independent project and is not officially affiliated with Free Download Manager. Please respect copyright laws and only download content you have the right to.*
