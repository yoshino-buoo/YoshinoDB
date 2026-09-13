import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseCgssReference } from "../scripts/lib/cgss-reference.mjs";
import { isWikiAudio } from "../lib/voice-guide.js";
import { recordImages, searchText, validateCatalog } from "../lib/data.js";

test("saved HTML preserves nested translations, line breaks, and producer slots without importing page scripts", () => {
  const audio = "https://patchwiki.biligame.com/images/imascg/a/ab/sample.mp3";
  const parsed = parseCgssReference(
    `<script>throw Error('do not execute')</script><table class="bg-cgsscard"><tr><td>親愛度</td><td>一行目。<p>二行目、<span class="resourceLoader" style="display:none">Gadget-TheViewerName</span><span class="producerName">private reader name</span>。<br>三行目。<br><span style="font-size:12px;color:#4D6BFE"><u>第一行。<br>第二行。</u></span></p></td><td><audio src="${audio}"></audio><a title="文件:CGSS-Yoshino-9-3-01.mp3"></a></td></tr><tr><td><div class="Lyrics-line"><div class="Lyrics-original">【芳乃】</div><div class="Lyrics-translated">【芳乃】</div></div><div class="Lyrics-line"><div class="Lyrics-original">そのままー。<br>続きー。</div><div class="Lyrics-translated">保持原样——。</div></div></td></tr></table>`,
  );
  const clip = parsed.clips.get("CGSS-Yoshino-9-3-01.mp3");
  assert.equal(clip.audio, audio);
  assert.equal(clip.text.ja, "一行目。\n二行目、○○。\n三行目。");
  assert.equal(clip.text.zh, "第一行。\n第二行。");
  assert.deepEqual(parsed.commu.lines[1], {
    ja: "そのままー。\n続きー。",
    zh: "保持原样——。",
  });
  assert.ok(!JSON.stringify(parsed.commu).includes("<"));
});

test("all nineteen saved card imports retain the scene index, complete scripts and nested theater art", async () => {
  const data = validateCatalog(
    JSON.parse(await readFile("public/data/catalog.json", "utf8")),
  );
  const cards = data.items.filter(
    (item) => item.game === "deresute" && item.voiceGuide,
  );
  assert.equal(cards.length, 19);
  let rows = 0,
    lines = 0,
    images = 0;
  for (const item of cards) {
    const clips = item.voiceGuide.stages.flatMap((s) =>
      s.groups.flatMap((g) => g.clips),
    );
    assert.equal(clips.length, 72);
    assert.equal(new Set(clips.map((c) => c.file)).size, 65);
    assert.equal(clips.filter((c) => c.text?.ja).length, 58);
    assert.equal(clips.filter((c) => c.text?.zh).length, 58);
    assert.ok(clips.every((c) => isWikiAudio(c.audio)));
    rows += clips.length;
    lines += item.commu.lines.length;
    images += recordImages(item.theater).length;
  }
  assert.equal(rows, 1368);
  assert.equal(lines, 536);
  assert.equal(images, 33);
  const cafe = cards.find((c) => c.id === "card-2323");
  const affection = cafe.voiceGuide.stages[0].groups[2].clips[1];
  assert.equal(
    affection.text.ja,
    "山盛りの甘味と、おかわり自由の飲み物。\n気の合うみなとー、それに、そなたがおりますれば……\nついつい、お話も長くなってしまいますねー。",
  );
  assert.ok(searchText(cafe).includes("甜食另有一个胃"));
  assert.ok(!searchText(cafe).includes("patchwiki"));
  assert.ok(!JSON.stringify(cards).includes("与田选手今天得分了吗"));
});

test("voice playback accepts BWIKI media files and rejects pages or unrelated URLs", () => {
  assert.ok(
    isWikiAudio("https://patchwiki.biligame.com/images/imascg/a/ab/audio.mp3"),
  );
  for (const url of [
    "https://wiki.biligame.com/imascg/文件:audio.mp3",
    "javascript:alert(1)",
    "https://patchwiki.biligame.com.example.com/images/imascg/a.mp3",
    "https://user:pass@patchwiki.biligame.com/images/imascg/a.mp3",
    "https://patchwiki.biligame.com/images/imascg/page.html",
  ])
    assert.equal(isWikiAudio(url), false);
});
