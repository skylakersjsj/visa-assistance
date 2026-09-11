# Demo 检查记录

2026-09-11，本地运行检查。

已通过：

- 前端正式构建；Node 服务语法检查。
- 对照用户 HTML，在 1280 px 桌面视口检查浅色侧栏、深蓝按钮和姓名/签证类型/职业三列表格。
- 新建 Alex Morgan / O1B / Designer，并进入详情；O2B/O3B 显示为禁用选项。
- 真实读取 https://example.com，输出 1200 × 1697 PNG；剪贴板确认为 image/png。
- Send to Image Description 自动保留 Taylor Smith 和 Source URL。
- 一次上传两张图片，与已传入截图组成 3 张批次。
- 每图独立 Criterion / Context；存在未选择 Criterion 的图片时，批量生成按钮保持禁用。
- 一次生成 3 个明确标注的演示描述；切换图片保持独立的分类、备注和结果。
- 修改文字后 Copy，核对剪贴板文字一致。
- 只保存当前图片，Applicant 的 Saved Evidence 中只有 1 条材料。
- 从 Saved Evidence 再次编辑并 Save Changes；刷新页面后文字仍然保留。
- 390 px 手机视口检查页面宽度和折叠菜单；无横向内容溢出。
- 检查浏览器控制台，未发现错误。

未声称已验证：真实 AI 视觉生成（未配置密钥）、Supabase 云端保存（本轮为本地持久化）、MSN/Bilibili 的完整兼容性、所有第三方网站。

演示工作区保留了一个名为 Alex Morgan 的测试申请人，以及 Taylor Smith 下明确标注为流程测试的 Example Domain 材料，方便回看保存与编辑效果。
