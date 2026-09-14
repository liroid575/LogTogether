import type { ExerciseCategory, ExerciseDefinition, ExerciseLibraryGroup, ExerciseLoggingProfile } from "./types.js";

export const EXERCISES: ExerciseDefinition[] = [
  { id: "diamond_push_up", names: { en: "Diamond Push-up", "zh-TW": "鑽石伏地挺身" }, type: "reps", category: "chest" },
  { id: "decline_push_up", names: { en: "Decline Push-up", "zh-TW": "下斜伏地挺身" }, type: "reps", category: "chest" },
  { id: "pike_push_up", names: { en: "Pike Push-up", "zh-TW": "派克伏地挺身" }, type: "reps", category: "shoulders" },
  { id: "dips", names: { en: "Dips", "zh-TW": "雙槓撐體" }, type: "reps", category: "arms" },
  { id: "bench_dips", names: { en: "Bench Dips", "zh-TW": "椅上撐體" }, type: "reps", category: "arms" },
  { id: "chin_up", names: { en: "Chin-up", "zh-TW": "反手引體向上" }, type: "reps", category: "back" },
  { id: "inverted_row", names: { en: "Inverted Row", "zh-TW": "反向划船" }, type: "reps", category: "back" },
  { id: "scapular_pull_up", names: { en: "Scapular Pull-up", "zh-TW": "肩胛引體" }, type: "reps", category: "back" },
  { id: "bodyweight_squat", names: { en: "Bodyweight Squat", "zh-TW": "徒手深蹲" }, type: "reps", category: "legs" },
  { id: "pistol_squat", names: { en: "Pistol Squat", "zh-TW": "單腿深蹲" }, type: "reps", category: "legs" },
  { id: "bulgarian_split_squat", names: { en: "Bulgarian Split Squat", "zh-TW": "保加利亞分腿蹲" }, type: "reps", category: "legs" },
  { id: "glute_bridge", names: { en: "Glute Bridge", "zh-TW": "臀橋" }, type: "reps", category: "legs" },
  { id: "bodyweight_calf_raise", names: { en: "Bodyweight Calf Raise", "zh-TW": "徒手提踵" }, type: "reps", category: "legs" },
  { id: "wall_sit", names: { en: "Wall Sit", "zh-TW": "靠牆深蹲" }, type: "duration", category: "legs" },
  { id: "lying_leg_raise", names: { en: "Lying Leg Raise", "zh-TW": "仰臥抬腿" }, type: "reps", category: "core" },
  { id: "hanging_knee_raise", names: { en: "Hanging Knee Raise", "zh-TW": "懸垂屈膝抬腿" }, type: "reps", category: "core" },
  { id: "hanging_leg_raise", names: { en: "Hanging Leg Raise", "zh-TW": "懸垂抬腿" }, type: "reps", category: "core" },
  { id: "reverse_crunch", names: { en: "Reverse Crunch", "zh-TW": "反向捲腹" }, type: "reps", category: "core" },
  { id: "hollow_body_hold", names: { en: "Hollow Body Hold", "zh-TW": "中空撐體" }, type: "duration", category: "core" },
  { id: "superman_hold", names: { en: "Superman Hold", "zh-TW": "超人式撐體" }, type: "duration", category: "core" },
  { id: "mountain_climber", names: { en: "Mountain Climbers", "zh-TW": "登山者" }, type: "reps", category: "cardio" },
  { id: "burpee", names: { en: "Burpees", "zh-TW": "波比跳" }, type: "reps", category: "cardio" },
  { id: "jumping_jack", names: { en: "Jumping Jacks", "zh-TW": "開合跳" }, type: "reps", category: "cardio" },
  { id: "jump_squat", names: { en: "Jump Squat", "zh-TW": "深蹲跳" }, type: "reps", category: "cardio" },
  { id: "handstand_hold", names: { en: "Handstand Hold", "zh-TW": "倒立撐" }, type: "duration", category: "shoulders" },

  { id: "barbell_bench_press", names: { en: "Barbell Bench Press", "zh-TW": "槓鈴臥推" }, type: "weight_reps", category: "chest" },
  { id: "dumbbell_bench_press", names: { en: "Dumbbell Bench Press", "zh-TW": "啞鈴臥推" }, type: "weight_reps", category: "chest" },
  { id: "incline_dumbbell_press", names: { en: "Incline Dumbbell Press", "zh-TW": "上斜啞鈴臥推" }, type: "weight_reps", category: "chest" },
  { id: "push_up", names: { en: "Push-up", "zh-TW": "伏地挺身" }, type: "reps", category: "chest" },
  { id: "chest_fly", names: { en: "Chest Fly", "zh-TW": "飛鳥" }, type: "weight_reps", category: "chest" },
  { id: "lat_pulldown", names: { en: "Lat Pulldown", "zh-TW": "高位下拉" }, type: "weight_reps", category: "back" },
  { id: "seated_cable_row", names: { en: "Seated Cable Row", "zh-TW": "坐姿划船" }, type: "weight_reps", category: "back" },
  { id: "barbell_row", names: { en: "Barbell Row", "zh-TW": "槓鈴划船" }, type: "weight_reps", category: "back" },
  { id: "pull_up", names: { en: "Pull-up", "zh-TW": "引體向上" }, type: "reps", category: "back" },
  { id: "deadlift", names: { en: "Deadlift", "zh-TW": "硬舉" }, type: "weight_reps", category: "back" },
  { id: "overhead_press", names: { en: "Overhead Press", "zh-TW": "肩上推舉" }, type: "weight_reps", category: "shoulders" },
  { id: "dumbbell_shoulder_press", names: { en: "Dumbbell Shoulder Press", "zh-TW": "啞鈴肩推" }, type: "weight_reps", category: "shoulders" },
  { id: "lateral_raise", names: { en: "Lateral Raise", "zh-TW": "側平舉" }, type: "weight_reps", category: "shoulders" },
  { id: "face_pull", names: { en: "Face Pull", "zh-TW": "面拉" }, type: "weight_reps", category: "shoulders" },
  { id: "biceps_curl", names: { en: "Biceps Curl", "zh-TW": "二頭彎舉" }, type: "weight_reps", category: "arms" },
  { id: "hammer_curl", names: { en: "Hammer Curl", "zh-TW": "槌式彎舉" }, type: "weight_reps", category: "arms" },
  { id: "triceps_pushdown", names: { en: "Triceps Pushdown", "zh-TW": "三頭下壓" }, type: "weight_reps", category: "arms" },
  { id: "triceps_extension", names: { en: "Overhead Triceps Extension", "zh-TW": "過頭三頭伸展" }, type: "weight_reps", category: "arms" },
  { id: "back_squat", names: { en: "Back Squat", "zh-TW": "槓鈴深蹲" }, type: "weight_reps", category: "legs" },
  { id: "goblet_squat", names: { en: "Goblet Squat", "zh-TW": "高腳杯深蹲" }, type: "weight_reps", category: "legs" },
  { id: "leg_press", names: { en: "Leg Press", "zh-TW": "腿推" }, type: "weight_reps", category: "legs" },
  { id: "leg_extension", names: { en: "Leg Extension", "zh-TW": "腿伸展" }, type: "weight_reps", category: "legs" },
  { id: "leg_curl", names: { en: "Leg Curl", "zh-TW": "腿彎舉" }, type: "weight_reps", category: "legs" },
  { id: "romanian_deadlift", names: { en: "Romanian Deadlift", "zh-TW": "羅馬尼亞硬舉" }, type: "weight_reps", category: "legs" },
  { id: "walking_lunge", names: { en: "Walking Lunge", "zh-TW": "行走弓箭步" }, type: "reps", category: "legs" },
  { id: "calf_raise", names: { en: "Calf Raise", "zh-TW": "提踵" }, type: "weight_reps", category: "legs" },
  { id: "plank", names: { en: "Plank", "zh-TW": "平板撐" }, type: "duration", category: "core" },
  { id: "side_plank", names: { en: "Side Plank", "zh-TW": "側平板撐" }, type: "duration", category: "core" },
  { id: "crunch", names: { en: "Crunch", "zh-TW": "捲腹" }, type: "reps", category: "core" },
  { id: "dead_bug", names: { en: "Dead Bug", "zh-TW": "死蟲式" }, type: "reps", category: "core" },
  { id: "walk", names: { en: "Walking", "zh-TW": "步行" }, type: "distance_time", category: "cardio" },
  { id: "run", names: { en: "Running", "zh-TW": "跑步" }, type: "distance_time", category: "cardio" },
  { id: "cycling", names: { en: "Cycling", "zh-TW": "騎自行車" }, type: "distance_time", category: "cardio" },
  { id: "treadmill", names: { en: "Treadmill", "zh-TW": "跑步機" }, type: "distance_time", category: "cardio", group: "gym" },
  { id: "stationary_bike", names: { en: "Stationary Bike", "zh-TW": "室內腳踏車" }, type: "duration", category: "cardio", group: "gym" },
  { id: "elliptical", names: { en: "Elliptical", "zh-TW": "橢圓機" }, type: "duration", category: "cardio", group: "gym" },
  { id: "hamstring_stretch", names: { en: "Hamstring Stretch", "zh-TW": "腿後側伸展" }, type: "duration", category: "mobility" },
  { id: "hip_flexor_stretch", names: { en: "Hip Flexor Stretch", "zh-TW": "髖屈肌伸展" }, type: "duration", category: "mobility" },
  { id: "shoulder_mobility", names: { en: "Shoulder Mobility", "zh-TW": "肩部活動度" }, type: "duration", category: "mobility" },
  { id: "cat_cow", names: { en: "Cat-Cow", "zh-TW": "貓牛式" }, type: "reps", category: "mobility" },

  // Gym — extra common machine / free-weight movements.
  { id: "front_squat", names: { en: "Front Squat", "zh-TW": "前蹲" }, type: "weight_reps", category: "legs", group: "gym" },
  { id: "hack_squat", names: { en: "Hack Squat", "zh-TW": "哈克深蹲" }, type: "weight_reps", category: "legs", group: "gym" },
  { id: "hip_thrust", names: { en: "Hip Thrust", "zh-TW": "臀推" }, type: "weight_reps", category: "legs", group: "gym" },
  { id: "cable_fly", names: { en: "Cable Fly", "zh-TW": "滑輪飛鳥" }, type: "weight_reps", category: "chest", group: "gym" },
  { id: "pec_deck", names: { en: "Pec Deck", "zh-TW": "蝴蝶機夾胸" }, type: "weight_reps", category: "chest", group: "gym" },
  { id: "machine_chest_press", names: { en: "Machine Chest Press", "zh-TW": "機械胸推" }, type: "weight_reps", category: "chest", group: "gym" },
  { id: "single_arm_row", names: { en: "Single-arm Dumbbell Row", "zh-TW": "單手啞鈴划船" }, type: "weight_reps", category: "back", group: "gym" },
  { id: "chest_supported_row", names: { en: "Chest-supported Row", "zh-TW": "胸靠划船" }, type: "weight_reps", category: "back", group: "gym" },
  { id: "rear_delt_fly", names: { en: "Rear Delt Fly", "zh-TW": "後三角飛鳥" }, type: "weight_reps", category: "shoulders", group: "gym" },
  { id: "upright_row", names: { en: "Upright Row", "zh-TW": "直立划船" }, type: "weight_reps", category: "shoulders", group: "gym" },
  { id: "preacher_curl", names: { en: "Preacher Curl", "zh-TW": "牧師椅彎舉" }, type: "weight_reps", category: "arms", group: "gym" },
  { id: "skull_crusher", names: { en: "Skull Crusher", "zh-TW": "仰臥三頭伸展" }, type: "weight_reps", category: "arms", group: "gym" },
  { id: "cable_crunch", names: { en: "Cable Crunch", "zh-TW": "滑輪捲腹" }, type: "weight_reps", category: "core", group: "gym" },
  { id: "farmers_carry", names: { en: "Farmer's Carry", "zh-TW": "農夫走路" }, type: "distance_time", category: "core", group: "gym" },
  { id: "rowing_machine", names: { en: "Rowing Machine", "zh-TW": "划船機" }, type: "duration", category: "cardio", group: "gym" },
  { id: "stair_climber", names: { en: "Stair Climber", "zh-TW": "登階機" }, type: "duration", category: "cardio", group: "gym" },

  // Calisthenics / bodyweight skills.
  { id: "wide_push_up", names: { en: "Wide Push-up", "zh-TW": "寬距伏地挺身" }, type: "reps", category: "chest", group: "calisthenics" },
  { id: "archer_push_up", names: { en: "Archer Push-up", "zh-TW": "弓箭手伏地挺身" }, type: "reps", category: "chest", group: "calisthenics" },
  { id: "pseudo_planche_push_up", names: { en: "Pseudo Planche Push-up", "zh-TW": "偽俄挺伏地挺身" }, type: "reps", category: "chest", group: "calisthenics" },
  { id: "muscle_up", names: { en: "Muscle-up", "zh-TW": "暴力上槓" }, type: "reps", category: "back", group: "calisthenics" },
  { id: "australian_pull_up", names: { en: "Australian Pull-up", "zh-TW": "澳式引體" }, type: "reps", category: "back", group: "calisthenics" },
  { id: "l_sit", names: { en: "L-sit", "zh-TW": "L 型撐體" }, type: "duration", category: "core", group: "calisthenics" },
  { id: "v_sit", names: { en: "V-sit", "zh-TW": "V 型撐體" }, type: "duration", category: "core", group: "calisthenics" },
  { id: "dragon_flag", names: { en: "Dragon Flag", "zh-TW": "龍旗" }, type: "reps", category: "core", group: "calisthenics" },
  { id: "front_lever_hold", names: { en: "Front Lever Hold", "zh-TW": "前水平撐" }, type: "duration", category: "back", group: "calisthenics" },
  { id: "back_lever_hold", names: { en: "Back Lever Hold", "zh-TW": "後水平撐" }, type: "duration", category: "back", group: "calisthenics" },
  { id: "planche_hold", names: { en: "Planche Hold", "zh-TW": "俄式挺身撐" }, type: "duration", category: "shoulders", group: "calisthenics" },
  { id: "handstand_push_up", names: { en: "Handstand Push-up", "zh-TW": "倒立伏地挺身" }, type: "reps", category: "shoulders", group: "calisthenics" },
  { id: "shrimp_squat", names: { en: "Shrimp Squat", "zh-TW": "蝦式深蹲" }, type: "reps", category: "legs", group: "calisthenics" },
  { id: "nordic_curl_bodyweight", names: { en: "Nordic Hamstring Curl", "zh-TW": "北歐腿彎舉" }, type: "reps", category: "legs", group: "calisthenics" },
  { id: "bear_crawl", names: { en: "Bear Crawl", "zh-TW": "熊爬" }, type: "distance_time", category: "core", group: "calisthenics" },

  // Outdoor / cardio.
  { id: "hiking_cardio", names: { en: "Hiking / Trail Walking", "zh-TW": "健行／步道行走" }, type: "distance_time", category: "cardio", group: "outdoor_cardio" },
  { id: "trail_running", names: { en: "Trail Running", "zh-TW": "越野跑" }, type: "distance_time", category: "cardio", group: "outdoor_cardio" },
  { id: "stair_running", names: { en: "Stair Running", "zh-TW": "跑樓梯" }, type: "duration", category: "cardio", group: "outdoor_cardio" },
  { id: "sprinting", names: { en: "Sprints", "zh-TW": "衝刺跑" }, type: "distance_time", category: "cardio", group: "outdoor_cardio" },
  { id: "rucking", names: { en: "Rucking", "zh-TW": "負重健走" }, type: "distance_time", category: "cardio", group: "outdoor_cardio" },
  { id: "inline_skating", names: { en: "Inline Skating", "zh-TW": "直排輪" }, type: "distance_time", category: "cardio", group: "outdoor_cardio" },

  // Mobility / Yoga / Stretching.
  { id: "child_pose", names: { en: "Child's Pose", "zh-TW": "嬰兒式" }, type: "duration", category: "mobility", group: "mobility_yoga" },
  { id: "downward_dog", names: { en: "Downward-facing Dog", "zh-TW": "下犬式" }, type: "duration", category: "mobility", group: "mobility_yoga" },
  { id: "cobra_pose", names: { en: "Cobra Pose", "zh-TW": "眼鏡蛇式" }, type: "duration", category: "mobility", group: "mobility_yoga" },
  { id: "pigeon_pose", names: { en: "Pigeon Pose", "zh-TW": "鴿式" }, type: "duration", category: "mobility", group: "mobility_yoga" },
  { id: "warrior_one", names: { en: "Warrior I", "zh-TW": "戰士一式" }, type: "duration", category: "mobility", group: "mobility_yoga" },
  { id: "warrior_two", names: { en: "Warrior II", "zh-TW": "戰士二式" }, type: "duration", category: "mobility", group: "mobility_yoga" },
  { id: "sun_salutation", names: { en: "Sun Salutation", "zh-TW": "拜日式" }, type: "reps", category: "mobility", group: "mobility_yoga" },
  { id: "quad_stretch", names: { en: "Quadriceps Stretch", "zh-TW": "股四頭肌伸展" }, type: "duration", category: "mobility", group: "mobility_yoga" },
  { id: "calf_stretch", names: { en: "Calf Stretch", "zh-TW": "小腿伸展" }, type: "duration", category: "mobility", group: "mobility_yoga" },
  { id: "chest_stretch", names: { en: "Chest Stretch", "zh-TW": "胸肌伸展" }, type: "duration", category: "mobility", group: "mobility_yoga" },
  { id: "thoracic_rotation", names: { en: "Thoracic Rotation", "zh-TW": "胸椎旋轉" }, type: "reps", category: "mobility", group: "mobility_yoga" },
  { id: "ankle_mobility", names: { en: "Ankle Mobility", "zh-TW": "踝關節活動度" }, type: "reps", category: "mobility", group: "mobility_yoga" },

  // Sports / Other — swimming, lifesaving, rope work, kickboxing and common sports conditioning.
  { id: "swim_freestyle", names: { en: "Swimming — Freestyle", "zh-TW": "游泳－自由式" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_breaststroke", names: { en: "Swimming — Breaststroke", "zh-TW": "游泳－蛙式" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_backstroke", names: { en: "Swimming — Backstroke", "zh-TW": "游泳－仰式" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_butterfly", names: { en: "Swimming — Butterfly", "zh-TW": "游泳－蝶式" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_sidestroke", names: { en: "Swimming — Sidestroke", "zh-TW": "游泳－側泳" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_elementary_backstroke", names: { en: "Swimming — Elementary Backstroke", "zh-TW": "游泳－基本仰泳" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_head_up_freestyle", names: { en: "Lifesaving — Head-up Freestyle", "zh-TW": "救生－抬頭自由式" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_head_up_breaststroke", names: { en: "Lifesaving — Head-up Breaststroke", "zh-TW": "救生－抬頭蛙式" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_lifesaving_sidestroke", names: { en: "Lifesaving — Sidestroke", "zh-TW": "救生－救生側泳" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_rescue_tube_tow", names: { en: "Lifesaving — Rescue Tube Tow", "zh-TW": "救生－救生浮標拖帶" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_cross_chest_carry", names: { en: "Lifesaving — Cross-chest Carry", "zh-TW": "救生－跨胸拖帶" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_armpit_tow", names: { en: "Lifesaving — Armpit Tow", "zh-TW": "救生－腋下拖帶" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "swim_tired_swimmer_tow", names: { en: "Lifesaving — Tired Swimmer Tow", "zh-TW": "救生－疲勞泳者拖帶" }, type: "distance_time", category: "cardio", group: "swimming" },
  { id: "treading_water", names: { en: "Treading Water", "zh-TW": "踩水" }, type: "duration", category: "cardio", group: "swimming" },
  { id: "eggbeater_kick", names: { en: "Eggbeater Kick", "zh-TW": "蛋打式踩水" }, type: "duration", category: "legs", group: "swimming" },
  { id: "surface_dive", names: { en: "Surface Dive Drill", "zh-TW": "潛降／水面下潛練習" }, type: "reps", category: "cardio", group: "swimming" },
  { id: "brick_retrieval", names: { en: "Lifesaving — Brick / Object Retrieval", "zh-TW": "救生－磚塊／物件打撈" }, type: "reps", category: "cardio", group: "swimming" },
  { id: "jump_rope_basic", names: { en: "Jump Rope — Basic Bounce", "zh-TW": "跳繩－基本跳" }, type: "duration", category: "cardio", group: "sports_other" },
  { id: "jump_rope_single_unders", names: { en: "Jump Rope — Single Unders", "zh-TW": "跳繩－單迴旋" }, type: "reps", category: "cardio", group: "sports_other" },
  { id: "jump_rope_double_unders", names: { en: "Jump Rope — Double Unders", "zh-TW": "跳繩－雙迴旋" }, type: "reps", category: "cardio", group: "sports_other" },
  { id: "kickboxing_shadow", names: { en: "Kickboxing — Shadowboxing", "zh-TW": "踢拳－影子拳" }, type: "duration", category: "cardio", group: "kickboxing" },
  { id: "kickboxing_heavy_bag", names: { en: "Kickboxing — Heavy Bag", "zh-TW": "踢拳－沙包訓練" }, type: "duration", category: "cardio", group: "kickboxing" },
  { id: "kickboxing_jab_cross", names: { en: "Kickboxing — Jab-Cross Combo", "zh-TW": "踢拳－刺拳直拳組合" }, type: "reps", category: "arms", group: "kickboxing" },
  { id: "kickboxing_roundhouse", names: { en: "Kickboxing — Roundhouse Kick", "zh-TW": "踢拳－迴旋踢" }, type: "reps", category: "legs", group: "kickboxing" },
  { id: "kickboxing_front_kick", names: { en: "Kickboxing — Front Kick", "zh-TW": "踢拳－前踢" }, type: "reps", category: "legs", group: "kickboxing" },
  { id: "kickboxing_knees", names: { en: "Kickboxing — Knee Strikes", "zh-TW": "踢拳－膝擊" }, type: "reps", category: "legs", group: "kickboxing" },
  { id: "kickboxing_rounds", names: { en: "Kickboxing — Rounds / Sparring", "zh-TW": "踢拳－回合／對練" }, type: "duration", category: "cardio", group: "kickboxing" },
  { id: "boxing_speed_bag", names: { en: "Boxing — Speed Bag", "zh-TW": "拳擊－速度球" }, type: "duration", category: "cardio", group: "kickboxing" },
];

const CALISTHENICS_IDS = new Set([
  "diamond_push_up","decline_push_up","pike_push_up","dips","bench_dips","chin_up","inverted_row","scapular_pull_up",
  "bodyweight_squat","pistol_squat","bulgarian_split_squat","glute_bridge","bodyweight_calf_raise","wall_sit",
  "lying_leg_raise","hanging_knee_raise","hanging_leg_raise","reverse_crunch","hollow_body_hold","superman_hold",
  "mountain_climber","burpee","jumping_jack","jump_squat","handstand_hold","push_up","pull_up","walking_lunge",
  "plank","side_plank","crunch","dead_bug"
]);

export const EXERCISE_LIBRARY_GROUPS: ExerciseLibraryGroup[] = ["gym", "calisthenics", "outdoor_cardio", "mobility_yoga", "swimming", "kickboxing", "sports_other"];

export function exerciseLibraryGroup(exercise: ExerciseDefinition): ExerciseLibraryGroup {
  if (exercise.group) return exercise.group;
  if (exercise.category === "mobility") return "mobility_yoga";
  if (CALISTHENICS_IDS.has(exercise.id)) return "calisthenics";
  if (exercise.category === "cardio") return "outdoor_cardio";
  return "gym";
}

export function exerciseById(id: string): ExerciseDefinition | undefined {
  return EXERCISES.find(exercise => exercise.id === id);
}


const CARDIO_SESSION_IDS = new Set([
  "walk","run","cycling","treadmill","stationary_bike","elliptical","rowing_machine","stair_climber",
  "hiking_cardio","trail_running","stair_running","sprinting","rucking","inline_skating",
  "swim_freestyle","swim_breaststroke","swim_backstroke","swim_butterfly","swim_sidestroke",
  "swim_elementary_backstroke","swim_head_up_freestyle","swim_head_up_breaststroke","swim_lifesaving_sidestroke",
  "swim_rescue_tube_tow","swim_cross_chest_carry","swim_armpit_tow","swim_tired_swimmer_tow",
  "treading_water","eggbeater_kick","jump_rope_basic"
]);

const ROUND_SESSION_IDS = new Set([
  "kickboxing_shadow","kickboxing_heavy_bag","kickboxing_rounds","boxing_speed_bag"
]);

const MUSCLE_WEIGHT_OVERRIDES: Record<string, Partial<Record<ExerciseCategory, number>>> = {
  barbell_bench_press:{chest:.70,arms:.18,shoulders:.12}, dumbbell_bench_press:{chest:.68,arms:.17,shoulders:.15},
  incline_dumbbell_press:{chest:.58,shoulders:.27,arms:.15}, machine_chest_press:{chest:.72,arms:.18,shoulders:.10},
  push_up:{chest:.60,arms:.20,shoulders:.10,core:.10}, diamond_push_up:{chest:.45,arms:.38,shoulders:.10,core:.07},
  decline_push_up:{chest:.56,shoulders:.22,arms:.15,core:.07}, wide_push_up:{chest:.68,arms:.12,shoulders:.10,core:.10},
  archer_push_up:{chest:.58,arms:.18,shoulders:.12,core:.12}, pseudo_planche_push_up:{chest:.38,shoulders:.34,arms:.18,core:.10},
  dips:{chest:.45,arms:.38,shoulders:.17}, bench_dips:{arms:.58,chest:.27,shoulders:.15},
  pull_up:{back:.68,arms:.22,core:.10}, chin_up:{back:.58,arms:.32,core:.10}, lat_pulldown:{back:.72,arms:.28},
  barbell_row:{back:.65,arms:.18,core:.12,legs:.05}, seated_cable_row:{back:.72,arms:.23,core:.05},
  single_arm_row:{back:.67,arms:.18,core:.15}, chest_supported_row:{back:.74,arms:.22,shoulders:.04},
  inverted_row:{back:.62,arms:.22,core:.16}, australian_pull_up:{back:.62,arms:.22,core:.16}, muscle_up:{back:.44,arms:.24,chest:.12,shoulders:.10,core:.10},
  deadlift:{legs:.45,back:.33,core:.17,arms:.05}, romanian_deadlift:{legs:.58,back:.25,core:.17},
  back_squat:{legs:.72,core:.18,back:.10}, front_squat:{legs:.68,core:.22,back:.10}, goblet_squat:{legs:.72,core:.22,arms:.06},
  hack_squat:{legs:.86,core:.08,back:.06}, leg_press:{legs:.90,core:.06,back:.04}, walking_lunge:{legs:.82,core:.18},
  bulgarian_split_squat:{legs:.84,core:.16}, pistol_squat:{legs:.78,core:.22}, shrimp_squat:{legs:.80,core:.20}, hip_thrust:{legs:.86,core:.09,back:.05},
  overhead_press:{shoulders:.62,arms:.22,core:.16}, dumbbell_shoulder_press:{shoulders:.64,arms:.23,core:.13},
  pike_push_up:{shoulders:.58,chest:.16,arms:.16,core:.10}, handstand_push_up:{shoulders:.58,arms:.20,chest:.10,core:.12},
  handstand_hold:{shoulders:.55,core:.30,arms:.15}, planche_hold:{shoulders:.40,chest:.22,arms:.16,core:.22},
  face_pull:{shoulders:.58,back:.32,arms:.10}, upright_row:{shoulders:.55,arms:.25,back:.20}, rear_delt_fly:{shoulders:.62,back:.30,arms:.08},
  farmers_carry:{core:.40,arms:.24,legs:.20,back:.16}, bear_crawl:{core:.45,shoulders:.20,legs:.20,arms:.15},
  mountain_climber:{cardio:.55,core:.25,legs:.20}, burpee:{cardio:.55,legs:.18,chest:.12,core:.10,arms:.05},
  jump_squat:{cardio:.45,legs:.45,core:.10}, kickboxing_jab_cross:{arms:.52,shoulders:.20,core:.18,cardio:.10},
  kickboxing_roundhouse:{legs:.56,core:.24,cardio:.20}, kickboxing_front_kick:{legs:.58,core:.24,cardio:.18}, kickboxing_knees:{legs:.50,core:.30,cardio:.20}
};

export function exerciseLoggingProfile(exercise: ExerciseDefinition): ExerciseLoggingProfile {
  if (exercise.loggingProfile) return exercise.loggingProfile;
  if (ROUND_SESSION_IDS.has(exercise.id)) return "rounds";
  if (CARDIO_SESSION_IDS.has(exercise.id)) return "cardio_session";
  if (exercise.category === "mobility" && exercise.type === "duration") return "mobility_session";
  return "sets";
}

export function exerciseMuscleWeights(exercise: ExerciseDefinition): Partial<Record<ExerciseCategory, number>> {
  const source = exercise.muscleWeights ?? MUSCLE_WEIGHT_OVERRIDES[exercise.id] ?? { [exercise.category]: 1 };
  const entries = Object.entries(source).filter((entry): entry is [ExerciseCategory, number] => Number.isFinite(entry[1]) && entry[1] > 0);
  const total = entries.reduce((sum, [,value]) => sum + value, 0);
  if (total <= 0) return { [exercise.category]: 1 };
  return Object.fromEntries(entries.map(([category,value]) => [category, value / total])) as Partial<Record<ExerciseCategory, number>>;
}

export function exerciseSessionMetricFlags(exercise: ExerciseDefinition): { distance: boolean; speed: boolean; incline: boolean; resistance: boolean; laps: boolean } {
  const swimming = exerciseLibraryGroup(exercise) === "swimming";
  const timedWaterSkill = ["treading_water", "eggbeater_kick"].includes(exercise.id);
  const swimDistance = swimming && !timedWaterSkill;
  return {
    distance: exercise.type === "distance_time" || ["stationary_bike","elliptical","rowing_machine"].includes(exercise.id) || swimDistance,
    speed: ["treadmill","stationary_bike","elliptical"].includes(exercise.id),
    incline: exercise.id === "treadmill",
    resistance: ["stationary_bike","elliptical","rowing_machine","stair_climber"].includes(exercise.id),
    laps: swimDistance
  };
}
