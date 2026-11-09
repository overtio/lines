import { describe, expect, test } from "bun:test";
import { readCurl } from "../../src/plugins/http/curl";

const asked = (command: string) => readCurl(command)?.asked;

describe("a pasted curl command's options", () => {
  test("a short option's value in the same word", () => {
    expect(asked("curl -XDELETE https://api.example.com/item/1")?.method).toBe("DELETE");
    expect(asked(`curl -XPUT 'localhost:9200/twitter' -d '{"a":1}'`)).toMatchObject({ method: "PUT", url: "https://localhost:9200/twitter" });
    expect(asked("curl -H'Accept: application/json' -uada:secret -bsession=1 -Alines -ehttps://a.example https://api.example.com/")).toMatchObject({
      headers: [["Accept", "application/json"], ["Cookie", "session=1"], ["User-Agent", "lines"], ["Referer", "https://a.example"]],
      user: "ada:secret",
    });
    expect(asked("curl -dname=ada https://api.example.com/")).toMatchObject({ method: "POST", body: "name=ada" });
  });

  test("short options run together, the last with its value", () => {
    expect(asked("curl -sSLX PATCH https://api.example.com/")?.method).toBe("PATCH");
    expect(asked("curl -sI https://api.example.com/")?.method).toBe("HEAD");
    expect(asked("curl -sGd q=1 https://api.example.com/search")).toMatchObject({ method: "GET", url: "https://api.example.com/search?q=1", body: null });
    // A value of its own word that starts with a dash isn't an option.
    expect(asked("curl -H 'X-Range: -5' -o -sL https://api.example.com/")).toMatchObject({ url: "https://api.example.com/", headers: [["X-Range", "-5"]] });
  });

  test("--data-urlencode encodes as curl does", () => {
    expect(asked("curl --data-urlencode 'msg=fish & chips=yes' https://api.example.com/form")?.body).toBe("msg=fish%20%26%20chips%3Dyes");
    expect(asked("curl --data-urlencode '=a b' --data-urlencode \"it's (100%)!\" https://api.example.com/")?.body).toBe("a%20b&it%27s%20%28100%25%29%21");
    const read = readCurl("curl --data-urlencode name@notes.txt -d a=1 https://api.example.com/");
    expect(read?.asked.body).toBe("a=1");
    expect(read?.notes).toEqual(["Not sent: lines doesn't read data from files yet (--data-urlencode name@notes.txt)"]);
  });
});
