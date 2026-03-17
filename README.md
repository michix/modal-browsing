# ModalBrowsing

A lightweight browser extension for Microsoft Edge that provides modal keyboard navigation for web pages with minimal permissions. Navigate the web with Vim-style keybindings without sacrificing your privacy.

I am not an expert in JavaScript nor in Browser extensions. This project was only possible due to the support of AI and [opencode](https://opencode.ai/). I would have not taken this effort if I were allowed to use Vimium (which is not possible due to compliance requirements and the many permissions, Vimium needs for certain features).

## Features

- **Vim-inspired keybindings** for efficient web browsing
- **Modal navigation** - keyboard shortcuts work in "normal mode" (outside input fields)
  - Press `i` to focus an input field and enter "insert mode"
  - Press `Esc` from any input field to return to "normal mode"
- **Minimal permissions** - only requires `activeTab` and `storage`, no access to:
  - Browse history
  - Files
  - All sites data
  - Personal information
- **Easy toggle** - enable/disable via popup

## Keyboard Shortcuts

### Scrolling

- `j` - Scroll down
- `k` - Scroll up
- `h` - Scroll left
- `l` - Scroll right
- `d` - Scroll down (large step)
- `u` - Scroll up (large step)

### Navigation

- `gg` - Go to top of page
- `G` (Shift+g) - Go to bottom of page
- `J` (Shift+j) - Switch to left tab
- `K` (Shift+k) - Switch to right tab
- `<<` - Move current tab to the left
- `>>` - Move current tab to the right
- `H` (Shift+h) - Go back in browser history
- `L` (Shift+l) - Go forward in browser history
- `r` - Reload current page
- `o` - Open URL (prompts for URL input)
- `t` - Open new tab
- `x` - Close current tab
- `X` (Shift+x) - Reopen last closed tab

### Other

- `f` - Show hints for clickable elements (links, buttons) and activate them
- `F` (Shift+f) - Show hints for clickable elements and open links in new tab
- `yy` - Copy current page URL to clipboard
- `yf` - Show hints for links and copy selected link URL to clipboard
- `i` - Focus first input field on page
- `/` - Open find dialog
- `Esc` - Exit input field to normal mode, unfocus element, or exit link hint mode

## Installation

### Microsoft Edge (and other Chromium browsers)

1. Download or clone this repository
2. Open Microsoft Edge and navigate to `edge://extensions/`
3. Enable "Developer mode" in the bottom-left corner
4. Click "Load unpacked"
5. Select the extension folder
6. The extension icon should appear in your toolbar

### Icons

The extension includes icon files with a nautical ship wheel design and hjkl directional keys:

- `icons/icon16.png` (16x16 pixels)
- `icons/icon48.png` (48x48 pixels)
- `icons/icon128.png` (128x128 pixels)

The icons are already included and ready to use.

## Distribution

In order to pubsh the extension, you need to ZIP it *without* the directory. In the project directory please execute:

```bash
zip -r ../modal-browsing.zip *.js LICENSE *.json *.html icons
```

## Privacy

This extension is built with privacy in mind:

- **No tracking** - zero telemetry or analytics
- **Minimal permissions** - only `activeTab`, `storage`, `tabs`, and `clipboardWrite`
- **No external requests** - all code runs locally
- **No data collection** - your browsing history stays private

## Development

### Project Structure

```
.
├── manifest.json       # Extension configuration
├── content.js         # Main keyboard handling logic
├── popup.html         # Extension popup UI
├── popup.js          # Popup functionality
├── icons/            # Extension icons
└── README.md         # This file
```

### Future Enhancements

- [ ] Customizable keybindings via settings page
- [ ] Additional link hint modes (open in background tab, download link, etc.)

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

Apache License Version 2.0 - feel free to use and modify as needed.
