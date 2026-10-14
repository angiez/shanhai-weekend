window.SITE = {
  regions: [
    { id: "core", zh: "市区", en: "City" },
    { id: "north", zh: "北岸", en: "North Shore" },
    { id: "south", zh: "河南岸", en: "South Arm" },
    { id: "tri", zh: "湖区与三城", en: "Lakes & Tri-Cities" },
    { id: "valley", zh: "弗雷泽河谷", en: "Fraser Valley" },
    { id: "away", zh: "出城一日", en: "Day Trips" }
  ],
  cats: [
    { id: "park", zh: "公园海边" },
    { id: "museum", zh: "博物馆" },
    { id: "hike", zh: "山林徒步" },
    { id: "animal", zh: "动物观鸟" },
    { id: "farm", zh: "农场采摘" },
    { id: "thrill", zh: "刺激项目" },
    { id: "water", zh: "玩水游泳" },
    { id: "food", zh: "市集美食" },
    { id: "walk", zh: "街区漫步" },
    { id: "culture", zh: "文化古迹" }
  ],
  cities: [
    { id: "vancouver", zh: "温哥华", en: "Vancouver", region: "core", blurb: "海堤、博物馆、唐人街和固兰湖岛都在这一城。", eat: "固兰湖岛公共市场、英吉利湾或唐人街。", getting: "SkyTrain 和巴士覆盖主要景点，斯坦利公园边缘可乘 19 路。" },
    { id: "richmond", zh: "列治文", en: "Richmond", region: "south", blurb: "渔村、河堤、夜市和机场周边，华人家庭最熟的一站。", eat: "史提夫斯顿鱼薯条，或时代坊、八佰伴美食广场。", getting: "加拿大线直达列治文。史提夫斯顿从桥港站转巴士，或沿河堤骑行。" },
    { id: "burnaby", zh: "本拿比", en: "Burnaby", region: "tri", blurb: "鹿湖、伯纳比湖和山上的西门菲莎大学。", eat: "铁道镇有大食代和各色餐厅，雨天很方便。", getting: "博览线和千年线都经过本拿比。" },
    { id: "surrey", zh: "素里", en: "Surrey", region: "south", blurb: "大公园、三文鱼溪和靠边界的海滩。", eat: "新月海滩有小餐厅，素里中心也可解决一餐。", getting: "博览线到金斯乔治或素里中央后转巴士，海滩多数要开车。" },
    { id: "northvan", zh: "北温", en: "North Vancouver", region: "north", blurb: "吊桥、三文鱼、深湾和格罗斯山。", eat: "朗斯代尔码头，或深湾村的小店。", getting: "海上巴士到朗斯代尔。山上景点多数要开车或接驳。" },
    { id: "westvan", zh: "西温", en: "West Vancouver", region: "north", blurb: "灯塔公园、马蹄湾和柏树山雪场。", eat: "邓德拉夫或马蹄湾的鱼薯条。", getting: "从市区乘巴士过狮门桥。马蹄湾是渡轮码头。" },
    { id: "coquitlam", zh: "高贵林", en: "Coquitlam", region: "tri", blurb: "湖边市区公园和能看沼泽的小径。", eat: "高贵林中心商场，或拉法基湖边简餐。", getting: "千年线天车到拉法基湖站，再步行即到湖。" },
    { id: "portmoody", zh: "满地宝", en: "Port Moody", region: "tri", blurb: "海滨步道、贝卡拉和两个山湖。", eat: "满地宝酿酒厂一带有餐厅，带小孩选早午餐更合适。", getting: "千年线到满地宝站，落基角公园就在附近。" },
    { id: "poco", zh: "高贵林港", en: "Port Coquitlam", region: "tri", blurb: "河堤长步道和安静的社区公园。", eat: "市中心一条街有咖啡馆和家庭餐厅。", getting: "开车最方便，也可乘西海岸快线再转巴士。" },
    { id: "newwest", zh: "新西敏", en: "New Westminster", region: "tri", blurb: "河畔老城、码头市集和皇后公园。", eat: "河岸码头有餐厅，市中心哥伦比亚街也有选择。", getting: "博览线新西敏站就在码头旁边。" },
    { id: "delta", zh: "三角洲", en: "Delta", region: "south", blurb: "观鸟、边界湾沙滩和拉德纳渔村。", eat: "拉德纳村有早午餐和面包店。", getting: "观鸟保护区和沙滩都要开车，没有直达公交。" },
    { id: "langley", zh: "兰里", en: "Langley", region: "valley", blurb: "古堡、河谷公园和小型飞机博物馆。", eat: "兰里堡村里有咖啡馆，适合和古堡排在同一天。", getting: "距温哥华开车约 45 到 70 分钟，视路况而定。巴士 562 可到兰里堡附近。" },
    { id: "aldergrove", zh: "阿尔德格罗夫", en: "Aldergrove", region: "valley", blurb: "大温动物园和湖边区域公园。", eat: "动物园里有简餐，也可回兰里或阿伯茨福德吃。", getting: "在 264 街一带，从 1 号公路下来开车约一小时。" },
    { id: "mapleridge", zh: "枫树岭", en: "Maple Ridge", region: "valley", blurb: "金耳朵省立公园、瀑布和溪流。", eat: "枫树岭市中心解决正餐，公园里自带野餐更舒服。", getting: "开车约一小时。湖边夏季周末很挤，宜早到。" },
    { id: "pittmeadows", zh: "匹特草原", en: "Pitt Meadows", region: "valley", blurb: "沼泽、观鸟和通往匹特湖的水路。", eat: "镇上选择不多，可自带或顺路去高贵林港。", getting: "沿 Rannie Road 向北开到尽头就是沼泽公园。" },
    { id: "abbotsford", zh: "阿伯茨福德", en: "Abbotsford", region: "valley", blurb: "南瓜农场、湖边公园和室内外游乐。", eat: "农场餐厅季节营业，米尔湖旁边也有野餐草坪。", getting: "1 号公路向东约一小时出头。" },
    { id: "mission", zh: "米逊", en: "Mission", region: "valley", blurb: "瀑布、湖和能看见河谷的山头公园。", eat: "米逊市区有家庭餐厅，瀑布公园适合自带零食。", getting: "过米逊桥或走河谷公路，开车约 70 分钟。" },
    { id: "chilliwack", zh: "奇利瓦克", en: "Chilliwack", region: "valley", blurb: "卡尔特斯湖、河道步道和夏季水上乐园。", eat: "萨迪斯或奇利瓦克市区吃饭，湖边多为野餐。", getting: "1 号公路约 1.5 小时。夏季周五下午容易堵。" },
    { id: "squamish", zh: "斯阔米什", en: "Squamish", region: "away", blurb: "瀑布、缆车、火车博物馆和矿山。", eat: "市区克利夫兰大道有咖啡馆和汉堡。", getting: "99 号海天公路向北，正常约 60 到 75 分钟。冬天看路况。" },
    { id: "whiterock", zh: "白石", en: "White Rock", region: "south", blurb: "长栈桥、沙滩和一条靠海的商业街。", eat: "海边餐厅很多，周末要等位，也可自带在沙滩吃。", getting: "从素里向南开车，或乘巴士到白石中心再步行下坡。" },
    { id: "whistler", zh: "惠斯勒", en: "Whistler", region: "away", blurb: "山谷小镇、两条山之间的缆车和湖边步道。", eat: "村里餐厅选择多，价格也高，可自带零食上山。", getting: "从温哥华开车约 2 小时。无车可看季节性巴士。" },
    { id: "harrison", zh: "哈里森温泉", en: "Harrison Hot Springs", region: "away", blurb: "湖、公共沙滩和可以泡的温泉水。", eat: "村里有餐厅和冰淇淋，湖边风大记得加衣。", getting: "经 7 号公路或 1 号公路转阿加西斯，约 1.5 到 2 小时。" },
    { id: "bowen", zh: "鲍恩岛", en: "Bowen Island", region: "north", blurb: "马蹄湾坐船二十分钟，适合没有车的半日游。", eat: "斯纳格湾有咖啡馆和餐厅，选择不多，赶船前留时间。", getting: "从马蹄湾乘渡轮，步行即可上岸。岛上到湖要走路上坡。" },
    { id: "victoria", zh: "维多利亚", en: "Victoria", region: "away", blurb: "渡轮另一头的省会，内港、渔人码头和灯塔山。", eat: "内港和渔人码头都有小吃，鱼和薯条是默认选项。", getting: "措瓦森到斯沃茨湾渡轮约 1.5 小时，加上排队请留大半天。" },
    { id: "hope", zh: "霍普", en: "Hope", region: "away", blurb: "峡谷火车隧道和小镇雕刻，适合春到秋的一日往返。", eat: "霍普镇上咖啡店即可，隧道没有餐饮。", getting: "1 号公路约 1.5 到 2 小时。隧道冬季关闭。" },
    { id: "bellingham", zh: "贝灵厄姆", en: "Bellingham", region: "away", blurb: "过境后的海滨老城，公平港和林荫道公园。", eat: "公平港有餐厅和冰淇淋。", getting: "从白石或和平拱门过境。需要护照和合法入境美国的资格，高峰排队很长。" }
  ],
  routes: [
    {
      id: "salmon",
      zh: "十月追三文鱼",
      days: "半天到一天",
      cities: ["northvan", "surrey"],
      blurb: "九月到十一月，市区开车不用出城也能看见洄游。",
      steps: [
        { place: "hatchery", time: "早上", note: "卡皮拉诺孵化场免费，鱼梯和玻璃窗最适合小孩。" },
        { place: "cleveland", time: "接着", note: "孵化场步行几分钟就是克利夫兰水坝，看瀑布不用另买票。" },
        { place: "tynehead", time: "下午换一条溪", note: "如果还想看鱼，开去素里泰恩黑德。不想换城就改去深湾散步。" }
      ]
    },
    {
      id: "rain",
      zh: "下雨也不窝家",
      days: "市区一天",
      cities: ["vancouver"],
      blurb: "大温的雨是默认天气。把室内馆和有屋顶的市场排在一起。",
      steps: [
        { place: "science-world", time: "上午", note: "科学世界可以摸、可以爬，小学生最不容易喊无聊。" },
        { place: "granville", time: "中午", note: "固兰湖岛市场有屋顶，小孩市场在同一岛上。" },
        { place: "moa", time: "若雨还不停", note: "改去英属哥伦比亚大学人类学博物馆，周四傍晚有时延长开放，行前看官网。" }
      ]
    },
    {
      id: "steveston",
      zh: "史提夫斯顿慢一天",
      days: "列治文一天",
      cities: ["richmond"],
      blurb: "渔村、船厂、罐头厂和沙滩，几乎都靠在一起。",
      steps: [
        { place: "garry", time: "早上", note: "加里角看船和飞机，风大，推车没问题。" },
        { place: "cannery", time: "上午", note: "乔治亚湾罐头厂讲罐头业和鱼，室内展适合转天气。" },
        { place: "britannia", time: "下午", note: "沿木板路走到不列颠尼亚船厂，再回村里吃鱼薯条。" }
      ]
    },
    {
      id: "north-classic",
      zh: "北岸不花大钱",
      days: "北温一天",
      cities: ["northvan"],
      blurb: "吊桥不一定要买最贵的那座。林恩峡谷的桥是免费的。",
      steps: [
        { place: "lynn", time: "上午", note: "免费吊桥和生态中心。桥会晃，胆小的孩子牵手走。" },
        { place: "hatchery", time: "中午前后", note: "秋季看鱼，其他季节看大坝和森林也好。" },
        { place: "deepcove", time: "下午", note: "深湾散步、喂鹅要克制，商店买个甜筒坐在码头。" }
      ]
    },
    {
      id: "seawall",
      zh: "不花钱的海",
      days: "温哥华半天",
      cities: ["vancouver"],
      blurb: "海堤本身不要票。把水族馆留作可选项，而不是必选项。",
      steps: [
        { place: "stanley", time: "上午到下午", note: "从图腾柱走到英吉利湾，骑行单程更轻松。" },
        { place: "english-bay", time: "傍晚", note: "看船和落日。夏天沙滩人多，十月正好能坐下。" }
      ]
    },
    {
      id: "fort-zoo",
      zh: "古堡加动物园",
      days: "河谷一天",
      cities: ["langley", "aldergrove"],
      blurb: "一个讲皮毛贸易，一个看动物，都在兰里一带。",
      steps: [
        { place: "fort-langley", time: "上午", note: "国家历史遗址，有解释员。堡垒上层若在维修，院子和一层仍值得看。" },
        { place: "gvzoo", time: "下午", note: "阿尔德格罗夫的大温动物园，每天开放，最后入场时间以官网为准。" }
      ]
    },
    {
      id: "seatosky",
      zh: "海天公路一日",
      days: "斯阔米什",
      cities: ["squamish"],
      blurb: "瀑布免费，缆车和矿山博物馆二选一就够，不必三个都冲。",
      steps: [
        { place: "shannon", time: "上午", note: "香农瀑布从停车场走几分钟，适合各年龄。" },
        { place: "gondola", time: "中午", note: "海天缆车看豪湾。怕高就只在山顶平台，不走悬空桥。" },
        { place: "britannia-mine", time: "时间还够", note: "不列颠尼亚矿山博物馆在回程路上，地下矿洞较凉。" }
      ]
    },
    {
      id: "birds",
      zh: "三角洲观鸟",
      days: "三角洲半天",
      cities: ["delta"],
      blurb: "秋天候鸟多。保护区要预约，周一关闭。",
      steps: [
        { place: "reifel", time: "上午", note: "先在官网预约。带望远镜更有趣，没有也能看见雁和鸭。" },
        { place: "boundary", time: "下午", note: "百年滩看海、放风筝。退潮后泥滩很宽，注意涨潮时间。" }
      ]
    },
    {
      id: "whistler-day",
      zh: "惠斯勒来回",
      days: "出城一天",
      cities: ["whistler"],
      blurb: "冬天滑雪，其他季节坐山间缆车或绕失落湖走。",
      steps: [
        { place: "whistler-village", time: "上午", note: "先在村里认路，再决定上山还是绕湖。" },
        { place: "peak2peak", time: "白天", note: "峰对峰缆车连接惠斯勒山和黑梳山，票价高，看成当天天气。" },
        { place: "lost-lake", time: "若不想上山", note: "失落湖步道免费，夏天能游泳，十月适合散步。" }
      ]
    },
    {
      id: "fall-color",
      zh: "红叶两座园",
      days: "温哥华一天",
      cities: ["vancouver"],
      blurb: "十月市区不必进山，两个花园就有颜色。",
      steps: [
        { place: "qepark", time: "上午", note: "伊丽莎白女王公园的采石场花园和布卢德尔温室。" },
        { place: "vandusen", time: "下午", note: "范度森有迷宫和儿童园，秋天的叶子是主角。" }
      ]
    },
    {
      id: "burnaby-easy",
      zh: "本拿比轻松日",
      days: "本拿比",
      cities: ["burnaby"],
      blurb: "湖边野餐加一座季节开放的乡村博物馆。",
      steps: [
        { place: "deerlake", time: "上午", note: "鹿湖可以推车，有沙滩和美术馆。" },
        { place: "bvm", time: "博物馆开放时", note: "伯纳比乡村博物馆按季节开门，旋转木马另计。十月中旬若没到万圣夜场，就改去伯纳比湖。" },
        { place: "burnabylake", time: "备选下午", note: "湖边木板路看乌龟、鸟和秋季的鱼。" }
      ]
    },
    {
      id: "white-rock-day",
      zh: "白石与新月滩",
      days: "南岸半天",
      cities: ["whiterock", "surrey"],
      blurb: "两片沙滩隔一条海岸，适合想吹风、不想爬山的家庭。",
      steps: [
        { place: "whiterock-pier", time: "上午", note: "走栈桥，看美国边界的水。坡陡，婴儿车从上面的停车场更轻松。" },
        { place: "crescent", time: "下午", note: "素里新月海滩更宽，黑鸟嘴适合看鸟。" }
      ]
    }
  ],
  places: []
};
