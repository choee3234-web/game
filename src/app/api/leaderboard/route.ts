import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export interface LeaderboardEntry {
  id: string;
  name: string;
  timeInSeconds: number;
  timeFormatted: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "leaderboard.json");

// 기본 샘플 데이터 (초기 상태 표시용)
const DEFAULT_RECORDS: LeaderboardEntry[] = [
  {
    id: "sample-1",
    name: "횃불이_마스터",
    timeInSeconds: 14.85,
    timeFormatted: "00:14.85",
    createdAt: "2026-10-20",
  },
  {
    id: "sample-2",
    name: "송도날다람쥐",
    timeInSeconds: 18.23,
    timeFormatted: "00:18.23",
    createdAt: "2026-10-21",
  },
  {
    id: "sample-3",
    name: "INU화이팅",
    timeInSeconds: 22.41,
    timeFormatted: "00:22.41",
    createdAt: "2026-10-22",
  },
];

function ensureDataFile(): LeaderboardEntry[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_RECORDS, null, 2), "utf-8");
      return DEFAULT_RECORDS;
    }
    const content = fs.readFileSync(DATA_FILE, "utf-8");
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : DEFAULT_RECORDS;
  } catch {
    return DEFAULT_RECORDS;
  }
}

function saveData(records: LeaderboardEntry[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), "utf-8");
  } catch (err) {
    console.error("데이터 저장 실패:", err);
  }
}

export async function GET() {
  const records = ensureDataFile();
  // 완료 시간이 가장 빠른 순으로 정렬 (오름차순)
  const sorted = [...records].sort((a, b) => a.timeInSeconds - b.timeInSeconds);
  const top3 = sorted.slice(0, 3);

  return NextResponse.json({
    success: true,
    top3,
    totalCount: records.length,
    hasGoogleSheetConfigured: Boolean(
      process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL ||
      process.env.GOOGLE_SHEET_WEBHOOK_URL
    ),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, timeInSeconds, timeFormatted } = body;

    if (!name || typeof timeInSeconds !== "number") {
      return NextResponse.json(
        { success: false, message: "올바르지 않은 데이터입니다." },
        { status: 400 }
      );
    }

    const trimmedName = String(name).trim().slice(0, 15) || "익명의 횃불이";
    const newEntry: LeaderboardEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: trimmedName,
      timeInSeconds: Number(timeInSeconds.toFixed(2)),
      timeFormatted: timeFormatted || `${timeInSeconds.toFixed(2)}초`,
      createdAt: new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    };

    const records = ensureDataFile();
    records.push(newEntry);
    records.sort((a, b) => a.timeInSeconds - b.timeInSeconds);
    saveData(records);

    // 구글 시트 웹훅/앱스 스크립트 연동 (NEXT_PUBLIC_GOOGLE_SCRIPT_URL 또는 GOOGLE_SHEET_WEBHOOK_URL)
    const googleWebhookUrl =
      process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL ||
      process.env.GOOGLE_SHEET_WEBHOOK_URL;
    let googleSheetSynced = false;

    if (googleWebhookUrl) {
      try {
        const res = await fetch(googleWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timestamp: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
            name: newEntry.name,
            finishtime: newEntry.timeFormatted,
            timeInSeconds: newEntry.timeInSeconds,
          }),
        });
        if (res.ok) {
          googleSheetSynced = true;
        }
      } catch (sheetErr) {
        console.error("구글 시트 연동 전송 실패:", sheetErr);
      }
    }

    const top3 = records.slice(0, 3);
    const rank = records.findIndex((r) => r.id === newEntry.id) + 1;

    return NextResponse.json({
      success: true,
      entry: newEntry,
      rank,
      isTop3: rank <= 3,
      top3,
      googleSheetSynced,
    });
  } catch (error) {
    console.error("기록 저장 중 오류:", error);
    return NextResponse.json(
      { success: false, message: "기록 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
