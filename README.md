# Visa Assistant Demo

可运行的本地前端原型，视觉以用户提供的浅色侧栏、深蓝色按钮与紧凑表格为准。

## 运行

需要 Node.js 22.12+。在项目目录执行：

```powershell
npm install
npm run dev
```

打开 http://localhost:4173。生产检查与运行：

```powershell
npm run build
npm start
```

截图使用本机 Microsoft Edge 或 Google Chrome 的独立无头会话，不读取日常浏览器的登录状态。若未安装这两个浏览器，可运行 `npx playwright install chromium`，或在 `.env` 中指定 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。

## 已实现的流程

- Applicant：查询、新建、详情；Name / Visa Type / Occupation；O1B 可选，O2B/O3B 禁用。
- URL Screenshot：选择申请人、输入公开 URL、A4 或自定义尺寸；读取 DOM、提取主体、重新排版并输出固定画布 PNG；Copy Image 和 Send to Image Description。
- Image Description：多图上传（最多 10 张，每张不超过 8 MB），文件名切换，每图独立 Criterion 和 Context；所有图片具备 Criterion 后一次生成；逐张编辑、Copy、Save。
- Saved Evidence：仅显式 Save 的材料进入申请人档案；卡片显示材料和描述；再次打开编辑并 Save Changes；不重复创建同一条已保存材料。
- 六类 Criterion 严格沿用原型：Critical Role / Media Coverage / Key Position / Commercial Success / Recommendation Letters / High Salary。
- 桌面布局与移动端折叠导航，加载、错误、空白、成功状态。

## 服务状态与限制

**存储当前为本地持久化**：`.data/workbench.json`。刷新页面和重启服务后仍保留申请人和已保存材料；上传后未保存的批次仅存在于当前页面内存。未连接 Supabase，不声称已经云端保存。`supabase/schema.sql` 提供后续接入的结构。

**AI 默认是明确标记的演示草稿**：只使用提供的 Context 或截图提取文字，不进行视觉理解，不编造身份、奖项或结果。若需要真实视觉描述，复制 `.env.example` 为 `.env` 并配置 `OPENAI_API_KEY`，重启服务后启用。密钥仅保存在服务端。此配置会将用户选择生成的图片、申请人信息、Criterion 和 Context 发送至配置的 AI 服务。

**网页截图为真实功能，但不是通用网站兼容保证**：优先使用 article/main 等语义区域与文本密度；对于视频页尝试抓取 video 元素当前画面或封面。MSN/Bilibili 的动态内容、登录限制、反自动化策略或跨域播放器可能使提取失败。页面被阻止时明确报错，不伪造真实截图。提供标注为虚构的本地样例文章用于稳定演示。尚未完整验证 MSN 和 Bilibili 的特化兼容性。

服务仅监听本机回环地址，不带登录机制，不应直接部署到公网。截图接口限制公开 HTTP(S) 地址，阻止常见私有地址及页面请求中的私网目标；这不是为不可信公网用户设计的浏览器隔离服务。

## 演示路径

1. 新建申请人，或打开 Taylor Smith。
2. 进入 URL Screenshot，选择申请人，输入公开文章 URL；也可点击 Use sample article。
3. 点击 Send to Image Description，确认申请人、图片及真实截图的 Source URL 自动带入。
4. 选择每张图片的 Criterion，按需填写 Context，再点击 Generate Descriptions for All。
5. 切换图片并编辑英文描述，逐张 Save。
6. 回到 Applicants，打开对应申请人和 Saved Evidence，编辑后 Save Changes。

参考模板中的 O2B / O3B 样例不作为本轮开放功能；以最终确认的仅 O1B 可创建规则为准。
