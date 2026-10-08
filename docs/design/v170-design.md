# 裂界战线 V1.7 设计依据

由内置 image_gen 工具生成，2026-10-08。战斗界面参考为 game-ui-concept-v170.png，运行时不使用整屏截图。

视觉主张：深海蓝的战术指挥台，青色部署提示、琥珀能量，既能看清战线，也能快速读懂卡牌。

内容结构：主菜单由一张无文字的裂隙战场插画承托游戏名称与开始按钮；战役列表给出下一任务和难度；战斗保留宽战区，将抽牌信息放进底部指挥带，右侧仅保留预报、目标和卡牌详情。

交互：手牌抬升表示选择；部署环和真实落点匹配；战役与结算轻微入场；减少动态效果设置禁用装饰运动。单位、血条、费用、倒计时都由真实引擎状态驱动。

素材：assets/riftfront-command-v170.png 是独立主菜单背景；现有单位、建筑与地图纹理继续使用。为适配实际两路/三路地图和10张手牌，战斗布局不逐像素照搬四张手牌的概念图。

## 战斗界面提示词

Use case: ui-mockup
Asset type: high fidelity main gameplay screen design reference for an existing Chinese offline real-time tactical card PvE web game, Riftfront 裂界战线.
Primary request: improve this actual game into a polished, enjoyable premium strategy game. A single complete playable-looking battle screen, landscape 16:10. Preserve the reference's blue vs red futuristic faction theme, top down / slight isometric battlefield, left player base to right enemy base, two bridges over a shadow-purple rift, small varied squads advancing horizontally. Keep tower / character proportions compact relative to the arena.
Layout: very slim top dark command bar with player core health on left, opponent core health on right, centered mission name and timer. Battlefield takes 78% width and most of height; a narrow right mission inspector with next wave countdown, clear objective and selected card description. No left sidebar. Bottom command deck is a single strip, circular golden energy indicator left, five large legible illustrated tactical cards in center, compact draw pile indicator right. At top left of the field a restrained tutorial prompt with exactly one useful action. Clear cyan friendly deployment territory and readable selected-card placement circle, beautiful two bridges.
Style: sophisticated science fiction tactical command interface, cinematic navy and charcoal, weathered metal bridges over a luminous violet abyss, cyan ally accents, warm amber energy, red enemy accents; use clear modern sans serif Chinese typography, crisp readable labels, understated borders, strong hierarchy, restrained subtle atmospheric effects, richly illustrated cartoon-realistic units similar to the provided reference.
Text (verbatim): 裂界战线; 桥头诱饵; 02:42; 我方核心; 敌方核心; 下一波攻势; 目标：摧毁敌方核心; 选择卡牌，在蓝色区域部署; 战术能量; 6/10; 步兵小队; 前哨自动炮; 战地医疗; 轨道轰击; 暂停
Constraints: front-facing full screen game UI, no browser chrome, no device frames, no payment UI, no collage, legible practical implementable layout. A reference image for implementation, not a promotional poster. Keep the battlefield mostly uncluttered and units clearly visible; no tiny unreadable paragraphs.

## 主菜单插画提示词

Use case: stylized-concept
Asset type: background illustration for the title menu of an existing Chinese real-time tactical card game "Riftfront", no text or UI.
Primary request: a polished cinematic science fiction battlefield across a violet dimensional rift, steel federation blue energy soldiers facing shadow creatures over two ancient metal bridges. A confident blue armored small squad and one larger guardian robot stand in the lower right foreground, surveying illuminated twin bridges and a distant floating violet citadel. Beautiful stylized 3D / painterly game concept art with tactile worn metal, rocky cliffs, wisps of fog, cyan powered armor details, tiny amber beacon lights.
Composition: extra wide landscape 16:9. Right 60 percent rich with characters and depth. Left 40 percent naturally very dark quiet deep blue fog and open negative space to later overlay real title text and buttons in code. Horizon around 45 percent height. Heroic, mysterious, inviting, not horror.
Color palette: deep midnight navy, luminous restrained cyan accents, distant violet rift, warm amber small lights. The base is navy not a saturated purple wash.
Constraints: only artwork, absolutely no writing, letters, typography, logos, watermarks, panels, cards, UI, or frames. Crisp expressive silhouettes and high production game art. Not photorealistic people.
