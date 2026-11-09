import { expect, test } from "bun:test";
import { downloadName } from "../../scripts/release.mjs";

test("downloads are named by the system they're for, their signatures too", () => {
  const named = (file: string) => downloadName(file, "0.3.3");
  expect(
    [
      "lines_0.3.3_universal.dmg",
      "lines.app.tar.gz",
      "lines.app.tar.gz.sig",
      "lines_0.3.3_x64-setup.exe",
      "lines_0.3.3_x64_en-US.msi.sig",
      "lines_0.3.3_amd64.AppImage",
      "lines_0.3.3_amd64.deb",
      "lines-0.3.3-1.x86_64.rpm",
    ].map(named),
  ).toEqual([
    "lines_0.3.3_macos_universal.dmg",
    "lines_0.3.3_macos_universal.app.tar.gz",
    "lines_0.3.3_macos_universal.app.tar.gz.sig",
    "lines_0.3.3_windows_x64-setup.exe",
    "lines_0.3.3_windows_x64.msi.sig",
    "lines_0.3.3_linux_amd64.AppImage",
    "lines_0.3.3_linux_amd64.deb",
    "lines_0.3.3_linux_x86_64.rpm",
  ]);
  // Named once, and nothing else is.
  expect(named("lines_0.3.3_macos_universal.dmg")).toBe("lines_0.3.3_macos_universal.dmg");
  expect([named("lines.app"), named("latest.json")]).toEqual(["lines.app", "latest.json"]);
});
