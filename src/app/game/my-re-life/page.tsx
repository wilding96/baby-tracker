"use client";

import { useEffect } from "react";
import Link from "next/link";
import "./styles.css";

export default function CeoLovesMePage() {
  useEffect(() => {
    // 剧情游戏逻辑，完整移植自 F:/我的南京/ceo-loves-me/src/main.ts
    // 原文件顶部 import "./styles.css" 已由本页 import 承接
interface GameState {
  player: string;
  power: number;
  fame: number;
  sceneId: string;
  dialogueIndex: number;
  loop: number;
  memories: string[];
}

interface Choice {
  text: string;
  power: number;
  fame: number;
  nextSceneId: string;
  requiresMemory?: string;
  requiresPower?: number;
  requiresFame?: number;
  gainMemory?: string;
}

interface Scene {
  id: string;
  title: string;
  image?: string;
  imageStops?: { at: number; image?: string; background?: "gray" | "black" }[];
  dialogue: string[];
  choices?: Choice[];
  isEnding?: boolean;
  endingType?: "god" | "pride" | "small" | "coward";
  onLoop?: boolean;
}

const gameState: GameState = {
  player: "",
  power: 0,
  fame: 0,
  sceneId: "",
  dialogueIndex: 0,
  loop: 1,
  memories: []
};

const scenes: Scene[] = [
  // ============ 序章：人物登场 ============
  {
    id: "prologue",
    title: "序章 · 废柴的一天",
    dialogue: [
      "我叫金飞飞，24 岁，林氏科技前端部最不起眼的一个实习生。",
      "林氏科技——国内顶尖的互联网巨头。能进去的人，要么是名校高材生，要么是家世显赫的富二代。",
      "而我，两个都不是。我能进这家公司，全靠妹妹内推。",
      "王小语，我同父异母的妹妹，林氏科技设计部的。她随她妈姓王，我随我爸姓金。",
      "她妈当年是技术总监王总的旧识。靠这层关系，她进了设计部，后来又顺手把我推了进来。",
      "在这寸土寸金的大公司里，我们俩算是踩着一条人情的缝，硬挤进来的。",
      "妹妹嘴毒，心软，标准的刀子嘴豆腐心。",
      "「哥！你再不起来，我就把你早饭倒了喂楼下的猫！」",
      "你揉了揉眼睛，翻了个身。新的一天，又开始了。"
    ],
    choices: [
      { text: "神清气爽，晨跑去上班", power: 5, fame: 0, nextSceneId: "l1-morning" },
      { text: "踩点冲刺，路上跟同事打招呼混脸熟", power: 0, fame: 5, nextSceneId: "l1-morning" },
      { text: "赖床五分钟，赌一把不会迟到", power: 0, fame: 0, nextSceneId: "l1-morning" }
    ]
  },

  // ============ 第 1 轮：废柴的日常 ============
  {
    id: "l1-morning",
    title: "第一轮 · 晨会",
    imageStops: [
      { at: 5, image: "/images/kaihui.png" }
    ],
    dialogue: [
      "地铁上，你盯着窗外的城市，脑子里还想着那个没改完的方案。",
      "林氏科技的写字楼是这座城市的地标。玻璃幕墙反射着清晨的光，光鲜得晃眼。",
      "你走进大楼，工牌在胸前晃了晃：「前端部 · 金飞飞 · 实习生」。",
      "电梯里，同事们三五成群地聊着，没人看你一眼。",
      "在他们眼里，你这种没背景、没名校光环的实习生，转正都难。",
      "周一晨会。技术总监王总把一份方案摔在桌上，纸页散了一地。",
      "王总：「金飞飞——这写的什么东西？页面卡成 PPT，数据全错，你也配叫前端工程师？」",
      "王总冷哼一声：「就你这水平，还『飞飞』？先学会爬吧。真不知道是哪尊大佛把你给请进来的。」",
      "「——哦，我想起来了。你妹妹王小语她妈，塞进来的吧？」",
      "他语气玩味，像在揭一道最难堪的疤。会议室里的笑声，更响了。",
      "会议室里，全组哄笑。有人把纸张当垃圾踢到一边。",
      "你蹲下去，一张一张捡起来。王总踩住其中一张，没松脚。",
      "「捡什么？捡起来继续当废纸？」",
      "你看见人群最后面，妹妹静静站着，没说话。"
    ],
    choices: [
      { text: "攥紧拳头，低头认了", power: 0, fame: 0, nextSceneId: "l1-humiliate" },
      { text: "「王总，方案有问题我改。」", power: 5, fame: -5, nextSceneId: "l1-humiliate" },
      { text: "抬眼直视：「这方案不是我交的那版。」", power: 10, fame: -10, nextSceneId: "l1-humiliate" }
    ]
  },
  {
    id: "l1-humiliate",
    title: "第一轮 · 羞辱",
    dialogue: [
      "散会后，富二代空降程序员陆少拦在走廊，晃着腕上的金表。",
      "陆少：「哟，这不是我们林氏第一废柴吗？这鞋——地摊淘的吧？一百？」",
      "周围同事笑成一片。有人起哄：「陆少别欺负人了，人家一个月工资买不起你表带。」",
      "陆少忽然指着你工牌，笑得更夸张：「金飞飞？飞飞？就你，飞个屁！飞得起来吗？我看你趴地沟里爬都费劲。」",
      "满走廊都是笑声。",
      "陆少拍拍你肩膀：「听哥一句劝，这行业水太深，你不适合。早点滚，别丢人现眼。」",
      "你站在原地。指甲陷进掌心。",
      "人群散开时，妹妹从旁边走过，丢下一句：",
      "「哥，丢人现眼的是你。」",
      "她的声音很冷。可你看见，她走的时候，肩膀在轻轻发抖。"
    ],
    choices: [
      { text: "夜里加班，改方案证明自己", power: 10, fame: 0, nextSceneId: "l1-claim" },
      { text: "越想越气，半夜爬起来练代码", power: 15, fame: 0, nextSceneId: "l1-claim" },
      { text: "憋着不吭声，但把今天的事全记下", power: 5, fame: 5, nextSceneId: "l1-claim" }
    ]
  },
  {
    id: "l1-claim",
    title: "第一轮 · 抢功",
    imageStops: [
      { at: 4, image: "/images/office-night-2.png" }
    ],
    dialogue: [
      "深夜 11 点，办公室只剩你一个人。",
      "你重写了方案，正想存档，屏幕弹出一条消息。",
      "组长陈组长：「金飞飞，你那个方案的原稿我看了。写得不错。明天我帮你上报。」",
      "你愣住了。那不是你的方案——是他刚改了个名，就变成他的了。",
      "门被推开。妹妹拎着一杯奶茶进来，放在你桌上。",
      "妹妹：「又加班？就你这种废物，加再多班，功劳也是别人的。」",
      "你没说话。她骂完，转身要走，又停住。",
      "「……奶茶放了，凉了别喝，伤胃。」",
      "她走了。你看见杯壁上贴着一张便利贴，字迹潦草：",
      "「方案我偷偷备份在你 E 盘了，蠢货。」"
    ],
    choices: [
      { text: "谢谢你，妹妹", power: 10, fame: 0, nextSceneId: "l1-death" },
      { text: "眼眶发酸，攥紧那张便利贴", power: 5, fame: 5, nextSceneId: "l1-death" },
      { text: "把便利贴拍照存档——证据在手", power: 15, fame: 0, nextSceneId: "l1-death" }
    ]
  },
  {
    id: "l1-death",
    title: "第一轮 · 深夜",
    imageStops: [
      { at: 0, background: "gray" }
    ],
    dialogue: [
      "凌晨两点。你终于把方案改完了，眼前发黑。",
      "起身想倒杯水，忽然，整层楼的灯，灭了。",
      "黑暗中，你听见身后，有什么东西「滋啦」一声——",
      "火花。电线短路，蓝色的电弧在脚边炸开。",
      "你想躲，可一天的屈辱、饥饿、疲惫，让你的腿像灌了铅。",
      "火光漫上来之前，门被人猛地撞开——",
      "是妹妹。她满身是汗，直直朝你扑过来，一把把你拖开。",
      "你想说什么。可眼前一黑，失去了意识。",
      "黑暗中，你听见她哭着喊：",
      "「哥——！你别睡！哥！」",
      "世界，陷入寂静。"
    ],
    onLoop: true
  },

  // ============ 第 2 轮：觉醒，小打脸 ============
  {
    id: "l2-morning",
    title: "第二轮 · 重生",
    dialogue: [
      "「叮——」",
      "你猛地睁开眼。眼前，是熟悉的天花板。",
      "你抬手。掌心的旧伤疤还在——可那是你一个月前才摔的。",
      "手机屏幕亮着：周一，早 7:00。",
      "你愣住了。今天，是你被王总当众撕方案的那天。",
      "是你在火光里死掉的那天。",
      "可你……醒过来了。",
      "你记得一切。每一句羞辱，每一道目光，每一个字。",
      "门外，妹妹的声音传来：「哥！起床了！再不起来要迟到啦——」",
      "你慢慢坐起身，眼底有东西亮了一下。",
      "这一次。不一样了。"
    ],
    choices: [
      { text: "深呼吸，平静地收拾出门", power: 5, fame: 0, nextSceneId: "l2-meeting" },
      { text: "对着镜子，一字一句：「我回来了。」", power: 10, fame: 0, nextSceneId: "l2-meeting" },
      { text: "先给妹妹做顿早饭，再出门", power: 0, fame: 10, nextSceneId: "l2-meeting" }
    ]
  },
  {
    id: "l2-meeting",
    title: "第二轮 · 反杀",
    dialogue: [
      "晨会。同样的会议室。同样的王总。",
      "王总把方案摔在桌上，纸页散了一地：「金飞飞，你这写的什么垃圾——」",
      "这一次，你在他开口前，缓缓起身。",
      "「王总。」你声音平静，「这版是昨晚 3 点前的旧稿。真正的方案，我今早重做了。」",
      "全场安静。",
      "你从包里抽出一份崭新的文档，拍在桌上。",
      "「页面加载提速 400%，数据接口重构，全部测试通过。连东区机房的主机配置，我也顺手调优了。」",
      "「王总，要不要现场演示？」",
      "会议室里，死一般寂静。王总张着嘴，说不出话。",
      "有人小声说：「东区机房不是昨天刚出问题吗……他什么时候调的？」"
    ],
    choices: [
      { text: "当场演示，用实力说话", power: 20, fame: 10, nextSceneId: "l2-demo" },
      { text: "点到为止，收刀入鞘", power: 10, fame: 15, nextSceneId: "l2-demo" },
      { text: "先留一手，藏三分锋芒", power: 15, fame: 5, nextSceneId: "l2-demo" }
    ]
  },
  {
    id: "l2-demo",
    title: "第二轮 · 技惊四座",
    dialogue: [
      "大屏幕亮起。你的系统界面，流畅得不像话。",
      "数据滚动的瞬间，全场倒吸一口冷气。",
      "「这……这加载速度，比我们现有系统快十倍吧？」",
      "「东区机房那台宕机两天的服务器……怎么好了？」",
      "你合上电脑，云淡风轻：「小事。多看了两行日志而已。」",
      "散会后，陆少堵住你，金表晃得刺眼：",
      "「哟，废柴翻身了？就这？我让家父投个五百万，你这种水平我一天雇一打。」",
      "你抬头看他，忽然笑了。",
      "「陆少，你的表，昨天下午 3 点 47 分停了 3 秒。」",
      "陆少脸色一僵。",
      "「因为你家集团的数据中心，昨天宕机了。我顺手查了下原因——」你压低声音，「你爹是不是还不知道，你把你爸的测试库玩崩了？」",
      "陆少的脸，瞬间煞白。"
    ],
    choices: [
      { text: "「别紧张，我不会说。不过——以后少踩人。」", power: 10, fame: 20, nextSceneId: "l2-sister" },
      { text: "「今天的事，还请你保密。」淡淡转身", power: 15, fame: 10, nextSceneId: "l2-sister" },
      { text: "顺势敲打：「你欠我一个人情。」", power: 20, fame: 5, nextSceneId: "l2-sister" }
    ]
  },
  {
    id: "l2-sister",
    title: "第二轮 · 妹妹",
    dialogue: [
      "傍晚，妹妹拦住你，上下打量，像在看外星人。",
      "妹妹：「哥，你今天……不太一样。」",
      "你：「哪里不一样？」",
      "她沉默了很久，忽然小声问：",
      "「你是不是……遇到过什么很坏的事？」",
      "你愣住。她的眼神，认真得不像平时那个毒舌的妹妹。",
      "「我知道你一直在装。」她说，「你骗得了别人，骗不了我。」",
      "「哥。你出事那天，我做了个噩梦。梦里有火，你倒在地上，我拉不起来你。」",
      "她别过脸：「反正……你要是真有什么事，就告诉我。别一个人扛。」",
      "你心里一暖，伸手揉她脑袋。",
      "她一巴掌拍开：「哎呀烦死了！下班了赶紧回家！」",
      "可你看见，她转过身时，偷偷擦了擦眼角。"
    ],
    choices: [
      { text: "「有你在，哥什么都不怕。」", power: 10, fame: 0, nextSceneId: "l2-conspiracy" },
      { text: "「回家，我给你做你爱吃的。」", power: 0, fame: 10, nextSceneId: "l2-conspiracy" },
      { text: "「哥在查一件大事，你帮我盯着点。」", power: 15, fame: 0, nextSceneId: "l2-conspiracy" }
    ]
  },
  {
    id: "l2-conspiracy",
    title: "第二轮 · 黑手",
    dialogue: [
      "夜里，你躺在床上，把这一世的记忆从头到尾捋了一遍。",
      "有些事，不对劲。",
      "你死前那一晚——整层楼的电闸，是谁拉的？",
      "东区机房「恰好」在你改方案那天宕机；王总「恰好」当众撕你的方案；陆少「恰好」第二天就来羞辱你。",
      "太多巧合，串在一起，就变成了算计。",
      "你打开电脑，指尖在键盘上飞速跳动。",
      "屏幕上，一个名字渐渐浮现——",
      "一个用「王总」的权限账号，从今天下午开始，悄悄往境外服务器传输公司核心数据的记录。",
      "你眯起眼。",
      "原来如此。这场轮回里藏着的，不止是欺负你的小丑。",
      "还有一条，试图把林氏卖掉的蛀虫。"
    ],
    choices: [
      { text: "深挖下去，揪出幕后黑手", power: 15, fame: 0, nextSceneId: "l2-death", gainMemory: "黑手徽记" },
      { text: "保存证据，天亮再说", power: 5, fame: 5, nextSceneId: "l2-death" },
      { text: "故意留下痕迹，引蛇出洞", power: 20, fame: -10, nextSceneId: "l2-death" }
    ]
  },
  {
    id: "l2-death",
    title: "第二轮 · 代价",
    imageStops: [
      { at: 6, image: "/images/lunhui-2-jifang.png" },
      { at: 12, background: "black" }
    ],
    dialogue: [
      "凌晨三点，你终于把完整的证据链梳理完，存进加密盘。",
      "起身去倒水。路过窗边，你无意识地瞥了一眼窗外。",
      "楼下停车场，一辆黑色车里，亮着一点猩红的烟头。",
      "有人在盯着这栋楼。",
      "你的心猛地一沉。",
      "可就在这时——「轰」。",
      "你背后的机房，整排机柜，电流像蛇一样蹿过，火花炸开。",
      "这一世，你躲开了火花。",
      "可黑暗中，一支针管，无声地扎进你的后颈。",
      "「你查得太多了。」一个陌生的声音，在黑暗里响起。",
      "你倒下之前，最后一眼，看见那个黑影的袖口，绣着一个暗金色的徽记。",
      "意识消散前，你死死记住：加密盘的密码，藏在妹妹手机相册第 13 张照片里。",
      "世界，陷入黑暗。"
    ],
    onLoop: true
  },

  // ============ 第 3 轮：碾压，终极打脸 ============
  {
    id: "l3-morning",
    title: "第三轮 · 全知",
    dialogue: [
      "「叮——」",
      "你再一次睁开眼。",
      "窗外，是周一早 7:00 的阳光。",
      "但这一次，你知道的，远不止两世。",
      "脑海中，如洪水般涌来的——是三年前的自己。",
      "那个叫「Zero」的天才，曾凭一己之力，写出改变整个行业的系统。",
      "却在巅峰时突然销声匿迹，被所有人遗忘。",
      "而你，就是 Zero。",
      "轮回两次，你终于想起了自己是谁。",
      "你缓缓坐起身，嘴角勾起一个弧度。",
      "王总。陆少。陈组长。还有那支针管后面的黑手。",
      "今天，是你们所有人的——末日。",
      "门外，妹妹的声音响起：「哥！起床！今天我非要看看你葫芦里卖的什么药！」",
      "你笑了：「来。哥今天，演一场大戏给你看。」"
    ],
    choices: [
      { text: "神挡杀神，佛挡杀佛", power: 20, fame: 0, nextSceneId: "l3-board" },
      { text: "扮猪吃虎，一剑封喉", power: 15, fame: 10, nextSceneId: "l3-board" },
      { text: "先给妹妹做顿早饭，告诉她别担心", power: 5, fame: 15, nextSceneId: "l3-board" }
    ]
  },
  {
    id: "l3-board",
    title: "第三轮 · 董事会",
    dialogue: [
      "林氏科技，董事会。",
      "王总正在慷慨陈词，把公司核心系统升级的功劳往自己身上揽。",
      "「多亏我带队攻坚，才保住这次年度大客户……」",
      "门，被推开了。",
      "你拎着一台笔记本，走进会议室。所有人的目光，齐刷刷看过来。",
      "董事长皱眉：「你是哪个部门的？」",
      "你把笔记本往桌上一放：「林氏科技前端部，金飞飞。当然——你们可能更熟悉我的另一个名字。」",
      "你敲下一个回车。大屏幕上，数据瀑布般倾泻而下。",
      "「Zero。」",
      "「三年前写出这套核心系统的人。」",
      "会议室，炸了。",
      "王总的脸色，瞬间惨白。"
    ],
    choices: [
      { text: "当众揭穿黑手，甩出证据链", power: 30, fame: 20, nextSceneId: "l3-reveal" },
      { text: "先给董事长看数据，再亮身份", power: 20, fame: 25, nextSceneId: "l3-reveal" },
      { text: "全网直播，让全行业看着你封神", power: 25, fame: 30, nextSceneId: "l3-reveal" },
      { text: "连幕后黑手一起揪出来", power: 30, fame: 30, nextSceneId: "l3-reveal", requiresMemory: "黑手徽记" }
    ]
  },
  {
    id: "l3-reveal",
    title: "第三轮 · 一剑封喉",
    dialogue: [
      "你当着所有人的面，一页页拉开证据链。",
      "「东区机房宕机——王总让人拔的。」",
      "「核心数据外泄——王总账号操作的。」",
      "「境外服务器——他收的钱，走的海外账户。」",
      "王总拍案而起：「血口喷人！这是诽谤！」",
      "你轻轻抬手，点开一段录音。",
      "王总的声音，从会议室音响里响起：「把数据传出去，钱已经到账了……」",
      "全场，鸦雀无声。",
      "董事长脸色铁青：「王建国，你还有什么话说？」",
      "王总瘫坐在椅子上，像一滩烂泥。",
      "富二代陆少、陈组长，一个个脸色发白，腿都软了。",
      "你合上电脑，淡淡道：",
      "「林氏科技，从今天起，我接手。」",
      "「至于你们几个——」你看向瘫软的反派们，笑容和善，「保安，送客。」"
    ],
    choices: [
      { text: "接管公司，把林氏带上巅峰", power: 20, fame: 30, nextSceneId: "l3-sister" },
      { text: "「收拾干净就行，公司还是你们的。」转身就走", power: 30, fame: 20, nextSceneId: "l3-sister" },
      { text: "先不亮底牌，把谈判筹码攥在手里", power: 25, fame: 25, nextSceneId: "l3-sister" }
    ]
  },
  {
    id: "l3-sister",
    title: "第三轮 · 我哥只能我骂",
    dialogue: [
      "走廊尽头，妹妹堵住你，双手抱胸，眼眶发红。",
      "妹妹：「金飞飞！你——」",
      "你做好准备挨骂。",
      "妹妹：「你装废柴装了三年！三年！你知不知道我有多担心！我还以为你要被人欺负死了！」",
      "她越说越气，拳头锤在你胸口：",
      "「你为什么不早说！你知不知道你每次受委屈，我回去都睡不着！」",
      "你笑着任她锤：「这不是，想看看谁会欺负我，再一锅端吗。」",
      "她愣住。然后「噗嗤」笑出来。",
      "她吸了吸鼻子，转身朝围观的人群，凶巴巴地吼：",
      "「看什么看！我哥，只有我能骂！谁敢碰他一下试试！」",
      "人群瞬间作鸟兽散。",
      "她转回来，红着脸，声音低下去：",
      "「……不过哥，你刚才真帅。」",
      "你揉揉她脑袋：「走，哥请你吃大餐。」",
      "她一巴掌拍开：「钱留着！你要是破产了我还得养你！」",
      "可你看见，她转过身时，笑得眼睛都弯了。"
    ],
    choices: [
      { text: "执掌林氏，重登巅峰", power: 30, fame: 30, nextSceneId: "ending-god", requiresPower: 60, requiresFame: 40 },
      { text: "深藏功名，低调带妹", power: 20, fame: 40, nextSceneId: "ending-pride", requiresPower: 60 },
      { text: "带妹妹离开，另起炉灶", power: 15, fame: 35, nextSceneId: "ending-small", requiresFame: 45 },
      { text: "继续装，深藏不露", power: 10, fame: 10, nextSceneId: "ending-coward" }
    ]
  },

  // ============ 结局 ============
  {
    id: "ending-god",
    title: "结局 · 封神",
    isEnding: true,
    endingType: "god",
    dialogue: [
      "林氏科技，董事长的交椅，你坐了上去。",
      "三年后，林氏市值翻了几十倍，核心系统依旧写着「Zero」。",
      "你成了整个行业仰望的存在。",
      "而每次你出席发布会，台下总有个人，抱胸站着，一脸嫌弃：",
      "「就他？我哥？啊对对对，就那个被我从小骂到大的。」",
      "「……不过谁要敢动我哥，我第一个不答应。」",
      "全场哄堂大笑。",
      "你站在台上，看着人群里那个凶巴巴的妹妹，忽然觉得——",
      "这世上所有的高处，都不如她一句「我哥只能我骂」。",
      "你赢了全世界。",
      "而她，赢了你。"
    ]
  },
  {
    id: "ending-pride",
    title: "结局 · 深藏功名",
    isEnding: true,
    endingType: "pride",
    dialogue: [
      "董事会的事，你交给董事长善后。你只在幕后，远程控场。",
      "林氏从此多了个神秘的「技术顾问」，从不露面。",
      "没人知道，那个让全行业竞相追逐的人，每天准时下班，回家给妹妹做饭。",
      "妹妹窝在沙发上刷剧，头也不抬：「哥，今天做红烧肉。」",
      "你系上围裙：「好嘞。」",
      "偶尔，你会想起那两世的火，和黑暗里扎来的针管。",
      "但那些，都不重要了。",
      "重要的是——妹妹的叫声，还响着。",
      "红烧肉的香味，还飘着。",
      "而当年的那些坏人，早已经在铁窗里，学起了法律条文。",
      "你笑了笑，锅铲一翻。",
      "这日子，真不错。"
    ]
  },
  {
    id: "ending-small",
    title: "结局 · 另起炉灶",
    isEnding: true,
    endingType: "small",
    dialogue: [
      "你把证据甩给董事长，带着妹妹，离开了林氏。",
      "「哥，我们真要去创业？」妹妹眼睛亮晶晶的。",
      "「嗯。哥带你看点更大的。」",
      "你在城中村租了个小办公室，妹妹当你的前台、财务、HR、产品经理。",
      "三个月后，一个叫「Zero 实验室」的小作坊，做出一款秒杀全行业的产品。",
      "一年后，林氏董事长的私人飞机，停在你公司楼下。",
      "他弯着腰，递上名片：「Zero 先生，之前多有得罪——我们，能谈谈合作吗？」",
      "你还没来得及说话，妹妹探出头：",
      "「合作可以。先把当年欺负我哥的道歉信，抄一百遍。」",
      "董事长：「……」",
      "你笑出声。",
      "这一世，你没追着谁复仇。",
      "你只是，带着妹妹，走得比谁都高，都远。"
    ]
  },
  {
    id: "ending-coward",
    title: "结局 · 大隐隐于市",
    isEnding: true,
    endingType: "coward",
    dialogue: [
      "董事会上，你盯着那些证据，看了很久。",
      "最后，你把电脑合上，起身，说了句：",
      "「不好意思，走错会议室了。」",
      "你继续当你的废柴实习生。",
      "王总继续踩你，陆少继续炫富，陈组长继续抢功。",
      "你全都忍了。",
      "因为你知道，真正的猎手，不需要暴露自己。",
      "你只是，偷偷把每一条蛀虫的证据，都存好，收好，藏好。",
      "然后在某个深夜，匿名寄给了有关部门。",
      "一个月后，新闻爆出：林氏科技多人涉嫌职务侵占、泄露商业机密，被带走调查。",
      "你站在人群里，看着昔日那些踩你的人，一个个被押上警车。",
      "妹妹站在你身边，忽然开口：",
      "「哥，我知道是你干的。」",
      "你：「……」",
      "她撇撇嘴：「你骗不了我。我哥——就是个闷声干大事的狠人。」",
      "你笑了。",
      "「那你也得给我保密。」",
      "她举起三根手指：「我哥最坏了。我最喜欢了。」",
      "有些高手，从不亮剑。",
      "但他提过的刀，从不会落空。"
    ]
  }
];

const sceneImages: Record<string, string> = {
  prologue: "/images/bedroom.png",
  "l1-morning": "/images/dianti.png",
  "l1-humiliate": "/images/corridor.png",
  "l1-claim": "/images/office-night.png",
  "l2-morning": "/images/bedroom.png",
  "l2-meeting": "/images/meeting.png",
  "l2-demo": "/images/meeting.png",
  "l2-sister": "/images/meimei-1.png",
  "l2-conspiracy": "/images/lunhui-2-night.png",
  "l2-death": "/images/lunhui-2-night.png",
  "l3-morning": "/images/bedroom.png",
  "l3-board": "/images/boardroom.png",
  "l3-reveal": "/images/boardroom.png",
  "l3-sister": "/images/baomeimei.png",
  "ending-god": "/images/press-conf.png",
  "ending-pride": "/images/kitchen.png",
  "ending-small": "/images/startup.png",
  "ending-coward": "/images/street.png"
};



for (const scene of scenes) {
  const image = sceneImages[scene.id];
  if (image != null) {
    scene.image = image;
  }
}

const scenesMap = new Map(scenes.map((item) => [item.id, item]));

function initGameUI(): void {
  const app = document.getElementById("app")!;

  app.innerHTML = `
<div class="game-container">
  <div class="scene-container">
    <div class="scene-image">
      <img id="scene-img" src="" alt="" />
      <div id="scene-placeholder" class="scene-placeholder"></div>
    </div>

    <h2 id="scene-title" class="scene-title"></h2>

    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">实力</span>
        <div class="stat-bar">
          <div id="power-bar" class="stat-fill power" style="width: 0"></div>
        </div>
        <span id="power-value" class="stat-value">0</span>
      </div>

      <div class="stat-item">
        <span class="stat-label">声望</span>
        <div class="stat-bar">
          <div id="fame-bar" class="stat-fill fame" style="width: 0"></div>
        </div>
        <span id="fame-value" class="stat-value">0</span>
      </div>

      <div class="stat-item loop-item">
        <span class="stat-label">周目</span>
        <span id="loop-value" class="loop-value">第 1 轮</span>
      </div>
    </div>

    <div class="scene-content">
      <div class="dialogue-box">
        <p id="dialogue-text" class="dialogue-line dialogue-fade-in"></p>
      </div>

      <div id="choices-area"></div>
    </div>
  </div>
</div>
`;
}

function getSceneVisual(scene: Scene): { image?: string; background?: string } {
  let visual: { image?: string; background?: string } = { image: scene.image };

  if (scene.imageStops != null) {
    for (const stop of scene.imageStops) {
      if (gameState.dialogueIndex >= stop.at) {
        visual = { image: stop.image, background: stop.background };
      }
    }
  }

  return visual;
}

function updateSceneInfo(title: string, visual: { image?: string; background?: string }, titleClass: string = ""): void {
  const titleElement = document.getElementById("scene-title")!;
  const imageElement = document.getElementById("scene-img") as HTMLImageElement;
  const placeholder = document.getElementById("scene-placeholder")!;

  titleElement.className = `scene-title ${titleClass}`;
  titleElement.textContent = title;

  // 特殊背景：置灰 / 纯黑（不显示图片）
  if (visual.background != null) {
    imageElement.style.display = "none";
    placeholder.classList.add("active");
    placeholder.textContent = "";
    placeholder.style.backgroundImage = "none";
    placeholder.style.backgroundColor = visual.background === "black" ? "#000000" : "#3a3a3a";
    return;
  }

  // 无图：显示文字占位
  if (visual.image == null) {
    imageElement.style.display = "none";
    placeholder.classList.add("active");
    placeholder.textContent = title;
    placeholder.style.backgroundImage = "";
    placeholder.style.backgroundColor = "";
    return;
  }

  placeholder.classList.remove("active");
  imageElement.style.display = "";

  // 修复闪烁：只有图片真正变化时才切换，且直接替换、不做淡出空窗
  if (imageElement.getAttribute("src") !== visual.image) {
    imageElement.src = visual.image;
    imageElement.alt = title;
  }
}

function updateStats(): void {
  const powerBar = document.getElementById("power-bar")!;
  const powerValue = document.getElementById("power-value")!;
  const fameBar = document.getElementById("fame-bar")!;
  const fameValue = document.getElementById("fame-value")!;
  const loopValue = document.getElementById("loop-value")!;

  const powerClamped = Math.max(0, Math.min(100, gameState.power));
  const fameClamped = Math.max(0, Math.min(100, gameState.fame));

  powerBar.style.width = `${powerClamped}%`;
  powerValue.textContent = `${powerClamped}`;

  fameBar.style.width = `${fameClamped}%`;
  fameValue.textContent = `${fameClamped}`;

  loopValue.textContent = `第 ${gameState.loop} 轮`;
}

function formatDialogue(text: string): string {
  return text.replace(/\{称呼\}/g, gameState.player || "你");
}

function updateDialogue(dialogue: string[]): void {
  const dialogueText = document.getElementById("dialogue-text")!;

  dialogueText.textContent = formatDialogue(dialogue[gameState.dialogueIndex]);
  dialogueText.classList.remove("dialogue-fade-in");

  void dialogueText.offsetWidth;

  dialogueText.classList.add("dialogue-fade-in");
}

function updateChoices(choicesHtml: string): void {
  document.getElementById("choices-area")!.innerHTML = choicesHtml;
}

function updateContinueButton(onContinue: () => void): void {
  document.getElementById("choices-area")!.innerHTML = `
<div class="continue-container">
  <button class="continue-button" id="continue-btn">继续 ▼</button>
</div>
`;

  document.getElementById("continue-btn")!.addEventListener("click", onContinue);
}

function availableChoices(scene: Scene): Choice[] {
  if (scene.choices == null) {
    return [];
  }

  return scene.choices.filter((choice) => {
    if (choice.requiresMemory != null && !gameState.memories.includes(choice.requiresMemory)) {
      return false;
    }
    if (choice.requiresPower != null && gameState.power < choice.requiresPower) {
      return false;
    }
    if (choice.requiresFame != null && gameState.fame < choice.requiresFame) {
      return false;
    }
    return true;
  });
}

function renderScene(): void {
  const scene = scenesMap.get(gameState.sceneId);

  if (scene == null) {
    return;
  }

  if (scene.isEnding) {
    renderEndingScene(scene);
    return;
  }

  if (scene.onLoop) {
    renderDeathScene(scene);
    return;
  }

  const isLastDialogue = gameState.dialogueIndex >= scene.dialogue.length - 1;
  const choices = availableChoices(scene);

  const choicesHtml = isLastDialogue && choices.length > 0
    ? `
    <div class="choices-container">
      ${choices.map((choice, index) => `
        <button class="choice-button" data-index="${index}">
          ${choice.text}
        </button>
      `).join("")}
    </div>
  `
    : "";

  if (document.getElementById("scene-title") == null) {
    initGameUI();
  }

  updateSceneInfo(scene.title, getSceneVisual(scene));
  updateStats();
  updateDialogue(scene.dialogue);

  if (isLastDialogue && choices.length > 0) {
    updateChoices(choicesHtml);

    for (const item of document.querySelectorAll(".choice-button")) {
      item.addEventListener("click", (event) => {
        const index = Number.parseInt((event.target as HTMLElement).dataset.index || "0");
        handleChoice(choices, index);
      });
    }
  } else {
    updateContinueButton(() => {
      gameState.dialogueIndex += 1;
      renderScene();
    });
  }
}

function handleChoice(choices: Choice[], choiceIndex: number): void {
  const scene = scenesMap.get(gameState.sceneId);

  if (scene == null) {
    return;
  }

  const choice = choices[choiceIndex];

  gameState.power = Math.max(0, Math.min(100, gameState.power + choice.power));
  gameState.fame = Math.max(0, Math.min(100, gameState.fame + choice.fame));
  gameState.sceneId = choice.nextSceneId;
  gameState.dialogueIndex = 0;

  if (choice.gainMemory != null && !gameState.memories.includes(choice.gainMemory)) {
    gameState.memories.push(choice.gainMemory);
  }

  renderScene();
}

function renderEndingScene(scene: Scene): void {
  const isLastDialogue = gameState.dialogueIndex >= scene.dialogue.length - 1;

  const choicesHtml = isLastDialogue
    ? `
    <div class="choices-container">
      <button class="choice-button restart-button" id="restart-btn">
        恭喜通关
      </button>
    </div>
  `
    : "";

  if (document.getElementById("scene-title") == null) {
    initGameUI();
  }

  updateSceneInfo(scene.title, getSceneVisual(scene), scene.endingType ? `ending-${scene.endingType}` : "");
  updateStats();
  updateDialogue(scene.dialogue);

  if (isLastDialogue) {
    updateChoices(choicesHtml);
    document.getElementById("restart-btn")!.addEventListener("click", () => {
      location.reload();
    });
  } else {
    updateContinueButton(() => {
      gameState.dialogueIndex += 1;
      renderEndingScene(scene);
    });
  }
}

function enterLoop(nextLoop: number): void {
  gameState.loop = nextLoop;
  gameState.power = 0;
  gameState.fame = 0;
  gameState.sceneId = "";
  gameState.dialogueIndex = 0;
}

function renderLoopTransition(nextLoop: number, startSceneId: string): void {
  const app = document.getElementById("app")!;

  app.innerHTML = `
<div class="loop-transition">
  <div class="loop-content">
    <h2 class="loop-title">重生</h2>
    <p class="loop-subtitle">第 ${nextLoop} 周目 · 记忆苏醒，重写命运</p>
    <button class="start-button loop-button" id="loop-continue-btn">继续</button>
  </div>
</div>
`;

  document.getElementById("loop-continue-btn")!.addEventListener("click", () => {
    enterLoop(nextLoop);
    gameState.sceneId = startSceneId;
    renderScene();
  });
}

function handleDeath(scene: Scene): void {
  const nextLoop = gameState.loop + 1;
  const loopTarget: Record<number, string> = {
    2: "l2-morning",
    3: "l3-morning"
  };

  const startSceneId = loopTarget[nextLoop] ?? "l3-morning";

  renderLoopTransition(nextLoop, startSceneId);
}

function renderDeathScene(scene: Scene): void {
  const isLastDialogue = gameState.dialogueIndex >= scene.dialogue.length - 1;

  if (document.getElementById("scene-title") == null) {
    initGameUI();
  }

  updateSceneInfo(scene.title, getSceneVisual(scene), "ending-death");
  updateStats();
  updateDialogue(scene.dialogue);

  if (isLastDialogue) {
    updateChoices(`
    <div class="choices-container">
      <button class="choice-button restart-button" id="death-btn">
        重生
      </button>
    </div>
  `);
    document.getElementById("death-btn")!.addEventListener("click", () => {
      handleDeath(scene);
    });
  } else {
    updateContinueButton(() => {
      gameState.dialogueIndex += 1;
      renderDeathScene(scene);
    });
  }
}

function renderSceneEntry(): void {
  const scene = scenesMap.get(gameState.sceneId);

  if (scene == null) {
    return;
  }

  if (scene.onLoop) {
    renderDeathScene(scene);
    return;
  }

  renderScene();
}

function renderStartScreen(): void {
  const app = document.getElementById("app")!;

  app.innerHTML = `
<div class="start-screen">
  <div class="start-content">
    <div class="start-badge">✨ 重生爽文剧场</div>
    <h1 class="game-title">我的妹妹不可爱</h1>
    <p class="game-subtitle">重生逆袭 · 无限打脸 · 极致爽文</p>

    <div class="start-features">
      <span>🔁 多周目</span>
      <span>⚡ 选择分支</span>
      <span>🏆 多结局</span>
    </div>

    <button class="start-button" id="start-game-btn">开始游戏</button>
    <p class="start-hint">点击开始后，我会先准备好剧情画面</p>
  </div>
</div>
`;

  const startButton = document.getElementById("start-game-btn")!;

  startButton.addEventListener("click", () => {
    gameState.sceneId = "prologue";
    gameState.dialogueIndex = 0;
    startWithLoading();
  });
}

function collectSceneImages(): string[] {
  const urls = new Set<string>();

  for (const scene of scenes) {
    if (scene.image != null) {
      urls.add(scene.image);
    }
    if (scene.imageStops != null) {
      for (const stop of scene.imageStops) {
        if (stop.image != null) {
          urls.add(stop.image);
        }
      }
    }
  }

  return Array.from(urls);
}

function startWithLoading(): void {
  const app = document.getElementById("app")!;

  app.innerHTML = `
<div class="loading-screen">
  <div class="loading-content">
    <div class="loading-emoji">🎬</div>
    <h2 class="loading-title">正在准备剧情...</h2>
    <p class="loading-status" id="loading-status">正在加载第一张画面</p>
    <div class="loading-bar-track">
      <div class="loading-bar-fill" id="loading-bar-fill"></div>
    </div>
    <p class="loading-percent" id="loading-percent">0%</p>
  </div>
</div>
`;

  const urls = collectSceneImages();
  const fill = document.getElementById("loading-bar-fill")!;
  const percent = document.getElementById("loading-percent")!;
  const status = document.getElementById("loading-status")!;

  let loaded = 0;
  const total = urls.length;

  const updateProgress = () => {
    const progress = total === 0 ? 100 : Math.round((loaded / total) * 100);
    fill.style.width = `${progress}%`;
    percent.textContent = `${progress}%`;
    status.textContent =
      progress >= 100
        ? "准备就绪，马上进入故事"
        : `正在加载剧情画面 ${loaded}/${total}`;
  };

  updateProgress();

  const tasks = urls.map((url) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        loaded += 1;
        updateProgress();
        resolve();
      };
      img.onerror = () => {
        loaded += 1;
        updateProgress();
        resolve();
      };
      img.src = url;
    });
  });

  void Promise.all(tasks).then(() => {
    window.setTimeout(() => {
      gameState.sceneId = "prologue";
      gameState.dialogueIndex = 0;
      renderSceneEntry();
    }, 250);
  });
}

function main(): void {
  renderStartScreen();
}

main();
  }, []);

  return (
    <main
      className="ceo-game-page relative h-screen h-[100dvh] w-full overflow-hidden -mb-20"
      style={{
        backgroundImage:
          "linear-gradient(135deg, #2d1b2e 0%, #1a1a2e 50%, #1f1f3a 100%)",
        color: "#e2e8f0",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, "Segoe UI", Arial, Roboto, "PingFang SC", MiSans, "miui", "Hiragino Sans GB", "Microsoft Yahei", sans-serif',
      }}
    >
      <div id="app" className="ceo-game-app absolute inset-0" />
      <div
        className="ceo-game-back pointer-events-none absolute z-50"
        style={{
          top: "calc(max(12px, env(safe-area-inset-top, 0px)) + 92px)",
          left: "max(14px, env(safe-area-inset-left, 0px))",
        }}
      >
        <Link
          href="/games"
          aria-label="返回游戏站"
          title="返回游戏站"
          className="pointer-events-auto"
          style={{
            display: "inline-flex",
            width: "36px",
            height: "36px",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "999px",
            background: "rgba(0,0,0,0.45)",
            color: "#ffffff",
            fontSize: "20px",
            lineHeight: 1,
            textDecoration: "none",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
          }}
        >
          ‹
        </Link>
      </div>
    </main>
  );
}
