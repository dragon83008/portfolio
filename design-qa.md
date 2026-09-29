# Portfolio review — 2026-09-29

## 2026-09-29 项目封面比例与滚动精修

- 修正独立上传封面的正方形回退：旧封面由本地服务只读获取实际尺寸，项目数据接口带回宽高；新上传封面在草稿中保存网页副本宽高。原件、现有项目记录和排序未被批量改写。无法读取的封面仍保留中性备用画面。
- 分类列表桌面封面最大宽度 520px，窄桌面相对作品栏再收紧；手机采用可用宽度。竖图高度不超过视口约 72%，短屏另留顶部标题空间。主画面按同一比例放大，不裁剪内容。列表入场由较明显的缩放改为 10px 位移与短暂淡入，仍使用自然滚动；减少动态效果时立即显示。
- 「谷物饮品包装」独立封面实际为 1699×926，1440×900 下列表框为 520×283、聚焦框为 690×376；1024×768 为 432×235 → 502×273。390×844 为 337×183 → 358×195；320×568 为 271×148 → 288×157；844×390 为 426×232 → 481×262。全部框比与源图误差小于 1%，无横向溢出。品牌竖版展板的高度约束及滚动标题同步也通过。
- 中间帧确认封面从列表原位置连续放大到主画面，返回后恢复原框尺寸。五尺寸项目焦点、大图、返回和介绍回归脚本通过；独立封面尺寸的后台测试通过。`npm run lint`、`npm test`、`npm run build` 通过。
- 调整前用户截图保存在 `screenshots/cover-sizing-before-user-reference.png`；调整后截图为 `cover-sizing-brand-desktop.png`、`cover-sizing-brand-mobile.png`、`cover-sizing-brand-landscape.png`、`cover-sizing-brand-portrait.png`、`cover-sizing-brand-focus.png`、`cover-sizing-transition-mid.png`。

## 2026-09-29 纵向作品流与内容收尾

- 五个分类的项目封面改为单列纵向排列；靠近视口中央的项目驱动左侧项目名和类别的淡入淡出。滚动保持浏览器自然行为，已露出的封面不会因回滚重复入场。标题中间态发现重影后将淡出提前、淡入稍后启动。
- 最后一轮发现从介绍页按 Esc 返回作品时，个别时序下封面尚未解除非交互状态，焦点无法恢复。现改为作品状态完成渲染后再聚焦；五个检查尺寸均已重测通过。
- 项目焦点与返回层级保持不变：点击封面放大、其他项目淡出；有介绍时再进入分块介绍；收拢图标与 Esc 逐层返回。桌面和手机分类列表的滚动位置在返回后得到保留。
- 后台支持最多 12 个带稳定 ID 的纯文本介绍分块，可增删、改标题和正文、调整顺序。旧单段介绍兼容展示；显式删除全部分块后不会复活旧文字。空分块不显示，封面单独发布不携带项目草稿。
- 微信联系面板显示 `Dragon-30-0` 和本地黑白二维码，原头像及说明区域已去掉。原二维码、输出 PNG、1440px 和 320px 网页截图均自动解析为同一个微信链接。浏览器点击复制与 Esc 关闭也通过；自动识别不能代替用户手机上的最终扫码体验。
- 以简历为来源的「关于我」只在草稿预览展示，等待本人确认文案及海马体任职时间。真实项目的介绍仍为空；测试脚本在隔离数据中填入示例文本，未改动正式项目资料。联系信息尚未获得未来公开部署的许可。
- 当前本地发布数据中有 19 个可见项目、0 个已填写介绍；项目数量随管理端删除与恢复而变化，旧说明中的固定 23 个项目数已移除。
- `npm run lint`、`npm run build`、`npm test` 通过。隔离浏览器脚本在 1440×900、1024×768、390×844、320×568、844×390 验证五个分类、标题、项目放大、介绍分块、空介绍、快速重复点击、视频暂停/恢复、减少动态效果与后台草稿隔离。真实数据浏览器脚本在相同五个视口验证比例、大图及返回，未发现页面错误或横向溢出。
- 截图：`screenshots/flow-title-transition.png`、`project-focus-list.png`、`project-focus-intro.png`、`project-focus-intro-mobile.png`、`project-focus-landscape.png`、`contact-1440.png`、`contact-320.png`、`about-draft.png`。介绍图片里的长文是隔离测试占位文字。

## 2026-09-29 项目聚焦与介绍页

- 分类页点击项目后，封面以固定过渡副本缓动放大到右侧作品栏；其他项目淡出并停止交互。作品素材只来自当前项目，保持原始比例与现有大图查看、视频可见播放逻辑。
- 再点当前封面或信息按钮，作品流渐出，白色项目介绍页渐入；介绍为空时两个入口均不可用。介绍由管理端纯文本字段编辑，支持换行；草稿预览可见，正常发布后才进入正式作品集，单独发布首页封面不会携带介绍修改。
- Esc 和返回按钮按大图、介绍、项目作品、分类列表、首页逐层回退。动画期间重复点击不改变目标；减少动态效果时直接显示最终画面。
- 截图：`screenshots/project-focus-list.png`、`project-focus-transition.png`、`project-focus-work.png`、`project-focus-intro.png`、`project-focus-mobile.png`、`project-focus-intro-mobile.png`、`project-focus-landscape.png`。介绍截图使用隔离测试数据中的示例文字，不会写入真实项目。
- `node scripts/verify-project-focus.mjs` 在 1440×900、1024×768、390×844、844×390 及减少动态效果下通过；`node scripts/verify-portfolio.mjs` 在上述尺寸及 320×568 通过。测试覆盖空介绍、连续点击、Esc、大图查看、比例、无横向溢出与后台草稿隔离。`npm run lint`、`npm run build`、`npm test` 通过；完整视频测试需允许 ffmpeg 子进程启动。
- 保留差异：目前真实项目介绍字段为空，因此正式作品集不会显示介绍按钮；等待用户在管理端逐项填写、确认并发布。

## 首页封面候选与动效精修

- 五张独立文字生成的方形封面已保存为本地原图和 1200px WebP。图片没有生成标题、品牌标记或项目成果；它们仅作为分类概念封面，不冒充真实作品。
- 当前正式首页仍使用原封面；`?coverPreview=1` 从已发布项目读取内容，只叠加草稿中的五张分类封面。管理端的「仅发布首页封面」只复制这五个路径，项目编辑、排序和素材草稿保持原状态。
- 首页切换从 780ms 收至 500ms。点击展开取消多项目闪图，AI 封面随卡片移动，末段淡入真实项目封面；返回时反向淡入分类封面。
- 截图：`screenshots/cover-preview-desktop.png`、`cover-preview-mobile.png`、`cover-preview-landscape.png`、`cover-entry-mid.png`、`cover-admin-mobile.png`。
- 验证：`npm run lint`、`npm run build`、`npm test`、`node scripts/verify-covers.mjs` 均通过；1440×900、1024×768、390×844、844×390 和减少动态效果场景无页面错误或横向溢出。原分类页比例测试的五个视口也通过，但旧的长浏览器脚本在末尾另开页面时浏览器意外退出；本次专项脚本完整退出码为 0。
- 与参考站的保留差异：这里使用静态 AI 分类概念图，参考站使用真实动态作品预览；字体、项目素材与页面数量也不同，不宣称逐帧一致。

## Previous project-group review (historical)

Status: PASS in the local preview. Each category now lists project covers in saved order; clicking a cover opens only that project's assets below its row. On a phone, the expanded content follows the selected cover directly. One project remains expanded at a time, and the full-screen viewer navigates only that project's assets.

- The gallery no longer flattens assets across projects. Portrait pairs are formed inside one project only; images and videos keep their recorded aspect ratios.
- Deleting a project from the manager immediately hides it from the published local portfolio and moves it to the recycle bin. Restore and permanent record removal are immediate as well. Other saved drafts remain unpublished, and uploads/originals are untouched.
- An already-open portfolio tab re-fetches on manager updates and when brought back into focus. In browser testing, deleting the first brand project changed its cover count from six to five without reloading; restoring changed it back to six.
- Checked 1440x900 and 390x844 visually; the automated browser check also passed at 1024x768, 320x568 and 844x390, and opened all five categories. Mobile measurements place expanded content 20px below the selected first or second cover. A brand portrait rendered at 337x477 against its 2400x3394 source ratio.
- `npm run lint`, `npm run build`, `npm test`, and `node scripts/verify-portfolio.mjs` passed. Screenshots: `screenshots/project-group-desktop.png`, `project-group-brand-desktop.png`, `project-group-brand-mobile.png`.

## Previous category-flow review (historical)

Status: PASS for the local preview. The old fixed landscape gallery has been replaced with a Gabriel-inspired category flow. Homepage category cards preview several real works, expand into the right-side work column, and return to the same selected category. This is an adaptation of the [Lightship project page](https://www.gabrielbeaugonin.com/project/lightship), not a frame-by-frame copy.

- Source dimensions were checked with `ffprobe` and recorded in `portfolioData.js`. All 12 brand images are 2400x3394 portrait boards. On desktop, portraits are paired in two columns; on portrait phones, they become single-column. Landscape images and videos take a full row. All artwork uses `object-fit: contain` and a matching aspect-ratio container.
- Desktop has a fixed category title and back control at left, with a vertically scrollable work column at right. Mobile puts the title and back control above the work stream. Captions contain only the project name.
- Clicking an image opens an uncropped viewer with previous/next, Escape and close controls. Videos in the work stream are muted and play only when at least 55% visible; videos pause when the viewer covers the stream. A failed image keeps its title and reserved ratio.
- Videos have a 44px expand control; their full viewer shows normal playback controls. The brand viewer's previous/next and keyboard arrows were checked. The work stream cannot scroll until entry finishes, and is also locked while the full viewer is open.
- Open uses a short cover preview followed by an expanding transition and staggered row arrival. Close uses a fixed transition copy, including when the work stream has been scrolled. Rapid Escape during preview or expansion cancels active transition work. Reduced-motion skips choreography.
- The preview runs through 3–4 works in about 320ms; the card expansion runs to about 1120ms, with the other rows arriving in a short stagger. A scrolled close now exposes the homepage behind the shrinking card instead of leaving a blank background.
- Browser checks passed at 1440x1100, 1024x768, 390x844, 320x568 and 844x390. All five categories open and return; no page errors or horizontal overflow were recorded. Source image ratio and rendered container ratio differed by less than 1% for loaded brand images. All source dimensions were also checked directly with `ffprobe`.
- The 844x390 phone landscape case was corrected after review: it now has the same centered top title and single-column media flow as portrait mobile. Browser assertions check actual item positions rather than only the number of DOM nodes.
- Every selected image/video file now has verified width and height metadata, and all video posters exist. Unknown image paths throw during data initialization rather than silently receiving a landscape default.

Evidence: `screenshots/category-flow-preview.png`, `category-flow-expanding.png`, `category-flow-closing-scrolled.png`, `category-flow-brand-desktop.png`, `category-flow-brand-mobile.png`, `category-flow-brand-landscape.png`, `category-flow-lightbox.png`, and `category-flow-results.json`. Reproduce with `npm run lint`, `npm run build`, and `node scripts/verify-portfolio.mjs`.

Remaining visual difference: the reference uses project-specific animated scenes inside near-square panels. This portfolio has mixed real work formats, so the transition morphs from the square category cover into the first work's native ratio, and the final work stream uses the actual media proportions. Physical Safari/iOS has not been checked.

## Earlier gallery review (historical)

## Real-work gallery review

Status: PASS for the local job-seeking preview. The five homepage categories now use selected real-work covers, and each active cover opens a full-screen project gallery. Source files under `E:\Desktop\作品整理` were not modified.

- Curated 23 projects from 47 source files across commercial advertising, brand design, photography, AI design and short video. Weak exercises, duplicate exports, low-resolution long-form work and uncertain third-party-brand concepts stay outside the main gallery.
- Generated 49 optimized web assets in `public/portfolio/`: responsive WebP images/covers/posters, ten 12.6-second muted H.264 previews and five Wuhan storyboard pages. Total web asset weight is about 41 MB.
- Gallery supports previous/next buttons, project index, multi-image dots, keyboard arrows, Escape, mobile horizontal swipe and close-to-return without changing the selected homepage category.
- Only the active project media is mounted. Video previews autoplay muted and loop; switching projects unmounts the prior video. Broken media falls back to a neutral surface while preserving the project title.
- Mobile review found the first modal fade briefly exposed the homepage under the gallery. Corrected it by making the gallery background opaque immediately and animating only its content.
- Commercial, client-brand and identifiable-person work remains marked `review`. See `asset-review.md` before any public deployment.

Verification passed at 1440x1100, 1440x900, 1024x768, 390x844, 320x568, 844x390, 1024x600, 720x450 and 480x300. Tests cover homepage geometry and animation scheduling, gallery media playback, one-video-at-a-time behavior, project navigation, multi-image switching, failure fallback, touch gestures, reduced motion and horizontal overflow. No browser page errors were recorded.

Current evidence: `screenshots/portfolio-real-gallery-commercial.png`, `portfolio-real-gallery-brand.png`, `portfolio-real-gallery-mobile.png`, `portfolio-real-media-failure.png`, and `portfolio-refined-results.json`.

Reproduction commands: `npm run lint`, `npm run build`, `node scripts/verify-portfolio.mjs`.

## Homepage cover correction

The five category covers now use independent source selection and framing instead of one centered square-crop rule. Commercial uses an active pop-up frame, brand uses the Sanfu product visual, photography uses a new high-resolution snow-mountain source, AI uses the character-and-plush sequence, and short video uses a clean subtitle-free profile frame.

The previously referenced `XLL_3664.dng` was no longer present in the source folder during regeneration. Photography was intentionally updated to the stronger existing `6f6445623bfc15962ced7e9899205516.jpg`, and the gallery title changed from 云雾山景 to 雪山晨光. Original source files remain untouched.

Each cover is generated at 1200×1200 through explicit crop/frame parameters in `scripts/build-portfolio-assets.ps1`. Browser verification captures all five stable homepage states as `screenshots/portfolio-cover-01.png` through `portfolio-cover-05.png`.

## Latest refinement review

Status: PASS for implemented motion, cover handling and responsive checks. Desktop browser-menu 200% zoom was approximated with equivalent CSS viewport reflow, not directly exercised; physical Safari/iOS remains untested.

- One shared scheduler handles arrows, pagination, wheel and touch. While moving, only the latest destination is retained; gestures do not build an unbounded queue. Wheel inertia is coalesced until a 180ms idle gap or direction reversal.
- Caption fades out in 120ms, updates after 546ms (70% of 780ms), and fades in over 180ms. A separate live region announces the completed selection. Pagination indicates the latest requested target.
- Stable work IDs are independent of titles. `coverMode: 'screenshot'` alone applies the existing crop; omitted/standard mode uses full-container `object-fit: cover`. Set standard mode when supplying real images. Image failure hides the broken image while retaining the neutral surface and category.
- Entry sequence is capped at 850ms, with name fade, main-cover unfold, and delayed edge/action appearance. Any first navigation skips it. Reduced-motion preference disables both CSS movement and timed scheduling, including a preference change during a running transition.
- Touch pagination regions are 44x44px. Short landscape uses a compact two-column layout; very short viewports switch to normal document flow and allow scrolling. No fixed 420px minimum remains.

Verification: nine viewports (1440x1100, 1440x900, 1024x768, 390x844, 320x568, 844x390, 1024x600, 720x450, 480x300). The 720x450 case represents layout space at 200% zoom for 1440x900; 480x300 additionally exercises scrollable fallback. Geometry assertions and visual review found no horizontal overflow or active-cover overlap with identity, controls or pagination.

Behavior assertions cover delayed caption and live announcement, continuous intermediate transforms, all five categories, mixed-input latest-target queue, fast reversal, forward/backward wrapping, wheel inertia, stable nodes, native emulated touch, reduced-motion changes, entry interruption, image-request failure, and temporary wide/tall standard-cover fixtures. Fixtures only change the test browser DOM and do not replace user assets. No page errors were recorded.

The first check reported React ref warnings. Corrected state initialization and timer cleanup references; lint now reports no warnings. Entry screenshot review also prompted delayed action/pagination fades so controls do not precede the name.

Current evidence: `screenshots/portfolio-refined-results.json`, `portfolio-refined-<width>x<height>.png`, `portfolio-refined-opening.png`, `portfolio-refined-motion.png`, and `portfolio-refined-image-failure.png`. Fresh `reference-entry-*.png` frames show name-first appearance followed by the full scene. Filenames indicate successive wait intervals, not exact times from navigation. Local entry is an abbreviated interpretation, not identical choreography.

Reproduction commands: `npm run lint`, `npm run build`, `node scripts/verify-portfolio.mjs`.

## Previous review (historical)

The records below describe the preceding version; current refinement notes above supersede its motion timing, touch sizes and opening limitations.

## Result

PASS for the agreed homepage corrections, with the intentional differences below.
This is not a pixel-identical or frame-identical reproduction of the reference.
Reference: https://www.gabrielbeaugonin.com/
Preview: http://127.0.0.1:5173/

## Review and correction rounds

1. Replaced remounted cards with five stable keyed nodes. Removed decorative ghost divs and floating animation. Added real edge-slot transforms, keyboard/wheel/pagination/touch navigation, caption synchronization, reduced-motion support, disabled About feedback and tooltips. Recalibrated desktop/mobile geometry and placeholder framing.
2. First rendered review found edge stacks too broad and hard-edged. Reduced edge scales from .87/.84 to .77/.75, adjusted rotation to 77 degrees, and added a viewport-edge fade. Replaced stretched image sizing with natural-aspect sizing. Removed the old dark root background. Re-ran interaction assertions, screenshots, lint and build after corrections.

## Original 12 findings

| # | Finding | Final disposition |
|---|---|---|
| 1 | Full adjacent covers instead of edge stacks | Resolved: only active cover is fully visible; actual inactive cards form pale perspective stacks. |
| 2 | Broken transition due to remounting | Resolved: DOM identity assertion passes; 180ms and settled transform matrices differ. |
| 3 | Large, heavy type | Resolved: desktop 32px/400, mobile 20px/400. |
| 4 | Identity and buttons too low | Resolved: desktop identity origin (257,461), buttons y584. |
| 5 | Screenshot margins and double rounding | Resolved: frame embedded cover, one outer clipping radius, natural image aspect. |
| 6 | Large shadows and halo | Resolved: removed shadows and background halo. |
| 7 | Caption placement | Intentional: current category only, 12px below cover, as requested. |
| 8 | Mobile proportions | Resolved: 280px cover at 390px viewport, smaller type, no photo fragments at top. |
| 9 | Oversized icons/buttons | Resolved: 15px line icons, desktop 54px/mobile 56px buttons. |
| 10 | Pagination over photo | Resolved: outside image, 28x16px hit regions around 3px dots. Not a claim of full touch-target accessibility compliance. |
| 11 | 1024px card clipping | Resolved: active card x621.6, width300, right921.6 inside 1024px viewport. |
| 12 | Dead About anchor | Resolved: aria-disabled button without navigation, hover/focus explanation; email remains functional. |

## Evidence and measurements

At 1440x1100 the reference identity origin was measured at (257,462.25), with 32px Suisse Intl text. Local origin is (257.03,461), with 32px system fallback text. Reference screenshot cover bounds are approximately (848,378), 335x345; local measured bounds (848.16,377.5), 336x345. Reference buttons start approximately (257,584); local (257.03,584). These desktop anchors are within the 10px target, not a whole-page pixel-diff claim.

At 390x844 the local cover is (55,282), 280x280, matching the reference screenshot's main card bounds. Buttons are (137,746), 56px each. Mobile subtitle is longer than the reference but fits on one line at this width. At 1024px the longer subtitle wraps deliberately to prevent collision.

Verified sizes: 1440x1100, 1440x900, 1024x768, 390x844. No horizontal overflow, missing images, active-card cropping, or caption/button collisions observed.

Automated browser checks: two wheel switches; all five pagination targets; two-direction arrow controls; forward/backward wrap; 11 rapid arrow inputs; stable DOM nodes; nontrivial intermediate transform; native browser touch-event swipe; reduced-motion transitions disabled; About tooltip on focus; mailto destination; zero page errors.

Commands passed:

```text
npm run lint
npm run build
node scripts/verify-portfolio.mjs
```

## Files

- `screenshots/portfolio-reviewed-1440x1100.png`
- `screenshots/portfolio-reviewed-1440x900.png`
- `screenshots/portfolio-reviewed-1024x768.png`
- `screenshots/portfolio-reviewed-390x844.png`
- `screenshots/portfolio-reviewed-motion-180ms.png`
- `screenshots/portfolio-reviewed-next.png`
- `screenshots/reference-reviewed-desktop.png`
- `screenshots/reference-reviewed-mobile.png`
- `screenshots/reference-motion-180ms.png`
- `screenshots/reference-next.png`
- `screenshots/portfolio-review-results.json`

`reference-opening.png` records the reference's initial blank loading frame; it is not accepted as a loaded visual target. The loaded reference screenshots above are the comparison evidence.

## Intentional differences and limits

- All five categories still share the user-supplied static screenshot. Its embedded Lightship label and white content panel are part of that temporary asset, not added UI. Replace the asset and framing when real works arrive.
- The reference has live project media, proprietary typography, four project dots, and additional pages. Local version uses system typography, five categories and no project detail routes.
- Category caption stays below the image. Edge stacks contain two real cards per side, rather than extra decorative repeated layers.
- Transition uses a 780ms CSS perspective animation; continuity is verified, but reference easing and opening choreography are not claimed to be frame-identical. Initial reference loading delay is not imitated.
- Tests were run in Chromium/Edge, including mobile emulation. No claim of physical iOS/Safari validation or complete accessibility compliance.
