# 芳乃のよりみち帖 · YoshinoDB

依田芳乃的非官方、非营利粉丝资料站。默认日语，可切换简体中文。

[打开网站](https://yoshino-buoo.github.io/YoshinoDB/) · [内容编辑器](https://yoshino-buoo.github.io/YoshinoDB/#editor) · [补充与纠错](https://github.com/yoshino-buoo/YoshinoDB/issues/new/choose)

提供角色档案、卡片与服装、歌曲、剧情、组合、视频、足迹和资讯。支持跨分类搜索、官方/粉丝来源筛选、稀有度筛选、日期排序、详情页与相关条目。

视觉参考同作者的 [ぶおー法螺貝道場](https://yoshino-buoo.github.io/buo-dojo/)；信息架构参考 [SugarHeartDB](https://nagomi-sugarheart.github.io/SugarHeartDB/)，未复制其页面或数据库。

## 不写代码更新内容

1. 打开站点底部的「資料を編集 / 内容编辑」，在左侧搜索或按分类查找条目，也可以新建。
2. 右侧按「基本信息 / 专属资料 / 详细正文 / 图片 / 关联 / 管理」分组填写。歌曲支持制作人员、唱片、完整曲目表和套装；卡面支持特技、队长效果与自动合计数值；剧情、视频、组合有对应表单。
3. 输入会自动保存在当前浏览器，切换语言、条目、页面或刷新都能恢复。列表简介单独填写；正文支持双语章节、段落和信息表，行可添加、移除、上移、下移。
4. 图片可从带缩略图的素材库选择，或上传 PNG / JPG / WebP（每张最多 8 MB）。上传图片保存在本机 IndexedDB，未上传到服务器。关联条目可以搜索勾选。
5. 点击「预览详情」查看实际详情排版，可单独切换中日文预览和卡面版本。编辑器内的预览用于检查布局，视频播放和站内跳转在公开页面进行。
6. 点击「导出与发布」。编辑器会检查所有当前输入、图片与关联，发现问题可直接定位字段；也会读取最新公开资料，保留其他新条目，遇到同一字段的并发修改时让你选择采用哪个版本。
7. 下载并解压发布包，将解压后的 `public` 文件夹整体拖入编辑器提供的 GitHub 上传页，点击 **Commit changes**。新增图片和素材清单会随包导出；没有新图片时也可仅下载 `catalog.json`。GitHub Actions 随提交自动验证并部署。

草稿仅属于当前浏览器，保存不等于公开。导出包含当前已填写的表单内容，无需另外点击“保存”。高级 JSON 的修改会先暂存，必须点击“应用 JSON”才会进入发布数据；未应用时会阻止导出，避免遗漏。旧版草稿会提供检查导入入口；导入按 ID 合并，不删除文件中没有的现有条目，并支持撤销。复制、移除行、导入等结构操作可撤销上一步。已有条目的 ID 固定，以免破坏关联和试听配置。未编辑的扩展字段完整保留。没有可靠日期可留空；没有图片也可正常收录。

也可以直接编辑 JSON，或在 Issues 中使用双语表单提交线索。Issue 需要维护者核实后收录，不会自动公开不受信任的内容。

## 自动更新

工作流 `Sync official sources` 每天约北京时间 **12:23** 检查以下公开来源，也可在 Actions 中手动运行：

| 来源                 | 当前实现                   | 覆盖范围                                           |
| -------------------- | -------------------------- | -------------------------------------------------- |
| 灰姑娘女孩官方门户   | 提取官方新闻卡片           | 当前首页中包含芳乃相关关键词的标题、日期、原始链接 |
| 日本哥伦比亚资讯     | 检查最近 3 期公告          | 原文含芳乃、组合或歌曲关键词的公告                 |
| 偶像大师官方 YouTube | 公共 Atom 订阅             | 近期条目中标题或说明匹配关键词的视频               |
| 日本哥伦比亚 YouTube | 公共 Atom 订阅             | 同上                                               |
| 依田こころ Bilibili  | 已核实原投稿链接；可选 RSS | 默认手工更新；可配置维护者有权使用的订阅源         |
| Apple iTunes         | 官方 Search / Lookup API   | 每日刷新已核实的 16 首歌曲的试听地址和商店链接     |

关键词和官方入口位于 `public/data/sources.json`。抓取数据保存在独立的 `public/data/generated.json`，不会覆盖人工整理的 `catalog.json`。自动条目的中文标题为空时显示日文标题。相同来源和分类的人工条目优先显示，可在保留自动同步的同时补充中文说明。

每个来源单独报告状态。网络错误、反爬验证或页面结构变化时保留已有条目；无匹配的新视频是有效结果，不是抓取失败。更新采用规范化 URL 去重和原子写入。同步后的工作流显式触发 Pages，因为 `GITHUB_TOKEN` 提交本身不会触发另一个 push 工作流。

订阅只覆盖近期数据，不保证补全历史、检测全部删除或漏掉关键词之外的关联。GitHub 定时任务可能延迟，仓库长期无活动时也可能暂停，需要在 Actions 恢复。来源状态保存在 generated.json，并在 Actions 运行日志中显示。

### 歌曲试听与 BGM

歌曲详情的试听通过 [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html) 提供，包含直接购买链接、Apple 官方商店标识和音源署名。音频从 Apple CDN 直接流式播放，不下载到仓库、不缓存音乐文件、不循环试听片段，也不把试听当作全站 BGM。离开歌曲页时停止试听；同一歌曲切换中日文保留播放位置。

`config/listening.json` 保存人工核实的歌曲 ID 对应关系。新收录歌曲不会猜测匹配同名音源：确认 Apple 曲目链接中的数字 ID 后加入此文件，再运行 `npm run sync:music`。脚本一次批量查询并核对歌名、演唱者和版本，将结果写入 `public/data/listening.json`。接口故障保留已有数据；单首撤下时保留上次地址和可用的商店入口，不影响歌曲条目的收录。当前《日々あどべんちゃーなのでしてー》为 GAME VERSION 试听，《桜の風》保留官方视频入口。

背景音乐使用维护者提供的《日々あどべんちゃーなのでしてー（オリジナル・カラオケ）》完整音频（5:37），来自 2021 年唱片《STARLIGHT MASTER GOLD RUSH! 12 パ・リ・ラ》。原 Ogg 文件转为 AAC / M4A，并移除文件附带元数据，保存在 `public/audio/hibi-instrumental.m4a`，以兼容 Safari 等浏览器。著作权归相关权利人所有。

右下角只有一个 BGM 开关，默认开启、自动循环，音量固定为轻柔的 22%。浏览器允许时自动播放；被有声自动播放策略拦截时，在第一次点击页面或按 Enter／空格后启动。跨站内页面连续播放，刷新或重新进入网站从曲首播放，仅记住开关偏好。手动关闭会保存在浏览器，之后的点击、刷新和媒体结束都不会擅自重新开启。歌曲试听期间暂停 BGM，试听暂停、结束或载入失败后恢复；视频展开期间暂停 BGM，收起视频或离开该页后恢复。替换背景音乐时更新音频文件以及关于本站中的曲目信息。

首页的标题细节、分类插画、资讯栏与小游戏区域的柔光均有独立动效。暂停按钮控制整个首页，离屏区域暂停循环，并遵循系统的“减少动态效果”设置。

### Bilibili 的具体情况

2026-09-12 实测：用户提供的短链接 `https://b23.tv/lKa2W4C` 跳转至 `https://space.bilibili.com/11748057`。普通浏览器能显示公开投稿；直接 HTTP 请求有时返回验证码页，投稿 API 也可能触发访问限制。因此没有把这条接口包装成已经稳定运行的自动抓取。

已从公开页面核实并收录个人回忆、营业剧情、活动、卡面语音、私服等投稿。汉化系列固定地址为 [芳乃剧情汉化](https://space.bilibili.com/11748057/lists/2423723?type=series)。标题和链接保留作者归属，视频支持站内嵌入播放，也可前往原站，粉丝汉化不标为官方。

如有维护者有权使用的 Bilibili RSS 服务，在仓库 **Settings → Secrets and variables → Actions** 添加 `BILIBILI_FEED_URL`。随后手动执行 `Sync official sources` 验证。该 URL 只在服务端工作流中读取，不写入页面；导入的视频地址仅接受 bilibili.com 的 BV 视频链接。不会发送登录 Cookie、破解签名或处理验证码。不可用时仍保留原记录。

## 本地开发

需要 Node.js 22 和 npm。

```sh
npm ci
npm run dev
npm test
npm run build
```

开发预览为 `http://127.0.0.1:5173/`。`npm run build` 先校验所有数据和本地图片，再生成 `dist/`。使用相对资源路径与 hash 路由，兼容 GitHub Pages 的 `/YoshinoDB/` 子路径；详情页刷新不会产生 404。

```text
app.js                         页面、语言、检索和 hash 路由
editor.js / editor.css          分组表单、素材选择、导入、预览与发布包
lib/editor-schema.js           七类资料的表单定义
lib/editor-data.js             草稿合并、冲突检测与字段校验
lib/editor-assets.js           本机图片存储与 ZIP 导出
loading.js / loading.css       首屏资源等待与手帖翻开转场
style.css                      和风主题与响应式布局
lib/data.js                    共享数据校验、合并规则
public/data/catalog.json       人工核实的双语资料
public/data/generated.json     自动更新结果与各来源健康状态
public/data/listening.json     官方歌曲试听地址与商店链接
config/listening.json          人工核实的音乐平台曲目 ID
listening.js / listening.css   BGM、试听与音视频互斥
home-art.js / home-motion.css  首页分类插画和环境动效
public/data/sources.json       抓取来源、关键词
public/assets/                 官方立绘、唱片封面及出处说明
scripts/sync.mjs                定时数据同步
scripts/sync-lib.mjs            RSS/Atom 与新闻解析
scripts/validate.mjs            发布前检查
.github/workflows/pages.yml    构建与 GitHub Pages 发布
.github/workflows/sync.yml      定时同步并触发发布
```

## 部署

仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。推送到 `main` 或手动运行 `Deploy to GitHub Pages` 即可。拉取请求不触发生产部署。网站不需要后台、数据库或付费服务。可用 GitHub 历史提交恢复内容。

## 素材与版权

立绘来自 [BNE 官方芳乃人物页](https://cinderellagirls.idolmaster-official.jp/idol/yoshino/)，唱片封面来自该官方门户的对应唱片页面，详见 `public/assets/CREDITS.md`。只把素材用于相关角色资料的展示，不主张拥有其版权。

**非营利声明不等于获得素材使用许可。** 官方页面未提供开放再利用授权；图片、角色名称、音乐等权利归各自权利人。网站保留版权标注和权利人删除/更正联络入口。视频使用平台提供的嵌入播放器，文章提供摘要和原文链接，不下载视频文件、搬运全文或完整游戏台词。

このサイトは、株式会社バンダイナムコエンターテインメントおよび各関連企業・団体とは関係のない、非公式・非営利のファンサイトです。

THE IDOLM@STER™ & ©Bandai Namco Entertainment Inc.

## 预览图与字体维护

`image` 可选，路径形如 `assets/example.jpg`。将图片上传到 `public/assets/`，再在内容编辑页填写这个路径；预览按钮可以检查图片。`imageSource` 保存原图网址，卡面可用 `gallery` 记录特训前后两张图。图片下载归档在本站，列表和详情不依赖第三方防盗链。素材清单见 `public/assets/manifest.json`。

新条目即使暂时抓不到封面也会正常收录，列表显示对应分类图标。同步会保留文字资料，并在后续运行重试封面；已有封面下载失败时继续显示上一张图片。仅当填写的本地图片文件不存在或路径不安全时，构建才会阻止发布。自动提交同时包含 JSON 和新增图片。

中文标题使用 Noto Serif SC，中文正文依次使用 PingFang SC、Microsoft YaHei；日文保留独立字体栈。Noto Serif JP/SC 的字重 400–700 和完整 Unicode 分片已部署到 `public/fonts/`，按页面实际文字加载，不依赖 Google Fonts 在线服务。字体授权见 `public/fonts/OFL.txt`。

## 分类详情与动画

卡面 `card` 包含特技、队长效果和特训前后最大等级／亲爱度数值；`gallery` 保存两版插画。歌曲 `music` 包含演唱者、作词作曲编曲、唱片编号与曲目表。视频 `video` 可设置投稿者、时长、系列和 `parts` 分集；剧情 `story` 支持出演成员、活动期间与 `chapters` 篇章链接。组合 `unit` 包含成员、首次组合活动和代表曲。资讯可用 `sections` 增加段落、信息表，并用 `gallery` 展示更多图片。`relatedIds` 可以指定相关条目。页面中的内容编辑器提供这些扩展字段的结构化表单，保留未修改的字段；管理分组也提供高级 JSON 编辑。

`description` 是列表与详情页开头的简短导语，介绍作品的气质、场景、看点或背景。作词作曲、成员名单、技能数值、商品规格等放在对应扩展字段中，避免在导语重复罗列。搜索会同时检索导语与制作人员、唱片编号、角色成员等资料。

动效由 `motion.js` 与 `motion.css` 管理：首页有文字分层揭幕、环绕金线、柔光、光点、立绘轻摆与鼠标视差。人物旁的开关会暂停持续动效并记住选择；切到后台或离开首页视口时也会暂停，系统“减少动态效果”优先。

分类切换直接对真实页面进行分层入场，筛选时列表高度平滑衔接。分类导航、图片尚未载入或浏览器不支持 View Transitions 时，保留旧视口的静态画面，等新内容开始显现后再淡出，避免“旧页完全退场、新页尚未出现”的白屏。保留画面放在不可交互的隔离层中，不重复绑定控件或启动媒体；连续导航会从当前叠合画面继续，结束后清理。

封面进入详情使用浏览器 View Transitions，捕获完整的封面容器，保留裁切和当前悬停姿态；点击时暂停尚未结束的入场动画，避免图片突然恢复原位。新页面截图中的可见内容与动画结束后保持一致，结束后才继续观察屏幕外的滚动入场。滚动后点击封面时，页头跟随整页交接，避免回到页顶时提前闪现；位于页顶时仍保留稳定的页头和原有卡面动效。入场使用独立的 `translate`／`rotate`／`scale` 属性，悬停使用 `transform`，两者不会覆盖。快速导航和卡面反向切换会取消前一次动画，并从当前画面继续。

`npm run test:browser` 运行真实浏览器回归检查，覆盖转场截图与实际内容的一致性、快速分类与筛选、卡面反向切换、移动端双语布局、减少动态效果与金线循环接缝。新增 Chrome 桌面与 WebKit 移动视口的连续录屏检查，逐帧检查点击后有无空白，并验证降级转场保留的视口与点击前一致。先执行 `npx playwright install chromium webkit` 并安装 FFmpeg（macOS：`brew install ffmpeg`；Ubuntu：`sudo apt-get install ffmpeg`；其他位置可设置 `FFMPEG_PATH`）。macOS 优先使用已安装的 Chrome。GitHub Pages 发布前也会运行这些检查。

首次打开文档时显示与站点一致的纸色、朱印加载遮罩，最少停留 1.8 秒。首屏可见图片和字体就绪后，两张纸页从中缝向左右外侧翻开，同时开始首页入场；站内导航不重复显示遮罩。资源失败或等待过久会继续进入页面，不让读者一直停在加载页。系统“减少动态效果”启用时改为短淡出。

试听控制保留稳定的 SVG 节点，避免进度刷新或 BGM 淡入时替换点击目标，支持连续播放／暂停。足迹详情的前后篇导航只做页面切换，不会抓取旧条目的封面产生残留；从列表点封面进入详情仍保留封面转场。
