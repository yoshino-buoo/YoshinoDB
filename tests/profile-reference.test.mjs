import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseProfileReference } from "../scripts/lib/profile-reference.mjs";
import { validateEditorCatalog, entryIssues } from "../lib/editor-data.js";
import { isWikiAudio } from "../lib/voice-guide.js";
import { recordImages, validateCatalog } from "../lib/data.js";

test("profile import keeps common voices within their section and separates introduction translations", () => {
  const audio = "https://patchwiki.biligame.com/images/imascg/a/ab/example.mp3";
  const p = parseProfileReference(
    `<div><div class="cc-dialogue-text"><span class="view-cgss-only"><span class="hover-change-before">初次见面。<br>我是芳乃。</span><span class="hover-change-after"><small>はじめましてー。<br>芳乃でしてー。</small></span></span><span class="view-moba-only">別の紹介</span></div><div class="cc-voice"><audio src="${audio}"></audio><a title="文件:CGSS-INTRODUCE-Yoshino.mp3"></a></div></div><h2><span id="CGSS公共台词语音"></span></h2><table><tr><td>早晨</td><td>朝でしてー。<br><span style="color:#4D6BFE"><u>早晨到了ー。</u></span></td><td><audio src="${audio}"></audio><a title="文件:CGSS-CommonVoice-Yoshino-1-01.mp3"></a></td></tr></table><h2><span id="贴纸动画でしてー"></span></h2><ul><li class="gallerybox"><a href="https://wiki.biligame.com/imascg/文件:Yoshino_LINE1.gif"><img alt="Yoshino LINE1.gif" src="./files/line.gif" width="312" height="300"></a><div class="gallerytext">Line贴纸</div></li></ul><h2>其他</h2><audio src="ignored.mp3"></audio>`,
  );
  assert.equal(p.voiceRows, 1);
  assert.equal(
    p.clips.get("CGSS-CommonVoice-Yoshino-1-01.mp3").text.zh,
    "早晨到了ー。",
  );
  assert.deepEqual(p.introduction.text, {
    ja: "はじめましてー。\n芳乃でしてー。",
    zh: "初次见面。\n我是芳乃。",
  });
  assert.equal(p.stickers.length, 1);
  assert.equal(p.stickers[0].group, "line");
  assert.equal(p.stickers[0].savedPath, "./files/line.gif");
});

test("published profile contains every supplied voice and sticker and remains editable", async () => {
  const catalog = JSON.parse(
    await readFile("public/data/catalog.json", "utf8"),
  );
  validateEditorCatalog(catalog);
  const profile = catalog.items.find((i) => i.id === "profile-yoshino");
  const clips = profile.voiceGuide.stages.flatMap((s) =>
    s.groups.flatMap((g) => g.clips),
  );
  assert.equal(clips.length, 29);
  assert.equal(new Set(clips.map((c) => c.file)).size, 29);
  assert.equal(clips.filter((c) => c.text?.ja && c.text?.zh).length, 16);
  assert.ok(clips.every((c) => isWikiAudio(c.audio)));
  assert.equal(
    clips.find((c) => c.file === "CGSS-CommonVoice-Yoshino-1-04.mp3").text.ja,
    "光に満ちているのでしてー\nLIVEに行くのが吉でしょうー",
  );
  assert.equal(profile.voiceGuide.excerpts, undefined);
  const stickers = profile.profile.stickers;
  assert.equal(stickers.length, 14);
  assert.deepEqual(
    ["mobamas", "deresute", "line"].map(
      (group) => stickers.filter((s) => s.group === group).length,
    ),
    [9, 3, 2],
  );
  assert.equal(stickers.filter((s) => s.image.endsWith(".gif")).length, 8);
  assert.equal(recordImages(profile).length, 15);
  assert.deepEqual(
    entryIssues(profile, new Set(catalog.items.map((i) => i.id))),
    [],
  );
  for (const sticker of stickers) {
    const bytes = await readFile("public/" + sticker.image);
    assert.ok(
      sticker.image.endsWith(".gif")
        ? /^GIF8[79]a/.test(bytes.subarray(0, 6).toString())
        : bytes.subarray(1, 4).toString() === "PNG",
    );
  }
  const bad = structuredClone(profile);
  bad.profile.stickers[0].image = "../outside.gif";
  assert.throws(() => validateCatalog({ version: 1, items: [bad] }), /sticker/);
});
