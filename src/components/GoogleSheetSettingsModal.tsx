"use client";

import React, { useState, useEffect } from "react";
import { Sheet, X, Check, Copy, ExternalLink, HelpCircle } from "lucide-react";

interface GoogleSheetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    // 활성 스프레드시트 또는 지정된 ID로 시트 로드
    var SPREADSHEET_ID = "1ReGNbpdrXF8G4EtYs0Qi7nkfXTcTrFn86tJa_yUHaqY";
    var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getActiveSheet();
    
    // 수신 데이터 파싱
    var data = JSON.parse(e.postData.contents);
    
    // 타임스탬프 (한국 시간 기준)
    var timestamp = data.timestamp || Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    var name = data.name || "익명의 횃불이";
    var finishtime = data.finishtime || data.timeFormatted || "";
    
    // 1행에 헤더가 없는 경우 자동 생성 ('timestamp', 'name', 'finishtime')
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["timestamp", "name", "finishtime"]);
    }
    
    // 게임 미션 성공 데이터 행 추가
    sheet.appendRow([timestamp, name, finishtime]);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      result: "success", 
      data: { timestamp: timestamp, name: name, finishtime: finishtime } 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      result: "error", 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("INU Breakout Webhook Server is running!");
}`;

export function GoogleSheetSettingsModal({
  isOpen,
  onClose,
}: GoogleSheetSettingsModalProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const envScriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || "";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("inu_google_sheet_webhook") || "";
      setWebhookUrl(stored || envScriptUrl);
    }
  }, [isOpen, envScriptUrl]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("inu_google_sheet_webhook", webhookUrl.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-sky-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/50 to-white dark:from-slate-850 dark:to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-xl">
              <Sheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                구글 스프레드시트 연동 설정
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                미션 성공 시 실시간으로 기록을 시트에 저장합니다
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* 환경 변수 감지 알림 배너 */}
          {envScriptUrl && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-medium">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <b>.env.local</b>의 <b>NEXT_PUBLIC_GOOGLE_SCRIPT_URL</b> 환경 변수가 활성화되어 있습니다.
              </span>
            </div>
          )}

          {/* 웹훅 URL 입력창 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              구글 앱스 스크립트 웹 앱 URL (NEXT_PUBLIC_GOOGLE_SCRIPT_URL)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              >
                {saved ? <Check className="w-4 h-4" /> : "저장"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              * .env.local 파일의 <code>NEXT_PUBLIC_GOOGLE_SCRIPT_URL</code> 키 값 또는 위 입력란에 입력된 URL로 실행됩니다.
            </p>
          </div>

          {/* 연동 방법 안내 */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700 dark:text-slate-200">
              <HelpCircle className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              1분 만에 구글 시트 연동하는 방법
            </div>
            <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
              <li>
                새{" "}
                <a
                  href="https://sheets.new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline font-medium inline-flex items-center gap-0.5"
                >
                  구글 스프레드시트 <ExternalLink className="w-3 h-3" />
                </a>
                를 생성합니다.
              </li>
              <li>상단 메뉴에서 <b>확장 프로그램 &gt; Apps Script</b>를 엽니다.</li>
              <li>아래 스크립트 코드를 복사하여 편집기에 붙여넣고 저장합니다.</li>
              <li>
                우측 상단 <b>배포 &gt; 새 배포</b> 클릭 후 유형을 <b>웹 앱</b>으로 선택하고, <b>액세스 권한: 모든 사용자</b>로 지정하여 배포합니다.
              </li>
              <li>발급된 <b>웹 앱 URL</b>을 위의 입력란에 입력하고 저장하면 완료!</li>
            </ol>
          </div>

          {/* 스크립트 복사 영역 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Apps Script 복사용 코드
              </span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> 복사 완료!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> 코드 복사
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-200 text-[11px] font-mono rounded-xl overflow-x-auto max-h-36 border border-slate-800">
              {APPS_SCRIPT_CODE}
            </pre>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-xl transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
