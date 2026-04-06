# Stream Catcher for FDM

**Stream Catcher for FDM** is the ultimate companion for Free Download Manager (FDM). Unlike standard download extensions, this powerful tool is specifically designed to detect and intercept complex video streams (M3U8, DASH, HLS) and direct HTML5 videos that traditional downloaders often miss.

## Key Features
*   **Advanced Stream Detection**: Automatically detects hidden video formats like `.m3u8`, `.ts`, `.mp4`, and adaptative streams across the web.
*   **YouTube Support**: Seamlessly captures and sends YouTube video links directly to FDM in maximum quality.
*   **Cookie Delivery**: Bypasses anti-download protections by sending your active browser cookies and referers directly to FDM. If you can watch it, you can download it!
*   **Smart & Clean UI**: A beautiful, non-intrusive hover button appears only when a real downloadable video is playing.
*   **Memory Persistence**: Never lose your captured links, even if you navigate away or leave the tab open for hours.
*   **Zero-Config Fallback**: Instantly sends standard videos to FDM using `fdm://` without any setup needed.

## Required Engine (Elephant Add-on)
To fully parse complex video links like YouTube, FDM needs a media parser. We highly recommend installing the **Elephant** add-on directly inside your FDM desktop application:
1. Go to FDM Menu > **Add-ons**.
2. Click **Add add-on** (the `+` sign) and paste this URL: `https://free-addons.org/FDM/elephant.fda`
3. Hit Install. FDM is now fully equipped!

## IMPORTANT: One-Time Setup For Premium Features
To unlock Premium features like Native Native Messaging authorization, secure Server downloads (Uqload), and Cookie Delivery, you must perform a one-time "handshake" script.

### Option A: Automated Bridge Setup (Easiest)
1. Download the automated linker tool from our GitHub (or directly inside the extension Onboarding Screen):
   **[Download FDM_Linker.bat](https://github.com/hajaraph/FDM-Stream-Capture-IDM-style-/blob/master/FDM_Linker.bat)**
2. Double-click the file to execute it (No Administrator rights required!).
3. Completely **restart your Browser (Firefox/Chrome)**.

### Option B: Manual Setup
If you prefer to do it yourself:
1. Navigate to: `C:\Users\[YourUser]\AppData\Local\Softdeluxe\Free Download Manager\Mozilla\`
2. Open `org.freedownloadmanager.fdm5.cnh.json` with Notepad.
3. Add `"stream_catcher_fdm@freedownloadmanager.org"` to the `"allowed_extensions"` list.
4. **Save** and **restart Firefox**.

That's it! Your browser is now permanently linked to FDM. Just hover over any video on the web and enjoy the magic!

---
*Disclaimer: This extension is an independent project and is not officially affiliated with Free Download Manager. Please respect copyright laws and only download content you have the right to.*
