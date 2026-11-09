import { expect, test } from "bun:test";
import { onPhoneOrTablet } from "../../src/lib/device";

const UA = {
  // An iPad's too: it asks for sites as a Mac would.
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)",
};

test("phones and tablets, and computers, a touch screen or not", () => {
  expect([onPhoneOrTablet(UA.mac, 5), onPhoneOrTablet(UA.iphone, 5), onPhoneOrTablet(UA.android, 5)]).toEqual([true, true, true]);
  expect([onPhoneOrTablet(UA.mac, 0), onPhoneOrTablet(UA.windows, 0), onPhoneOrTablet(UA.linux, 0)]).toEqual([false, false, false]);
  // A Surface, or any laptop with a touch screen.
  expect([onPhoneOrTablet(UA.windows, 10), onPhoneOrTablet(UA.linux, 10)]).toEqual([false, false]);
});
