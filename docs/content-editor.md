# 内容编辑与发布

## 数据与模板

人工内容集中在 `public/data/catalog.json`；人物页的姓名、罗马字、作品名、属性和立绘说明位于 `profile.identity`。既有内容已迁入数据，原 HTML 结构、CSS、字体、正文、图片及排版均保留。

`content.js` 只负责页面模板。`lib/editor-schema.js` 定义表单字段；`lib/content-templates.js` 提供 11 种新建模板。复制现有页面使用完整深拷贝，仅替换 ID 和标题的副本标记，不经过有损的表单序列化。

`music.appleTrackUrl` 是歌曲试听的人工选择；`public/data/listening.json` 仍是官方接口生成的缓存。浏览器依据歌曲链接找到已核实的试听，`scripts/sync-listening.mjs` 在每日任务中核对新链接。旧版 `config/listening.json` 仅在条目没有此字段时提供兼容映射。显式清空链接会关闭该歌曲试听。被删除歌曲的缓存不会渲染，也不会阻止内容发布，下次同步会清理。

## 实时预览

编辑器加载同源 iframe：`?studio-preview=1#entry/<id>`，人物页使用 `#profile`。它执行相同的 `app.js`、`content.js`、公开 CSS 和试听渲染，因此编辑器控件的样式不会污染主站预览。

父页面以 `postMessage` 发送草稿及本机图片的 Blob URL。双方同时校验消息来源窗口与 origin，普通公开页面不接收草稿。只有嵌入预览模式生成字段标记；点击标记通过共享 schema 定位侧栏表单。更新保留滚动位置、卡面版本和展开的语音分组。语言、预览尺寸和编辑定位属于编辑器控件，不改变主站 UI。

预览展示播放器外观，媒体播放和站外跳转留在公开页面进行，避免重复 BGM 或误离开草稿。图片上传在 IndexedDB 保存普通二进制字节，以兼容 WebKit；读取时还兼容旧版 Blob 草稿。退出编辑器时销毁消息监听和 ResizeObserver。

## GitHub 发布

纯 GitHub Pages 没有可以保管 OAuth client secret 的后台。本实现使用维护者提供的细粒度令牌，直接访问固定的 `api.github.com`，不需要额外服务器。GitHub REST 支持浏览器跨域请求，参见 [GitHub CORS 文档](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests)。

连接密钥只对 `yoshino-buoo/YoshinoDB` 授予 Contents 和 Pull requests 的读写权限。令牌留在当前连接的内存中；请求禁止重定向，不把令牌写入 localStorage、URL、日志、文件或错误文本。没有仓库写入权限的贡献者可导出 ZIP，交给维护者处理。

发布流程：

1. 读取 main 的 SHA，并在此 SHA 上读取 catalog、generated 和必要的素材清单。
2. 使用草稿原始版本、当前草稿、GitHub 最新版本进行三方合并；冲突返回表单处理。采用远端资料时也同步刷新表单，避免旧表单回写已经更新的字段。
3. 校验表单、关联、图片路径及新图片，展示实际修改前后的值。
4. 用户确认后，再检查 main 是否改变。文件以 Git blob/tree/commit 一次组成提交，在 `codex/content-<uuid>` 分支创建 PR，不向 main 写入。
5. `.github/workflows/content-check.yml` 验证 PR。维护者审查并合并后，原有 `pages.yml` 自动部署。若需要强制禁止绕过检查，应在 GitHub 仓库的分支规则中将该检查设为必需；工作流文件本身不会修改仓库分支保护设置。

提交开始前保存不含令牌的 attempt 信息（分支、base SHA、commit SHA 和草稿签名）。网络断开后重试或刷新，先查询同一分支的已有 PR；已上传但尚未创建 PR 的提交可以继续完成。成功提交的草稿不会被清空，直到读取到已包含这些修改的最新资料；同一份草稿会显示原 PR 链接。

GitHub 集成测试使用模拟响应，不创建真实分支或 PR。真实提交需要维护者在编辑器连接自己的密钥并确认。

## 验证

```sh
npm test
npm run build
npx playwright test tests/browser/editor.spec.mjs tests/browser/editor-visual.spec.mjs
npm run test:release
```

浏览器测试覆盖 Chromium / WebKit：双语实时编辑、人物页真实外框、试听与关联、模板复制、本机图片、移动预览、草稿隔离、并发更新，以及确认后才创建 PR。单元测试覆盖最新版本合并、图片原子提交、权限失败、main 改动和提交中断恢复。

数据解耦阶段以改造前的渲染函数和数据作基线，对 198 条资料、独立人物页、两种语言和两种卡面状态进行了 796 次输出比较，全部一致；18 组完整页面截图对照未出现布局或内容变化。

随后按需求增加人物页目录：1280px 起使用右侧随滚动停留的目录，保持正文居中且宽度不变；手机和平板使用顶部折叠目录。`lib/profile-navigation.js` 从实际渲染的章节生成标题与跳转位置，语言切换、增删章节和编辑预览都会自动同步，无需维护第二份目录数据。跳转保留人物页路由，并按系统的减少动态效果设置选择滚动方式。`tests/browser/profile-navigation.spec.mjs` 覆盖 Chromium / WebKit 下的响应式布局、跳转、高亮、键盘操作和预览编辑。
