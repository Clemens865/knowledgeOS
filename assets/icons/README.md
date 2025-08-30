# Icon Setup Instructions

## Required Icon Files

Please save your app icon (the brain/circuit image) in the following formats:

### For macOS:
- **icon.icns** - macOS icon format (required for dock)
  - You can convert your PNG to ICNS using:
    - Online tool: https://cloudconvert.com/png-to-icns
    - Or via terminal: `iconutil -c icns icon.iconset`

### For Windows:
- **icon.ico** - Windows icon format
  - Convert PNG to ICO at: https://cloudconvert.com/png-to-ico

### For Linux and as fallback:
- **icon.png** - 1024x1024 PNG version
- **icon@2x.png** - 2048x2048 PNG version (for Retina displays)

## Icon Sizes Needed

Create PNG versions in these sizes and place them in this directory:
- 16x16 (icon_16x16.png)
- 32x32 (icon_32x32.png)
- 64x64 (icon_64x64.png)
- 128x128 (icon_128x128.png)
- 256x256 (icon_256x256.png)
- 512x512 (icon_512x512.png)
- 1024x1024 (icon.png - main file)

## Quick Setup

1. Save your main icon as `icon.png` (1024x1024) in this directory
2. For macOS, also create `icon.icns`
3. For Windows, also create `icon.ico`

The app will automatically use these icons when building and running.