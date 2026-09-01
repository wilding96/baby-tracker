"use client";

import { useEffect } from "react";
import Link from "next/link";
import "./styles.css";
import { applyOutcome, type ChoiceOutcome, MAX_HEARTS } from "./hearts";

export default function CeoLovesMePage() {
  useEffect(() => {
    // 剧情游戏逻辑，完整移植自 F:/我的南京/ceo-loves-me/src/main.ts
    // 原文件顶部 import "./styles.css" 已由本页 import 承接
interface GameState {
  player: string;
  hearts: number;
  sceneId: string;
  dialogueIndex: number;
  loop: number;
  loopStartSceneId: string;
  memories: string[];
}

interface Choice {
  text: string;
  nextSceneId: string;
  requiresMemory?: string;
  gainMemory?: string;
  outcome: ChoiceOutcome;
}

interface LegacyChoice {
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

interface RawScene {
  id: string;
  title: string;
  image?: string;
  imageStops?: { at: number; image?: string; background?: "gray" | "black" }[];
  dialogue: string[];
  choices?: LegacyChoice[];
  isEnding?: boolean;
  endingType?: "god" | "pride" | "small" | "coward";
  onLoop?: boolean;
}

const gameState: GameState = {
  player: "",
  hearts: MAX_HEARTS,
  sceneId: "",
  dialogueIndex: 0,
  loop: 1,
  loopStartSceneId: "prologue",
  memories: []
};

const rawScenes: RawScene[] = [
  // ============ 序章：人物登场 ============
  {
    id: "prologue",
    title: "序章 · 废柴的一天",
    dialogue: [
      "我叫金飞飞，24 岁，林氏科技前端部一个没什么存在感的实习生。",
      "林氏科技是行业里人人都想进的大厂。能进来的人，要么名校出身，要么家里有关系。",
      "我两样都不占。能进来，是因为我妹妹王小语内推。",
      "她是我同父异母的妹妹，在设计部。她随她妈姓王，我随我爸姓金。",
      "她妈和王总有点旧交情。靠着这层关系，她先进了设计部，后来顺手把我也推了进来。",
      "在这个地方，我们俩都算靠人情挤进来的。",
      "我妹妹嘴很毒，但我知道她心软。",
      "「哥！你再不起来，我就把你早饭倒了喂楼下的猫。」",
      "我揉了揉眼睛。新的一天，又开始了。"
    ],
    choices: [
      { text: "起早点，晨跑去公司", power: 5, fame: 0, nextSceneId: "l1-morning" },
      { text: "踩点出门，路上和同事混个脸熟", power: 0, fame: 5, nextSceneId: "l1-morning" },
      { text: "再赖五分钟，赌不会迟到", power: 0, fame: 0, nextSceneId: "l1-morning" }
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
      "地铁上，我盯着窗外的城市，脑子里还是那套没改完的方案。",
      "林氏科技的大楼是这座城市的地标，玻璃幕墙被清晨的光照得发白。我跟着人流刷卡进门，工牌在胸口晃了一下：「前端部 · 金飞飞 · 实习生」。",
      "电梯里，同事三三两两地聊天，没人朝我这边看。",
      "在他们眼里，我这种没背景、没名校光环的实习生，转正都难。",
      "周一晨会，王总把一份方案摔在桌上，纸页散了一地。",
      "王总：「金飞飞——这写的什么东西？页面卡成 PPT，数据全错，你也配叫前端？」",
      "他哼了一声：「就你这水平，还‘飞飞’？先学会爬吧。」",
      "会议室里有人跟着笑。王总像想起什么，又补了一句：「哦，你妹妹王小语她妈，塞你进来的吧？」",
      "我蹲下去一张张捡纸。王总踩住其中一张，没松脚。",
      "「捡什么？捡起来继续当废纸？」",
      "人群最后面，妹妹站着，一直没有说话。"
    ],
    choices: [
      { text: "攥紧拳头，先低头认了", power: 0, fame: 0, nextSceneId: "l1-humiliate" },
      { text: "「王总，方案有问题我改。」", power: 5, fame: -5, nextSceneId: "l1-humiliate" },
      { text: "抬眼看他：「这版不是我交的。」", power: 10, fame: -10, nextSceneId: "l1-humiliate" }
    ]
  },
  {
    id: "l1-humiliate",
    title: "第一轮 · 羞辱",
    dialogue: [
      "散会后，陆少在走廊拦住我，晃着腕上的金表。他是空降来的富二代程序员，最擅长把别人的难堪当热闹。",
      "陆少：「哟，这不是我们林氏第一废柴吗？这鞋地摊淘的吧，一百块？」",
      "周围同事跟着笑。有人起哄：「陆少别欺负人了，人家一个月工资买不起你一条表带。」",
      "陆少盯着我的工牌，笑得更夸张：「金飞飞？飞飞？就你，飞得起来吗？」",
      "他拍拍我的肩膀：「听哥一句劝，这行水太深，你不适合。早点滚，别丢人现眼。」",
      "我站在原地，指甲陷进掌心。",
      "人群散开时，妹妹从旁边走过，丢下一句：「哥，丢人现眼的是你。」",
      "她的声音很冷。可我看见，她走过去的时候，肩膀在轻轻发抖。"
    ],
    choices: [
      { text: "夜里加班，把方案改到无可挑剔", power: 10, fame: 0, nextSceneId: "l1-claim" },
      { text: "越气越清醒，半夜爬起来练代码", power: 15, fame: 0, nextSceneId: "l1-claim" },
      { text: "不吭声，把今天的事先记下", power: 5, fame: 5, nextSceneId: "l1-claim" }
    ]
  },
  {
    id: "l1-claim",
    title: "第一轮 · 抢功",
    imageStops: [
      { at: 4, image: "/images/office-night-2.png" }
    ],
    dialogue: [
      "深夜十一点，办公室只剩我一个人。",
      "我刚把方案重写完，正要存档，屏幕上弹出一条消息。",
      "组长陈组长：「金飞飞，你那个方案的原稿我看了。写得不错，明天我帮你上报。」",
      "我愣住了。那不是他的方案，也不是我的功劳——他把署名换了，就成了他的。",
      "门被推开。妹妹拎着一杯奶茶进来，放在我桌上。",
      "妹妹：「又加班？就你这种废物，加再多班，功劳也是别人的。」",
      "我没说话。她骂完，转身要走，又停住：「奶茶放了，凉了别喝，伤胃。」",
      "她走后，我看见杯壁上贴着一张便利贴，字迹潦草：",
      "「方案我偷偷备份在你 E 盘了，蠢货。」"
    ],
    choices: [
      { text: "谢谢，妹妹", power: 10, fame: 0, nextSceneId: "l1-death" },
      { text: "眼眶发酸，攥紧便利贴", power: 5, fame: 5, nextSceneId: "l1-death" },
      { text: "把便利贴拍照存下来", power: 15, fame: 0, nextSceneId: "l1-death" }
    ]
  },
  {
    id: "l1-death",
    title: "第一轮 · 深夜",
    imageStops: [
      { at: 0, background: "gray" }
    ],
    dialogue: [
      "凌晨两点，我终于把方案改完，眼前发黑。",
      "起身想倒杯水，整层楼的灯忽然全灭了。",
      "黑暗中，我听见身后有什么东西「滋啦」一声。",
      "火花。电线短路，蓝色的电弧在脚边炸开。",
      "我想躲，可一整天的疲惫让腿像灌了铅。",
      "火光漫上来之前，门被人猛地撞开。",
      "是妹妹。她满身是汗，直直朝我扑过来，把我往外拖。",
      "我想说什么，可眼前一黑，失去了意识。",
      "迷迷糊糊里，我听见她哭着喊：「哥——！你别睡！哥！」",
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
      "我猛地睁开眼，眼前是熟悉的天花板。",
      "抬手，掌心的旧伤疤还在，可那是上个月才摔的。",
      "手机屏幕亮着：周一，早上七点。",
      "今天，正是我被王总当众撕方案的那天，也是我在火光里死掉的那天。",
      "可我现在醒了过来，而且记得每一个细节。",
      "门外，妹妹的声音传来：「哥！起床了！再不起来要迟到啦——」",
      "我慢慢坐起身。",
      "这一次，不一样了。"
    ],
    choices: [
      { text: "深呼吸，平静地收拾出门", power: 5, fame: 0, nextSceneId: "l2-meeting" },
      { text: "对着镜子，低声说一句「我回来了」", power: 10, fame: 0, nextSceneId: "l2-meeting" },
      { text: "先给妹妹做顿早饭", power: 0, fame: 10, nextSceneId: "l2-meeting" }
    ]
  },
  {
    id: "l2-meeting",
    title: "第二轮 · 反杀",
    dialogue: [
      "晨会，同样的会议室，同样的王总。",
      "王总把方案摔在桌上，纸页散了一地：「金飞飞，你这写的什么垃圾——」",
      "这一次，我在他开口之前站了起来。",
      "「王总，」我的声音很平静，「那只是昨晚三点前的旧稿。真正的方案，我今天早上重做了。」",
      "我从包里抽出一份新文档，放到桌上。",
      "「加载提速、接口重构、测试通过，连东区机房的配置我也顺手调了。要不要现场演示？」",
      "会议室里安静下来。王总张了张嘴，没说出话。",
      "有人小声问：「东区机房昨天才出问题，他什么时候调的？」"
    ],
    choices: [
      { text: "当场演示，用结果说话", power: 20, fame: 10, nextSceneId: "l2-demo" },
      { text: "点到为止，不再多解释", power: 10, fame: 15, nextSceneId: "l2-demo" },
      { text: "先留一手，别把底牌亮完", power: 15, fame: 5, nextSceneId: "l2-demo" }
    ]
  },
  {
    id: "l2-demo",
    title: "第二轮 · 技惊四座",
    dialogue: [
      "大屏幕亮起，系统界面流畅得不像话。",
      "数据滚动的一瞬间，会议室里有人倒吸冷气。",
      "「这加载速度，比我们现在的系统快太多了吧？」",
      "「东区机房那台停了两天的服务器……怎么好了？」",
      "我合上电脑，语气很淡：「小事，多看了两行日志而已。」",
      "散会后，陆少堵住我，金表晃得刺眼。",
      "「哟，废柴翻身了？就这？我让我爸投五百万，你这种水平我一天雇一打。」",
      "我抬头看他，忽然笑了一下。",
      "「陆少，你的表昨天下午三点四十七分停了大概三秒。」",
      "他脸色一僵。",
      "我压低声音：「因为你们家数据中心昨天宕机了。你爸可能还不知道，你把他测试库玩崩了。」",
      "陆少的脸色一下子白了。"
    ],
    choices: [
      { text: "「别紧张，我不会说。以后少踩人。」", power: 10, fame: 20, nextSceneId: "l2-sister" },
      { text: "「今天的事，请替我保密。」", power: 15, fame: 10, nextSceneId: "l2-sister" },
      { text: "顺势说：「你欠我一个人情。」", power: 20, fame: 5, nextSceneId: "l2-sister" }
    ]
  },
  {
    id: "l2-sister",
    title: "第二轮 · 妹妹",
    dialogue: [
      "傍晚，妹妹拦住我，上上下下地打量，像在看一个陌生人。",
      "妹妹：「哥，你今天有点不一样。」",
      "我：「哪里不一样？」",
      "她沉默了一会儿，忽然小声问：「你是不是遇到过什么很坏的事？」",
      "我愣住了。她的眼神认真得不像平时。",
      "「我知道你一直在装。」她说，「你骗得了别人，骗不了我。」",
      "「你出事那天，我做了个梦。梦里有火，你倒在地上，我怎么都拉不起来你。」",
      "她别过脸：「反正你真有事就告诉我，别一个人扛。」",
      "我心里一暖，伸手去揉她的脑袋。",
      "她拍开我的手：「哎呀烦死了，下班了赶紧回家！」",
      "可我看得见，她转过身时，偷偷擦了下眼角。"
    ],
    choices: [
      { text: "「有你在，哥什么都不怕。」", power: 10, fame: 0, nextSceneId: "l2-conspiracy" },
      { text: "「回家，我给你做你爱吃的。」", power: 0, fame: 10, nextSceneId: "l2-conspiracy" },
      { text: "「哥在查件大事，你帮我留意一下。」", power: 15, fame: 0, nextSceneId: "l2-conspiracy" }
    ]
  },
  {
    id: "l2-conspiracy",
    title: "第二轮 · 黑手",
    dialogue: [
      "夜里，我躺在床上，把这一世的记忆从头到尾捋了一遍。",
      "有些事不对。",
      "我死前那一晚，整层楼的电闸是谁拉的？",
      "东区机房恰好在方案提交那天宕机，王总恰好当众撕方案，陆少第二天又恰好出现。",
      "巧合太多，就不像巧合了。",
      "我打开电脑，顺着几条记录查了下去。",
      "屏幕上渐渐浮出一条日志：一个用王总权限登录的账号，从今天下午开始，正悄悄往境外服务器传公司核心数据。",
      "我眯起眼。",
      "原来这场轮回里藏着的，不只是几个欺负人的小丑，还有一条想卖掉林氏的蛀虫。"
    ],
    choices: [
      { text: "继续查下去，把幕后的人挖出来", power: 15, fame: 0, nextSceneId: "l2-death", gainMemory: "黑手徽记" },
      { text: "先把证据存好，天亮再说", power: 5, fame: 5, nextSceneId: "l2-death" },
      { text: "故意留点痕迹，引蛇出洞", power: 20, fame: -10, nextSceneId: "l2-death" }
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
      "凌晨三点，我把完整的证据链存进加密盘。",
      "起身倒水时，我朝窗外看了一眼。",
      "楼下停车场停着一辆黑色轿车，车里亮着一点猩红的烟头。",
      "有人在盯着这栋楼。",
      "我心里一沉。就在这时，身后传来「轰」的一声。",
      "机房里的电流像蛇一样蹿过，火花炸开。",
      "这一次，我躲开了火花。",
      "可黑暗中，一支针管无声地扎进我的后颈。",
      "「你查得太多了。」陌生的声音在黑暗里响起。",
      "我倒下前，最后一眼看见那个黑影袖口绣着一枚暗金色的徽记。",
      "意识消散前，我死死记住：加密盘的密码，藏在妹妹手机相册第十三张照片里。",
      "世界再次陷入黑暗。"
    ],
    onLoop: true
  },

  // ============ 第 3 轮：碾压，终极打脸 ============
  {
    id: "l3-morning",
    title: "第三轮 · 全知",
    dialogue: [
      "「叮——」",
      "我再一次睁开眼。",
      "窗外是周一清晨的阳光。但这一次，我脑子里多出了许多不属于这两世的记忆。",
      "三年前，那个叫 Zero 的天才凭一己之力写出了改变整个行业的系统，却在巅峰时忽然消失。",
      "那个人，就是我。",
      "轮回两次，我终于想起了自己是谁。",
      "我慢慢坐起身。王总、陆少、陈组长，还有针管后面的那只手。",
      "门外，妹妹的声音响起来：「哥！起床！今天我非要看看你葫芦里卖的什么药！」",
      "我笑了：「来，哥今天演场大戏给你看。」"
    ],
    choices: [
      { text: "今天谁也不惯着", power: 20, fame: 0, nextSceneId: "l3-board" },
      { text: "先不动声色，关键时刻再出手", power: 15, fame: 10, nextSceneId: "l3-board" },
      { text: "先给妹妹做早饭，让她别担心", power: 5, fame: 15, nextSceneId: "l3-board" }
    ]
  },
  {
    id: "l3-board",
    title: "第三轮 · 董事会",
    dialogue: [
      "林氏科技董事会。",
      "王总正把系统升级的功劳往自己身上揽：「多亏我带队攻坚，才保住这次年度大客户……」",
      "门被推开。我拎着一台笔记本走进去，所有人齐刷刷看过来。",
      "董事长皱眉：「你是哪个部门的？」",
      "我把笔记本放到桌上：「林氏科技前端部，金飞飞。不过你们可能更熟悉我另一个名字。」",
      "我按下回车，大屏幕上的数据倾泻而下。",
      "「Zero。三年前写出这套核心系统的人。」",
      "会议室一下子炸了。王总的脸色变得惨白。"
    ],
    choices: [
      { text: "当众摊牌，把证据链甩出来", power: 30, fame: 20, nextSceneId: "l3-reveal" },
      { text: "先把数据给董事长看，再亮身份", power: 20, fame: 25, nextSceneId: "l3-reveal" },
      { text: "直接全网直播，让所有人看见", power: 25, fame: 30, nextSceneId: "l3-reveal" },
      { text: "把幕后黑手也一起揪出来", power: 30, fame: 30, nextSceneId: "l3-reveal", requiresMemory: "黑手徽记" }
    ]
  },
  {
    id: "l3-reveal",
    title: "第三轮 · 一剑封喉",
    dialogue: [
      "我当着所有人的面，把证据一页页铺开。",
      "「东区机房宕机，是王总让人拔的。核心数据外泄，走的是他的账号。收钱的海外账户，也查到了。」",
      "王总拍案而起：「血口喷人！这是诽谤！」",
      "我点开一段录音。他的声音从会议室音响里传出来：「把数据传出去，钱已经到账了……」",
      "全场鸦雀无声。",
      "董事长脸色铁青：「王建国，你还有什么话说？」",
      "王总瘫坐在椅子上，陆少和陈组长的脸色也白了。",
      "我合上电脑，语气很淡：「林氏科技，从今天起，我接手。」",
      "「至于你们几位，」我看向他们，「保安，送客。」"
    ],
    choices: [
      { text: "接下公司，把林氏带上去", power: 20, fame: 30, nextSceneId: "l3-sister" },
      { text: "「收拾干净就行，公司还是你们的。」", power: 30, fame: 20, nextSceneId: "l3-sister" },
      { text: "先不亮底牌，把筹码攥在手里", power: 25, fame: 25, nextSceneId: "l3-sister" }
    ]
  },
  {
    id: "l3-sister",
    title: "第三轮 · 我哥只能我骂",
    dialogue: [
      "走廊尽头，妹妹堵住我，双手抱胸，眼眶发红。",
      "妹妹：「金飞飞，你——」",
      "我已经做好挨骂的准备。",
      "妹妹：「你装废柴装了三年！三年！你知不知道我有多担心？我还以为你要被人欺负死了！」",
      "她越说越气，拳头锤在我胸口：「你为什么不早说？你每次受委屈，我回去都睡不着！」",
      "我由着她锤：「这不是想看看谁会欺负我，再一锅端吗。」",
      "她愣了一下，然后「噗嗤」笑出来。",
      "她吸了吸鼻子，转身朝围观的人群吼：「看什么看！我哥只有我能骂！谁敢碰他一下试试！」",
      "人群一下散了。",
      "她转回来，红着脸，声音低下去：「不过哥，你刚才真帅。」",
      "我揉了揉她的脑袋：「走，哥请你吃大餐。」",
      "她拍开我的手：「钱留着！你要是破产了，我还得养你！」",
      "可我看见，她转身时，眼睛都笑弯了。"
    ],
    choices: [
      { text: "执掌林氏，重登巅峰", power: 30, fame: 30, nextSceneId: "ending-god", requiresPower: 60, requiresFame: 40 },
      { text: "深藏功名，低调陪她", power: 20, fame: 40, nextSceneId: "ending-pride", requiresPower: 60 },
      { text: "带妹妹离开，另起炉灶", power: 15, fame: 35, nextSceneId: "ending-small", requiresFame: 45 },
      { text: "继续装傻，深藏不露", power: 10, fame: 10, nextSceneId: "ending-coward" }
    ]
  },

  // ============ 结局 ============
  {
    id: "ending-god",
    title: "结局 · 封神",
    isEnding: true,
    endingType: "god",
    dialogue: [
      "林氏科技董事长的位置，我坐了上去。",
      "三年后，林氏市值翻了几十倍，核心系统里依然写着 Zero。",
      "每次开发布会，台下总有个人抱着胳膊，一脸嫌弃。",
      "「就他？我哥？啊对对对，就那个被我从小骂到大的。」",
      "「不过谁要敢动我哥，我第一个不答应。」",
      "全场笑成一片。",
      "我站在台上，看着人群里那个凶巴巴的妹妹。",
      "这世上所有的高处，都不如她那一句「我哥只能我骂」。",
      "我赢了全世界，而她赢了我。"
    ]
  },
  {
    id: "ending-pride",
    title: "结局 · 深藏功名",
    isEnding: true,
    endingType: "pride",
    dialogue: [
      "董事会的事，我交给董事长善后，只在幕后远程看着。",
      "林氏从此多了一个从不露面的「技术顾问」。",
      "没人知道，那个让全行业追逐的人，每天准时下班，回家给妹妹做饭。",
      "妹妹窝在沙发上刷剧，头也不抬：「哥，今天做红烧肉。」",
      "我系上围裙：「好嘞。」",
      "偶尔，我会想起那两世的火，和黑暗里扎来的针管。",
      "但那些都不重要了。",
      "重要的是，妹妹的声音还在，红烧肉的香味还飘着。",
      "当年的坏人，也早就在铁窗里学起了法律条文。",
      "我笑了笑，翻了翻锅铲。这日子，真不错。"
    ]
  },
  {
    id: "ending-small",
    title: "结局 · 另起炉灶",
    isEnding: true,
    endingType: "small",
    dialogue: [
      "我把证据交给董事长，带着妹妹离开了林氏。",
      "「哥，我们真要去创业？」妹妹眼睛亮晶晶的。",
      "「嗯，哥带你看点更大的。」",
      "我们在城中村租了间小办公室，妹妹一个人当起了前台、财务、HR 和产品经理。",
      "三个月后，一个叫 Zero 实验室的小团队，做出了一款让整个行业侧目的产品。",
      "一年后，林氏董事长的私人飞机停在了我们公司楼下。",
      "他弯着腰递上名片：「Zero 先生，之前多有得罪，我们能谈谈合作吗？」",
      "我还没来得及说话，妹妹探出头：「合作可以。先把当年欺负我哥的道歉信抄一百遍。」",
      "董事长：「……」",
      "我笑出了声。",
      "这一世，我没有追着谁复仇。我只是带着妹妹，走得比谁都高，都远。"
    ]
  },
  {
    id: "ending-coward",
    title: "结局 · 大隐隐于市",
    isEnding: true,
    endingType: "coward",
    dialogue: [
      "董事会上，我盯着那些证据看了很久。",
      "最后，我合上电脑，起身说：「不好意思，走错会议室了。」",
      "我继续当那个不起眼的实习生。",
      "王总继续踩我，陆少继续炫富，陈组长继续抢功。我都忍了。",
      "因为我知道，真正的猎手不一定非要暴露自己。",
      "我把每一条蛀虫的证据都存好、收好，然后在某个深夜匿名寄给了有关部门。",
      "一个月后，新闻爆出林氏科技多人涉嫌职务侵占、泄露商业机密，被带走调查。",
      "我站在人群里，看着那些曾经踩我的人被押上警车。",
      "妹妹站在我身边，忽然说：「哥，我知道是你干的。」",
      "我：「……」",
      "她撇撇嘴：「你骗不了我。我哥就是个闷声干大事的狠人。」",
      "我笑了：「那你也得给我保密。」",
      "她举起三根手指：「我哥最坏了，我最喜欢了。」",
      "有些高手，从不亮剑。但他提过的刀，从不会落空。"
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



for (const scene of rawScenes) {
  const image = sceneImages[scene.id];
  if (image != null) {
    scene.image = image;
  }
}

const choiceOutcomes: Record<string, ChoiceOutcome[]> = {
  prologue: ["safe", "risky", "risky"],
  "l1-morning": ["safe", "risky", "risky"],
  "l1-humiliate": ["safe", "risky", "safe"],
  "l1-claim": ["bonus", "safe", "bonus"],
  "l2-morning": ["safe", "risky", "bonus"],
  "l2-meeting": ["risky", "safe", "safe"],
  "l2-demo": ["safe", "safe", "risky"],
  "l2-sister": ["safe", "bonus", "risky"],
  "l2-conspiracy": ["risky", "safe", "risky"],
  "l3-morning": ["risky", "safe", "bonus"],
  "l3-board": ["risky", "safe", "risky", "risky"],
  "l3-reveal": ["safe", "bonus", "safe"],
  "l3-sister": ["safe", "safe", "safe", "safe"],
};

const scenes: Scene[] = rawScenes.map((scene) => ({
  ...scene,
  choices: scene.choices?.map((choice, index) => ({
    text: choice.text,
    nextSceneId: choice.nextSceneId,
    ...(choice.requiresMemory ? { requiresMemory: choice.requiresMemory } : {}),
    ...(choice.gainMemory ? { gainMemory: choice.gainMemory } : {}),
    outcome: choiceOutcomes[scene.id]?.[index] ?? "safe",
  })),
}));

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
      <div class="stat-item hearts-item">
        <span class="stat-label">状态</span>
        <div class="hearts-meter">
          <div class="hearts-track">
            <div class="hearts-fill" id="hearts-fill"></div>
            <div class="hearts-markers" id="hearts-markers">
              <span class="heart-marker">❤️</span>
              <span class="heart-marker">❤️</span>
              <span class="heart-marker">❤️</span>
              <span class="heart-marker">❤️</span>
              <span class="heart-marker">❤️</span>
            </div>
          </div>
        </div>
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
  <div id="choice-feedback" class="choice-feedback" aria-hidden="true"></div>
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
  const hearts = Math.max(0, Math.min(MAX_HEARTS, gameState.hearts));
  const fill = document.getElementById("hearts-fill")!;
  const loopValue = document.getElementById("loop-value")!;

  fill.style.width = `${(hearts / MAX_HEARTS) * 100}%`;

  document.querySelectorAll(".heart-marker").forEach((marker, index) => {
    marker.classList.toggle("filled", index < hearts);
    marker.classList.toggle("empty", index >= hearts);
  });

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
    return true;
  });
}

function renderGameOver(): void {
  const app = document.getElementById("app")!;

  app.innerHTML = `
<div class="game-over-screen">
  <div class="game-over-content">
    <div class="game-over-emoji">💔</div>
    <h2 class="game-over-title">这一世，你没能走到最后</h2>
    <p class="game-over-text">命运没有给你重来的机会。但轮回，还在等着你。</p>
    <div class="game-over-actions">
      <button class="start-button" id="retry-loop-btn">回到本周目开头</button>
      <button class="start-button ghost" id="restart-game-btn">重新开始</button>
    </div>
  </div>
</div>
`;

  document.getElementById("retry-loop-btn")!.addEventListener("click", () => {
    gameState.hearts = MAX_HEARTS;
    gameState.dialogueIndex = 0;
    gameState.sceneId = gameState.loopStartSceneId || "prologue";
    renderSceneEntry();
  });

  document.getElementById("restart-game-btn")!.addEventListener("click", () => {
    location.reload();
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
        const index = Number.parseInt((event.currentTarget as HTMLElement).dataset.index || "0");
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

function showChoiceFeedback(outcome: ChoiceOutcome): void {
  const el = document.getElementById("choice-feedback");
  if (el == null) {
    return;
  }

  const content =
    outcome === "risky"
      ? '<span class="choice-feedback-emoji">⚠️</span><span>鲁莽了，命运 -1</span>'
      : outcome === "bonus"
        ? '<span class="choice-feedback-emoji">❤️</span><span>选对了，命运 +1</span>'
        : '<span class="choice-feedback-emoji">✨</span><span>稳妥一步</span>';

  el.innerHTML = content;
  el.className = `choice-feedback show ${outcome}`;

  const track = document.querySelector(".hearts-track");
  track?.classList.remove("hurt", "heal");
  if (outcome === "risky") {
    track?.classList.add("hurt");
  } else if (outcome === "bonus") {
    track?.classList.add("heal");
  }

  window.setTimeout(() => {
    el.className = "choice-feedback";
    track?.classList.remove("hurt", "heal");
  }, 520);
}

function handleChoice(choices: Choice[], choiceIndex: number): void {
  const scene = scenesMap.get(gameState.sceneId);

  if (scene == null) {
    return;
  }

  const choice = choices[choiceIndex];
  const result = applyOutcome(gameState.hearts, choice.outcome);

  if (result.gameOver) {
    showChoiceFeedback("risky");
    window.setTimeout(renderGameOver, 460);
    return;
  }

  gameState.hearts = result.hearts;
  updateStats();
  showChoiceFeedback(choice.outcome);

  document.querySelectorAll<HTMLButtonElement>(".choice-button").forEach((button) => {
    button.disabled = true;
  });

  window.setTimeout(() => {
    gameState.sceneId = choice.nextSceneId;
    gameState.dialogueIndex = 0;

    if (choice.gainMemory != null && !gameState.memories.includes(choice.gainMemory)) {
      gameState.memories.push(choice.gainMemory);
    }

    renderScene();
  }, 540);
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

function enterLoop(nextLoop: number, startSceneId: string): void {
  gameState.loop = nextLoop;
  gameState.hearts = MAX_HEARTS;
  gameState.loopStartSceneId = startSceneId;
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
    enterLoop(nextLoop, startSceneId);
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
    <h1 class="game-title">这一次，换我护你</h1>
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
