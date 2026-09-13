# 卡面详情的 Q 版芳乃

CGSS 卡片的 `card.petit` 保存服装对应的透明姿态图。当前收录 BWIKI 芳乃人物页提供的 19 套、每套 4 张，共 76 张 PNG；初始 N 卡没有对应的 Wiki 素材，因此不使用其他服装替代。

素材索引与人物页 CGSS 卡片标签的次序一致，保存在 `wikiIndex` 中；姿态图片使用本地 `public/assets/petit-yoshino-NN-P.png`，每张图片的 `imageSource` 保留原图地址。总大小 1,912,708 字节。

- [BWIKI 芳乃人物页](https://wiki.biligame.com/imascg/依田芳乃)
- [Wiki 组件实现参考](https://wiki.biligame.com/imascg/index.php?title=MediaWiki:PetitIdolDanceSerifu.js&action=raw)
- 示例文件名：`CGSS-Yoshino-Petit-15-1.png`，对应［縁結日和］。

这里使用这些透明角色图片，交互与动画代码由本站单独实现，没有引入 Wiki 的脚本、台词气泡或全站计时器。角色图像权利归 Bandai Namco Entertainment 等相应权利人所有，沿用站点页脚的版权署名。

## 更新方式

网页编辑器 → 选择 CGSS 卡片 → 详细资料 → **Q 版芳乃**：设置来源页面，添加一至四张姿态图片。支持图片选择、预览和导出，日语界面同一栏为「ぷち芳乃」。删除此字段即可不显示组件。

组件只在进入视野时加载当前卡片的图片，所有可选姿态解码后才开放切换。普通状态使用 CSS transform 摇摆，点击使用短暂的 Web Animations 轻跳；可以暂停，并支持系统的减少动态效果设置。滚出视野、切到后台时停止动作；移除页面时自动断开观察器和事件监听。切页的静态副本不启动第二份组件。
