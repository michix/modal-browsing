# CHANGELOG

## Version 1

### 1.4.4

- (Fix) Initializes search input field on a new search with `/`.
- (Fix) While typing in search mode, jump to the first matching search result.

### 1.4.3

- (Fix) Making search also feasible with big websites.
- (Fix) Corrects state confusion when navigating between tabs using `<ctrl-i>` and `<ctrl-o>`.
- (Fix) Removes permission for `storage` since it is not required.

### 1.4.2

- (Fix) Makes scolling using `h`, `j`, `k`, `l` feasible on QMK keyboards.
- (Fix) Makes scrolling to the top or the bottom using `gg` and `G` instant (without animation).

### 1.4.1

- (Fix) Fixes not working scrolling on Websites like [GitLab](https://gitlab.com).
- (Fix) Fixes escaping to normal mode from input field.

### 1.4.0

- (Feature) Adds shortcuts `<ctrl-u>` and `<ctrl-d>` to scroll half a page up and down, respectively.
- (Feature) Adds shortcuts `<ctrl-o>` and `<ctrl-i>` to navigate backwards and forwards, respectively, in tab history.
- (Feature) Copies title of page to clipboard using `yt`.
- (Feature) Copies a Markdown link of the page using the title to the clipboard with `ylm`.
- (Feature) Copies an AsciiDoc link of the page using the title to the clipboard with `yla`.
- (Chore) Dials back highlighting of selected links.

### 1.3.0

- (Feature) Highlights letters of markers which have been typed.
- (Misc) Scrolling to the bottom and the top with `G` and `gg` is fast and instant.
- (Misc) Improves highlighting of link markers (slightly transparent, highlights only lower background of links).
- (Fix) `i` really focusses first input field.

### 1.2.0

- (Feature) Searching with `/` is case-insensitive if you only user lower-case letters and case-sensitive otherwise.
- (Feature) Pressing `<Enter>` in search mode lets you jump between search results using `n` and `<Shift+n>`.
- (Feature) Allows to move tabs to tab groups using `gt`.
- (Misc) Uses `<` and `>` to move tabs (instead of `<<` and `>>`).
- (Misc) Makes scrolling with `h`, `j`, `k`, `l` held smoother.

### 1.1.0

- (Feature) Adds `<<` and `>>` to move tabs.
- (Feature) Get into normal mode pressing `<esc>` in an input field.
- (Feature) Shows help pressing `?`.
- (Bugfix) `<shift>+f` opens links in new tab.
- (Bugfix) Fixes search with `/`.
- (Bugfix) Fixes open URL or switch to tab using `o`.
- (Misc) Shows notifications less intrusive on the lower right.
- (Misc) Shows labels for links in lower case instead of upper case.
- (Misc) Makes also input fields addressable using `f` or `<shift>+f`.

### 1.0.0

Initial release.
