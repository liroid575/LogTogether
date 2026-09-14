import type { Locale } from "./types.js";

export interface FamilyPrivacySummary {
  shared: string[];
  privateToAccount: string[];
  localOnly: string[];
  unfinished: string[];
}

export function familyPrivacySummary(locale: Locale): FamilyPrivacySummary {
  if (locale === "zh-TW") {
    return {
      shared: [
        "運動紀錄與運動備註",
        "健行摘要（名稱、日期、距離、時間、海拔與備註）",
        "生理性別",
        "每日熱量與飲水總量",
        "每週任務、補充品週總覽與徽章"
      ],
      privateToAccount: [
        "身高與體重",
        "逐筆飲水時間",
        "補充品的精確服用時間",
        "訓練模板"
      ],
      localOnly: [
        "GPX 精確路線",
        "運動、健行與個人照片"
      ],
      unfinished: [
        "限時動態／Stories",
        "家庭共享健行徽章照片",
        "Google Drive 備份"
      ]
    };
  }
  return {
    shared: [
      "Workout records and workout notes",
      "Hike summaries (name, date, distance, time, elevation and notes)",
      "Biological sex",
      "Daily calorie and water totals",
      "Weekly missions, weekly supplement summaries and badges"
    ],
    privateToAccount: [
      "Height and weight",
      "Individual drink timestamps",
      "Exact supplement timestamps",
      "Saved workout routines"
    ],
    localOnly: [
      "Precise GPX route traces",
      "Workout, hike and profile photos"
    ],
    unfinished: [
      "Stories",
      "Family-shared hiking badge photos",
      "Google Drive backup"
    ]
  };
}
