/** Settings: its tabs and panels (appearance, text, privacy, sync and data, about). */
export default {
  // The window and its tabs.
  "settings.title": "Settings",
  "settings.tabTheme": "Theme",
  "settings.tabText": "Text",
  "settings.tabData": "Data",
  "settings.tabAbout": "About",
  "settings.close": "Close",
  "settings.sync": "Sync",

  // Theme.
  "settings.language": "Language",
  "settings.languageSystem": "System",
  "settings.languageNote": "lines starts again in the language chosen. System follows your device's language when lines speaks it, and English when it doesn't.",
  "settings.theme": "Theme",
  // The heading over the themes made for low vision and color blindness, and their names.
  "settings.themesAccessibility": "Accessibility",
  "settings.themeHighContrast": "High Contrast",
  // For protanopia and deuteranopia (red-green color blindness).
  "settings.themeRedGreen": "Red-Green Friendly",
  // For tritanopia (blue-yellow color blindness).
  "settings.themeBlueYellow": "Blue-Yellow Friendly",
  // Names the three themes above as they are written there.
  "settings.themesAccessibilityNote":
    "High Contrast is black on white, or white on black, with strong borders, for low vision. Red-Green Friendly is for protanopia and deuteranopia, and Blue-Yellow Friendly for tritanopia: their colors stay apart with those kinds of color blindness.",
  "settings.appearance": "Appearance",
  // Light or dark: follow the device's.
  "settings.appearanceSystem": "System",
  "settings.appearanceLight": "Light",
  "settings.appearanceDark": "Dark",
  "settings.contrast": "Contrast",
  "settings.contrastStandard": "Standard",
  "settings.contrastMore": "Increased",
  "settings.contrastNote": "Increased darkens grey text and borders, in every theme, so they’re easier to read. System follows Increase Contrast in your device’s accessibility settings.",
  "settings.icons": "Icons",
  "settings.sfSymbolsNote": "SF Symbols are available in the Mac and iPhone apps.",
  "settings.mainWindow": "Main window",
  // How see-through a window is.
  "settings.opacity": "Opacity",
  "settings.blur": "Blur what’s behind",
  "settings.opacityNote": "Below 100% opacity the desktop shows through the window.",
  "settings.floatingNotes": "Floating notes",
  // For screen readers: the group of theme swatches for floating notes, shown beside "Theme".
  "settings.floatingTheme": "Floating notes theme",
  // A floating note's theme or appearance: the same as the main window's.
  "settings.floatingSame": "Same",
  "settings.floatingSameTitle": "Same as the main window",
  "settings.floatingAppearance": "Floating notes appearance",
  "settings.floatingBorder": "Border and shadow",
  // A floating note's close, minimize and zoom buttons.
  "settings.windowButtons": "Window buttons",
  "settings.windowButtonsLabel": "Window buttons on floating notes",
  "settings.windowButtonsHover": "On hover",
  "settings.windowButtonsAlways": "Always",
  // {onHover} is settings.windowButtonsHover.
  "settings.windowButtonsNote": "With “{onHover}”, close, minimize and zoom appear when the pointer nears the top-left corner.",
  "settings.overFullscreen": "Show over full-screen apps",
  "settings.overFullscreenNote": "Floating notes follow you to every desktop. With this on, they also stay visible over apps in full screen.",
  "settings.trackpad": "Trackpad",
  "settings.swipeDirection": "Trackpad swipe direction",
  // The note moves the way the fingers do.
  "settings.swipeFingers": "Follow fingers",
  "settings.swipeReversed": "Reversed",
  "settings.swipeNote": "Swipe a note with two fingers to pin or trash it. Choose which way the note moves when you swipe.",

  // Text.
  "settings.preview": "Preview",
  // A note shown in the preview, in Markdown. Keep its # headings and - [x] checkboxes.
  "settings.previewNote":
    "# Weekend in the mountains\n\nA slow morning, then the farmers market. Pick up bread, cheese and something green for dinner.\n\nLeave by noon to beat the traffic.\n\n## Packing\n- [x] Book the cabin\n- [ ] Rain jackets\n- [ ] Trail map",
  "settings.font": "Font",
  "settings.fontSystem": "System",
  "settings.fontSerif": "Serif",
  "settings.fontRounded": "Rounded",
  "settings.fontMono": "Mono",
  "settings.textSize": "Text size",
  // A size in pixels, as shown beside a slider.
  "settings.pixels": "{value}px",
  // A size in pixels, as a screen reader says it.
  "settings.pixelsSpoken": "{count, plural, one {# pixel} other {# pixels}}",
  "settings.spacing": "Spacing",
  "settings.spacingPreset": "Spacing preset",
  "settings.spacingCompact": "Compact",
  "settings.spacingDefault": "Default",
  "settings.spacingRelaxed": "Relaxed",
  "settings.lineHeight": "Line height",
  "settings.paragraphSpacing": "Paragraph spacing",
  "settings.headingSpacing": "Heading spacing",
  "settings.titleSpacing": "Space below title",
  "settings.textWidth": "Text width",
  "settings.sideMargins": "Side margins",
  "settings.topMargin": "Top margin",
  "settings.customSpacing": "Custom spacing, saved on this device.",
  "settings.resetSpacing": "Reset to default",
  "settings.symbols": "Symbols",
  "settings.symbolsInText": "Show -> as → in text",
  "settings.symbolsInCode": "Show -> as → in code",
  // The arrows and signs are shown as they appear in notes; keep them as they are.
  "settings.symbolsNote":
    "Also <- as ←, <-> as ↔, => as ⇒, <=> as ⇔, <= as ≤, >= as ≥ and != as ≠. Your notes keep what you typed: put the cursor on one to see it, or type \\-> to keep it as typed.",

  // About.
  "settings.version": "Version {version}",
  "settings.tagline": "Beautiful, simple, local-first notes.",
  "settings.madeBy": "Made by Oleksandr Litus at Overtio.",
  "settings.source": "Source on GitHub",
  "settings.reportIssue": "Report an issue",
  "settings.license": "License",
  // {license} is a link: "GNU Affero General Public License v3.0".
  "settings.licenseText":
    "lines is free software under the {license}. You may use, study, share and change it under its terms. If you offer a modified version to others over a network, you must make its source available to them as well.",
  "settings.openSource": "Open source",
  "settings.openSourceText": "lines is built on these projects, with thanks to everyone who works on them.",
  // Credits: {name} is a project's name, "Lucide" or "Nord".
  "settings.creditIcons": "{name} icons",
  "settings.creditColors": "{name} colors",
  "settings.sfSymbolsCredit": "SF Symbols belong to Apple. In the Mac and iPhone apps, macOS and iOS draw them on your device; they aren’t included in lines.",
  "settings.showNotices": "Show all third-party licenses",
  "settings.hideNotices": "Hide all third-party licenses",
  // For screen readers: the scrolling box with every license's text.
  "settings.notices": "Third-party licenses",
  "settings.loading": "Loading…",
  "settings.noticesFailed": "The notices couldn’t be loaded.",

  // Data: export.
  "settings.export": "Export",
  // "attachments" is the folder's name in the .zip, so it stays as it is.
  "settings.exportText":
    "Save every note as a Markdown file, bundled in a .zip. Each file is named after its note’s title and holds exactly what you wrote, so it opens in any text editor or other Markdown app. Images and attached files go in an attachments folder beside them.",
  // "Trash" is the folder's name in the .zip, so it stays as it is.
  "settings.includeTrash": "Include the trash ({count, plural, one {# note} other {# notes}}, in a Trash folder)",
  "settings.lockedNotIncluded":
    "{count, plural, one {# locked note isn’t included} other {# locked notes aren’t included}}. Open locked notes first to export them too, unencrypted.",
  "settings.exporting": "Exporting…",
  "settings.exportCount": "Export {count, plural, one {# note} other {# notes}}",
  // {path} is where the .zip was saved, shown as code.
  "settings.savedTo": "Saved {count, plural, one {# note} other {# notes}} to {path}",
  "settings.downloaded": "Downloaded {filename}",
  "settings.showInFinder": "Show in Finder",
  "settings.showInFolder": "Show in folder",

  // Data: sample notes.
  "settings.samples": "Sample notes",
  "settings.samplesText":
    "The feature tour shows what lines can do, a note per feature. The examples are notes written in LaTeX: a short paper, lecture notes and a problem set. The QA notes show everything a note can hold, on its own and combined, with a checklist for testing a release. They’re added alongside your notes.",
  "settings.addTour": "Add Feature Tour",
  "settings.addExamples": "Add LaTeX Examples",
  "settings.addQa": "Add QA Notes",
  "settings.adding": "Adding…",
  "settings.addedTour": "Added {count, plural, one {# note} other {# notes}}.",
  // "examples" and "qa" are tags, so they stay as they are.
  "settings.addedExamples": "Added {count, plural, one {# example} other {# examples}}, tagged examples.",
  "settings.addedQa": "Added {count, plural, one {# QA note} other {# QA notes}}, tagged qa.",

  // Data: starting again, in development builds and on the demo website.
  "settings.development": "Development",
  "settings.developmentText":
    "Start again with the welcome note, the feature tour and the examples as they are in this build, to see new or changed sample notes. Every note on this device is deleted first, locked and trashed ones too. Only in development builds.",
  "settings.resetSyncFirst": "Turn sync off first: resetting would delete your notes from sync too.",
  "settings.resetQuestion":
    "{count, plural, one {Delete the only note on this device, and start again with the welcome note, the feature tour and the examples?} other {Delete all # notes on this device, and start again with the welcome note, the feature tour and the examples?}}",
  "settings.resetConfirm": "Delete and Reset",
  // The same, on the demo website.
  "settings.startAgain": "Start Again",
  "settings.startAgainText":
    "Start again with the feature tour and the examples, as they are on this website now. Every note in this browser is deleted first, locked and trashed ones too.",
  "settings.startAgainFolderFirst": "Stop saving to the folder first: starting again would delete your notes from the folder too.",
  "settings.startAgainQuestion":
    "{count, plural, one {Delete the only note in this browser, and start again with the feature tour and the examples?} other {Delete all # notes in this browser, and start again with the feature tour and the examples?}}",
  "settings.cancel": "Cancel",
  "settings.resetting": "Resetting…",
  "settings.resetNotes": "Reset Notes to Defaults…",
  "settings.resetDone": "Started again with {count, plural, one {# note} other {# notes}}.",
};
