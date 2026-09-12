# 芳乃のよりみち帖 · YoshinoDB

依田芳乃的非官方、非营利粉丝资料站。默认日语，可切换简体中文。

[打开网站](https://yoshino-buoo.github.io/YoshinoDB/) · [内容编辑器](https://yoshino-buoo.github.io/YoshinoDB/#editor) · [补充与纠错](https://github.com/yoshino-buoo/YoshinoDB/issues/new/choose)

提供角色档案、卡片与服装、歌曲、剧情、组合、视频、年表和资讯。支持跨分类搜索、官方/粉丝来源筛选、稀有度筛选、日期排序、详情页与相关条目。

视觉参考同作者的 [ぶおー法螺貝道場](https://yoshino-buoo.github.io/buo-dojo/)；信息架构参考 [SugarHeartDB](https://nagomi-sugarheart.github.io/SugarHeartDB/)，未复制其页面或数据库。

## 不写代码更新内容

1. 打开站点底部的「資料を編集 / 内容编辑」。
2. 选择已有条目，或者填写新条目的日文标题、中文说明、来源等信息。
3. 点击「保存到草稿」，再点击「下载 JSON」。草稿存储在当前浏览器，尚未公开。
4. 点击编辑器中的「在 GitHub 编辑公开数据」，将下载的文件内容粘贴替换 `public/data/catalog.json`。
5. 点击 GitHub 的 **Commit changes**。提交到 `main` 后，GitHub Actions 自动验证并部署。

重新进入编辑器会恢复本机草稿。公开数据有其他人更新时，应先导入最新的 `catalog.json`，再修改，以免覆盖他人的新条目。编辑器保留已有条目的图片、稀有度等扩展字段。首次增添图片，将图片放入 `public/assets/`，在条目中设置 `image: "assets/文件名.jpg"`。没有可靠日期时请留空，不要填写收录日冒充发布日期。

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

关键词和官方入口位于 `public/data/sources.json`。抓取数据保存在独立的 `public/data/generated.json`，不会覆盖人工整理的 `catalog.json`。自动条目的中文标题为空时显示日文标题。相同来源和分类的人工条目优先显示，可在保留自动同步的同时补充中文说明。

每个来源单独报告状态。网络错误、反爬验证或页面结构变化时保留已有条目；无匹配的新视频是有效结果，不是抓取失败。更新采用规范化 URL 去重和原子写入。同步后的工作流显式触发 Pages，因为 `GITHUB_TOKEN` 提交本身不会触发另一个 push 工作流。

订阅只覆盖近期数据，不保证补全历史、检测全部删除或漏掉关键词之外的关联。GitHub 定时任务可能延迟，仓库长期无活动时也可能暂停，需要在 Actions 恢复。来源状态保存在 generated.json，并在 Actions 运行日志中显示。

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
editor.js                      本地表单、导入、预览与导出
style.css                      和风主题与响应式布局
lib/data.js                    共享数据校验、合并规则
public/data/catalog.json       人工核实的双语资料
public/data/generated.json     自动更新结果与各来源健康状态
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

卡面 `card` 包含特技、队长效果和特训前后最大等级／亲爱度数值；`gallery` 保存两版插画。歌曲 `music` 包含演唱者、作词作曲编曲、唱片编号与曲目表。视频 `video` 可设置投稿者、时长、系列和 `parts` 分集；剧情 `story` 支持出演成员、活动期间与 `chapters` 篇章链接。组合 `unit` 包含成员、首次组合活动和代表曲。资讯可用 `sections` 增加段落、信息表，并用 `gallery` 展示更多图片。`relatedIds` 可以指定相关条目。页面中的内容编辑器会保留这些扩展字段；新增扩展内容可直接编辑 JSON。

`description` 是列表与详情页开头的简短导语，介绍作品的气质、场景、看点或背景。作词作曲、成员名单、技能数值、商品规格等放在对应扩展字段中，避免在导语重复罗列。搜索会同时检索导语与制作人员、唱片编号、角色成员等资料。

动效由 `motion.js` 与 `motion.css` 管理：首页有分层入场、缓慢流转的柔光与金线、飘动光点；人物旁的开关可暂停持续动效并记住选择。封面进入详情采用浏览器 View Transitions，在不支持的浏览器中使用普通页面入场。卡面切换有光影掠过与交叉淡化，分类选中背景平滑移动，封面悬停有轻微景深和随指针移动的光照。系统启用“减少动态效果”后停止动画；首页离开视口或切到后台时暂停持续动效，页面切换和筛选会释放旧的观察对象。
